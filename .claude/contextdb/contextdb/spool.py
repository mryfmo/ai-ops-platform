from __future__ import annotations

import json
import os
import re
import shutil
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import load_config
from .paths import ProjectPaths
from .storage import ContextStore
from .util import append_jsonl, safe_chmod, utc_iso, write_json_exclusive

_INGESTION_SOURCE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


def validate_ingestion_source(value: Any) -> str:
    if not isinstance(value, str) or not _INGESTION_SOURCE.fullmatch(value):
        raise ValueError("invalid ingestion source; expected ^[a-z0-9][a-z0-9_-]{0,31}$")
    return value


@dataclass
class DrainResult:
    acquired: bool
    processed: int = 0
    inserted: int = 0
    duplicates: int = 0
    quarantined: int = 0
    remaining: int = 0
    error: str | None = None


class WriterLock:
    def __init__(self, path: Path):
        self.path = path
        self.handle = None
        self._windows = False

    def acquire(self, blocking: bool = False, timeout_seconds: float = 0.0) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = open(self.path, "a+b")
        safe_chmod(self.path, 0o600)
        deadline = time.monotonic() + max(0.0, timeout_seconds) if blocking else time.monotonic()
        while True:
            try:
                if os.name == "nt":
                    import msvcrt

                    self._windows = True
                    self.handle.seek(0, os.SEEK_END)
                    if self.handle.tell() == 0:
                        self.handle.write(b"0")
                        self.handle.flush()
                    self.handle.seek(0)
                    msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl

                    fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                return True
            except (OSError, BlockingIOError):
                if not blocking or time.monotonic() >= deadline:
                    self.handle.close()
                    self.handle = None
                    return False
                time.sleep(0.025)

    def release(self) -> None:
        if not self.handle:
            return
        try:
            if self._windows:
                import msvcrt

                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
        finally:
            self.handle.close()
            self.handle = None

    def __enter__(self) -> "WriterLock":
        if not self.acquire(blocking=True, timeout_seconds=30.0):
            raise RuntimeError(f"failed to acquire writer lock: {self.path}")
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.release()


def record_error(paths: ProjectPaths, stage: str, exc: BaseException | str, **context: Any) -> None:
    message = str(exc)
    entry = {
        "ts_utc": utc_iso(),
        "stage": stage,
        "error_type": type(exc).__name__ if isinstance(exc, BaseException) else "Error",
        "message": message[:2000],
        "context": {str(k): str(v)[:500] for k, v in context.items()},
        "pid": os.getpid(),
    }
    try:
        append_jsonl(paths.error_log_path, entry, 0o600)
    except OSError:
        # Hook logging must never emit stdout or turn a telemetry failure into a user failure.
        pass


def spool_event(paths: ProjectPaths, event: dict[str, Any], *, ingested_from: str | None = None) -> Path:
    paths.ensure()
    name = f"{int(time.time() * 1_000_000):020d}-{os.getpid():08d}-{uuid.uuid4().hex}.json"
    destination = paths.incoming_dir / name
    envelope = {
        "spool_version": 1,
        "spooled_at_utc": utc_iso(),
        "event": event,
    }
    if ingested_from is not None:
        envelope["ingested_from"] = validate_ingestion_source(ingested_from)
    write_json_exclusive(destination, envelope, 0o600)
    return destination


def _quarantine(paths: ProjectPaths, source: Path, reason: str) -> None:
    destination = paths.quarantine_dir / source.name
    try:
        shutil.move(str(source), str(destination))
        safe_chmod(destination, 0o600)
    finally:
        record_error(paths, "quarantine", reason, spool_file=source.name)


def drain_spool(
    paths: ProjectPaths,
    config: dict[str, Any] | None = None,
    *,
    max_files: int | None = None,
    blocking_lock: bool = False,
) -> DrainResult:
    cfg = config or load_config(paths)
    lock = WriterLock(paths.lock_path)
    lock_timeout = float(cfg.get("storage", {}).get("writer_lock_timeout_ms", 3000)) / 1000.0
    if not lock.acquire(blocking=blocking_lock, timeout_seconds=lock_timeout):
        remaining = len(list(paths.incoming_dir.glob("*.json")))
        return DrainResult(
            acquired=False,
            remaining=remaining,
            error=(f"writer lock was not acquired within {lock_timeout:.3f}s" if blocking_lock else None),
        )
    result = DrainResult(acquired=True)
    try:
        files = sorted(paths.incoming_dir.glob("*.json"))
        batch_limit = max_files or int(cfg.get("storage", {}).get("drain_batch", 250))
        files = files[: max(1, batch_limit)]
        if not files:
            return result
        store = ContextStore(paths, cfg)
        conn = store.connect()
        try:
            for source in files:
                try:
                    envelope = json.loads(source.read_text(encoding="utf-8"))
                    event = envelope.get("event")
                    if not isinstance(event, dict) or not event.get("event_uuid"):
                        raise ValueError("spool envelope has no valid event")
                    ingested_from = source.name
                    if "ingested_from" in envelope:
                        ingested_from = validate_ingestion_source(envelope["ingested_from"])
                except (OSError, json.JSONDecodeError, ValueError) as exc:
                    _quarantine(paths, source, f"invalid spool record: {exc}")
                    result.processed += 1
                    result.quarantined += 1
                    continue
                try:
                    with conn:
                        inserted = store.insert_event(conn, event, ingested_from=ingested_from)
                except sqlite3.Error as exc:
                    result.error = str(exc)
                    record_error(paths, "drain-sqlite", exc, spool_file=source.name)
                    break
                except Exception as exc:  # malformed normalized event; quarantine only that record
                    _quarantine(paths, source, f"ingestion rejected: {exc}")
                    result.processed += 1
                    result.quarantined += 1
                    continue
                try:
                    source.unlink()
                except OSError as exc:
                    # The event UUID makes a later replay idempotent.
                    record_error(paths, "spool-unlink", exc, spool_file=source.name)
                result.processed += 1
                if inserted:
                    result.inserted += 1
                else:
                    result.duplicates += 1
        finally:
            store.secure_storage_files()
            conn.close()
    except Exception as exc:
        result.error = str(exc)
        record_error(paths, "drain", exc)
    finally:
        lock.release()
        result.remaining = len(list(paths.incoming_dir.glob("*.json")))
    return result
