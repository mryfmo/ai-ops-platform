from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_iso(dt: datetime | None = None) -> str:
    value = dt or utc_now()
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def epoch_ms(dt: datetime | None = None) -> int:
    value = dt or utc_now()
    return int(value.timestamp() * 1000)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, default=str)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


def stable_id(*parts: str, length: int = 32) -> str:
    payload = "\x1f".join(parts)
    return sha256_text(payload)[:length]


def one_line(value: Any, limit: int = 240) -> str:
    text = value if isinstance(value, str) else canonical_json(value)
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)] + "…"


def truncate_middle(value: Any, limit: int, marker: str = "…[truncated]…") -> str:
    text = value if isinstance(value, str) else pretty_json(value)
    if len(text) <= limit:
        return text
    if limit <= len(marker) + 8:
        return text[:limit]
    head = int((limit - len(marker)) * 0.62)
    tail = limit - len(marker) - head
    return text[:head] + marker + text[-tail:]


def normalize_for_fingerprint(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip()).casefold()


def ensure_dir(path: Path, mode: int = 0o700) -> None:
    path.mkdir(parents=True, exist_ok=True)
    safe_chmod(path, mode)


def safe_chmod(path: Path, mode: int) -> None:
    try:
        os.chmod(path, mode)
    except OSError:
        # Windows ACLs and some mounted filesystems do not map cleanly to POSIX modes.
        pass


def _write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        written = os.write(fd, view)
        if written <= 0:
            raise OSError("short write while persisting ContextDB state")
        view = view[written:]


def _fsync_directory(path: Path) -> None:
    if os.name == "nt":
        return
    try:
        fd = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def write_text_exclusive(path: Path, text: str, mode: int = 0o600) -> None:
    ensure_dir(path.parent)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        _write_all(fd, text.encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)
    safe_chmod(path, mode)
    _fsync_directory(path.parent)


def write_json_exclusive(path: Path, value: Any, mode: int = 0o600) -> None:
    write_text_exclusive(path, canonical_json(value) + "\n", mode)


def atomic_write_text(path: Path, text: str, mode: int = 0o600) -> None:
    ensure_dir(path.parent)
    temp = path.with_name(f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    try:
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
        try:
            _write_all(fd, text.encode("utf-8"))
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(temp, path)
        safe_chmod(path, mode)
        _fsync_directory(path.parent)
    finally:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            pass


def append_jsonl(path: Path, value: Any, mode: int = 0o600) -> None:
    ensure_dir(path.parent)
    data = (canonical_json(value) + "\n").encode("utf-8", errors="replace")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, mode)
    try:
        _write_all(fd, data)
        os.fsync(fd)
    finally:
        os.close(fd)
    safe_chmod(path, mode)


def parse_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def chunks(items: Iterable[Any], size: int) -> Iterable[list[Any]]:
    batch: list[Any] = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch
