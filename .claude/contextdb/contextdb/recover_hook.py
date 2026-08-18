from __future__ import annotations

import json
import sys
from typing import Any

from .config import load_config
from .normalize import normalize_hook_payload
from .paths import ProjectPaths, project_paths
from .recovery import build_recovery_context
from .spool import drain_spool, record_error, spool_event
from .storage import ContextStore


def _record_recovery_injected(paths: ProjectPaths, config: dict[str, Any], session_id: str, context: str) -> None:
    try:
        event = normalize_hook_payload(
            {
                "hook_event_name": "RecoveryInjected",
                "session_id": session_id,
                "cwd": str(paths.root),
                "recovery_packet": context,
            },
            paths,
            config,
        )
        spool_event(paths, event)
    except Exception as exc:
        record_error(paths, "recover-hook-recording", exc, session_id=session_id)


def recovery_output(payload: dict[str, Any], *, project_root: str | None = None) -> dict[str, Any]:
    paths = project_paths(payload, project_root)
    config = load_config(paths)
    # A blocking drain is safe here: SessionStart recovery must observe all records
    # that were durably spooled before compaction, including PostCompact.
    drain = drain_spool(paths, config, blocking_lock=True)
    store = ContextStore(paths, config)
    session_id = str(payload.get("session_id") or "")
    if not session_id:
        context = "[CompactionDB recovery] No session_id was supplied; automatic recovery was skipped."
    else:
        conn = store.connect()
        try:
            context = build_recovery_context(store, conn, session_id=session_id)
            if drain.error or drain.remaining:
                context = (
                    "[CompactionDB warning] Some durably spooled events could not be settled before recovery "
                    f"(pending={drain.remaining}). Inspect health/errors and run the drain command before relying on completeness.\n\n"
                    + context
                )
        finally:
            conn.close()
    _record_recovery_injected(paths, config, session_id, context)
    return {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
    }


def main() -> int:
    payload: dict[str, Any] = {}
    try:
        value = json.loads(sys.stdin.read() or "{}")
        if isinstance(value, dict):
            payload = value
        output = recovery_output(payload)
    except Exception as exc:
        try:
            paths = project_paths(payload)
            record_error(paths, "recover-hook", exc)
        except Exception:
            pass
        output = {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": (
                    "[CompactionDB recovery] Recovery storage could not be read. "
                    "Inspect `.claude/contextdb/health/errors.jsonl` and validate the current filesystem before continuing."
                ),
            }
        }
    # SessionStart structured output must be the only stdout content.
    print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
