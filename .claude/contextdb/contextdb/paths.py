from __future__ import annotations

import os
import re
import time
import uuid
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from .util import ensure_dir, safe_chmod, write_text_exclusive


@dataclass(frozen=True)
class ProjectPaths:
    root: Path
    base: Path
    package_dir: Path
    state_dir: Path
    spool_dir: Path
    incoming_dir: Path
    quarantine_dir: Path
    health_dir: Path
    db_path: Path
    config_path: Path
    lock_path: Path
    error_log_path: Path
    project_id_path: Path
    project_id: str

    def ensure(self) -> None:
        for path in (
            self.base,
            self.state_dir,
            self.spool_dir,
            self.incoming_dir,
            self.quarantine_dir,
            self.health_dir,
        ):
            ensure_dir(path, 0o700)


def resolve_project_root(payload: dict[str, Any] | None = None, explicit: str | Path | None = None) -> Path:
    data = payload or {}
    raw = explicit or os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    return Path(raw).expanduser().resolve()


_PROJECT_ID = re.compile(r"^[0-9a-f]{32}$")


def _load_or_create_project_id(path: Path) -> str:
    try:
        value = path.read_text(encoding="utf-8").strip().casefold()
    except FileNotFoundError:
        value = ""
    except OSError as exc:
        raise ValueError(f"cannot read ContextDB project identity: {path}: {exc}") from exc
    if value:
        if not _PROJECT_ID.fullmatch(value):
            raise ValueError(f"invalid ContextDB project identity: {path}")
        safe_chmod(path, 0o600)
        return value

    candidate = uuid.uuid4().hex
    try:
        write_text_exclusive(path, candidate + "\n", 0o600)
        return candidate
    except FileExistsError:
        # Multiple first-run hooks may race: the directory entry becomes visible
        # just before the O_EXCL winner finishes its tiny write. Retry briefly.
        deadline = time.monotonic() + 2.0
        while True:
            try:
                value = path.read_text(encoding="utf-8").strip().casefold()
            except OSError:
                value = ""
            if _PROJECT_ID.fullmatch(value):
                safe_chmod(path, 0o600)
                return value
            if time.monotonic() >= deadline:
                raise ValueError(f"invalid ContextDB project identity after concurrent initialization: {path}")
            time.sleep(0.01)


def project_paths(payload: dict[str, Any] | None = None, explicit: str | Path | None = None) -> ProjectPaths:
    root = resolve_project_root(payload, explicit)
    base = root / ".claude" / "contextdb"
    project_id_path = base / "state" / "project-id"
    result = ProjectPaths(
        root=root,
        base=base,
        package_dir=base / "contextdb",
        state_dir=base / "state",
        spool_dir=base / "spool",
        incoming_dir=base / "spool" / "incoming",
        quarantine_dir=base / "spool" / "quarantine",
        health_dir=base / "health",
        db_path=base / "state" / "context.db",
        config_path=base / "config.json",
        lock_path=base / "state" / ".writer.lock",
        error_log_path=base / "health" / "errors.jsonl",
        project_id_path=project_id_path,
        project_id="",
    )
    result.ensure()
    return replace(result, project_id=_load_or_create_project_id(project_id_path))
