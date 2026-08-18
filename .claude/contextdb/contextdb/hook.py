from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import load_config
from .normalize import normalize_hook_payload
from .paths import project_paths
from .spool import drain_spool, record_error, spool_event


def process_payload(
    payload: dict[str, Any],
    *,
    project_root: str | None = None,
    ingested_from: str | None = None,
) -> None:
    paths = project_paths(payload, project_root)
    try:
        config = load_config(paths)
        event = normalize_hook_payload(payload, paths, config)
        spool_event(paths, event, ingested_from=ingested_from)
        # Non-blocking lock: another hook may already be the single writer.
        # The durable spool remains the source of truth until a later drain succeeds.
        drain_spool(paths, config, blocking_lock=False)
        if event.get("event_type") == "session_end":
            try:
                from .storage import ContextStore
                days = int(config.get("operations", {}).get("error_log_retention_days", 30))
                store = ContextStore(paths, config)
                with store.connect() as conn:
                    store.prune_expired(conn, paths.project_id, days=days)
                cutoff_utc = datetime.now(timezone.utc) - timedelta(days=days)
                if paths.error_log_path.exists():
                    retained = []
                    for line in paths.error_log_path.read_text(encoding="utf-8").splitlines():
                        try:
                            ts = datetime.fromisoformat(str(json.loads(line).get("ts_utc", "")).replace("Z", "+00:00"))
                        except (ValueError, TypeError, json.JSONDecodeError):
                            retained.append(line)
                            continue
                        if ts >= cutoff_utc:
                            retained.append(line)
                    if retained:
                        paths.error_log_path.write_text("\n".join(retained) + "\n", encoding="utf-8")
                    else:
                        paths.error_log_path.unlink()
                cutoff = time.time() - days * 86400
                for path in paths.quarantine_dir.glob("*"):
                    if path.exists() and path.stat().st_mtime < cutoff:
                        path.unlink()
            except Exception:
                pass
    except Exception as exc:
        record_error(paths, "hook", exc, hook_event_name=payload.get("hook_event_name", "Unknown"))


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw or "{}")
        if not isinstance(payload, dict):
            raise ValueError("hook input must be a JSON object")
        process_payload(payload)
    except Exception as exc:
        try:
            paths = project_paths()
            record_error(paths, "hook-input", exc)
        except Exception:
            pass
    # Logging is non-enforcing: never block the agent and never write to stdout.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
