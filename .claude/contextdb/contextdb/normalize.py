from __future__ import annotations

import json
import os
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Any

from .memory import extract_candidates
from .paths import ProjectPaths
from .redaction import find_paths, is_sensitive_path, sanitize_payload
from .util import canonical_json, epoch_ms, one_line, sha256_text, truncate_middle, utc_iso, utc_now


_EVENT_MAP = {
    "SessionStart": "session_start",
    "UserPromptSubmit": "user_prompt",
    "PostToolUse": "tool_success",
    "PostToolUseFailure": "tool_failure",
    "PermissionDenied": "permission_denied",
    "PreCompact": "pre_compact",
    "PostCompact": "post_compact",
    "Stop": "turn_stop",
    "StopFailure": "turn_failure",
    "SubagentStart": "subagent_start",
    "SubagentStop": "subagent_stop",
    "TaskCreated": "task_created",
    "TaskCompleted": "task_completed",
    "SessionEnd": "session_end",
    "PostToolBatch": "tool_batch",
    "FileChanged": "file_changed",
    "RecoveryInjected": "recovery_injected",
}


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _tool_summary(tool_name: str, tool_input: Any, success: bool, error: str = "") -> str:
    prefix = f"{tool_name or 'Tool'} {'succeeded' if success else 'failed'}"
    if isinstance(tool_input, dict):
        if tool_name == "Bash" and "command" in tool_input:
            subject = str(tool_input.get("command", ""))
        else:
            subject = ""
            for key in ("file_path", "path", "notebook_path", "query", "pattern", "url", "description"):
                if key in tool_input:
                    subject = f"{key}={tool_input[key]}"
                    break
            if not subject:
                subject = canonical_json(tool_input)
    else:
        subject = _stringify(tool_input)
    value = f"{prefix}: {subject}"
    if error:
        value += f" | {error}"
    return one_line(value, 240)


def _relative_path(root: Path, raw: str) -> str:
    try:
        path = Path(raw).expanduser()
        if not path.is_absolute():
            path = root / path
        resolved = path.resolve(strict=False)
        try:
            return resolved.relative_to(root).as_posix()
        except ValueError:
            return resolved.as_posix()
    except (OSError, RuntimeError, ValueError):
        return str(raw)


def _extract_file_refs(root: Path, event_type: str, tool_name: str, sanitized_payload: dict[str, Any]) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    tool_input = sanitized_payload.get("tool_input") or {}
    candidates = find_paths(tool_input)
    response = sanitized_payload.get("tool_response") or sanitized_payload.get("tool_output") or {}
    candidates.extend(find_paths(response))
    if event_type == "file_changed" and isinstance(sanitized_payload.get("file_path"), str):
        candidates.append(sanitized_payload["file_path"])

    write_tools = {"Write": "write", "Edit": "edit", "MultiEdit": "edit", "NotebookEdit": "edit"}
    read_tools = {"Read": "read", "Grep": "search", "Glob": "search"}
    operation = write_tools.get(tool_name) or read_tools.get(tool_name) or "reference"
    seen: set[str] = set()
    for raw in candidates:
        if not isinstance(raw, str) or not raw.strip():
            continue
        normalized = one_line(_relative_path(root, raw), 1200)
        if normalized in seen:
            continue
        seen.add(normalized)
        refs.append(
            {
                "file_path": normalized,
                "operation": operation,
                "sensitivity": "restricted" if is_sensitive_path(raw) else "internal",
            }
        )
    return refs


def encode_detail(value: dict[str, Any], max_chars: int) -> tuple[dict[str, Any], str]:
    """Return a valid JSON object and serialization bounded by max_chars."""
    full = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, default=str)
    if len(full) <= max_chars:
        return value, full

    source_hash = sha256_text(full)
    keys = list(value) or ["_preview"]
    per_field = max(48, (max_chars - 320) // max(1, len(keys)))
    while True:
        bounded: dict[str, Any] = {
            "_truncated": True,
            "_original_chars": len(full),
            "_original_sha256": source_hash,
        }
        for key, item in value.items():
            if isinstance(item, str):
                bounded[key] = truncate_middle(item, per_field)
            elif item is None or isinstance(item, (bool, int, float)):
                bounded[key] = item
            else:
                bounded[key] = truncate_middle(_stringify(item), per_field)
        serialized = json.dumps(bounded, ensure_ascii=False, indent=2, sort_keys=True, default=str)
        if len(serialized) <= max_chars:
            return bounded, serialized
        if per_field <= 24:
            preview_budget = max(24, max_chars - 220)
            fallback = {
                "_truncated": True,
                "_original_chars": len(full),
                "_original_sha256": source_hash,
                "_preview": truncate_middle(full, preview_budget),
            }
            serialized = json.dumps(fallback, ensure_ascii=False, sort_keys=True)
            while len(serialized) > max_chars and preview_budget > 8:
                preview_budget = max(8, int(preview_budget * 0.8))
                fallback["_preview"] = truncate_middle(full, preview_budget)
                serialized = json.dumps(fallback, ensure_ascii=False, sort_keys=True)
            if len(serialized) > max_chars:
                fallback = {
                    "_truncated": True,
                    "_original_chars": len(full),
                    "_original_sha256": source_hash,
                }
                serialized = json.dumps(fallback, ensure_ascii=False, sort_keys=True)
            return fallback, serialized
        per_field = max(24, int(per_field * 0.72))


def normalize_hook_payload(payload: dict[str, Any], paths: ProjectPaths, config: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    hook_name = str(payload.get("hook_event_name") or "Unknown")
    event_type = _EVENT_MAP.get(hook_name, hook_name.casefold())
    session_id = str(payload.get("session_id") or "")
    agent_id = str(payload.get("agent_id") or payload.get("agent_type") or "")
    tool_name = str(payload.get("tool_name") or "")
    success: int | None = None
    if event_type == "tool_success":
        success = 1
    elif event_type in {"tool_failure", "permission_denied", "turn_failure"}:
        success = 0

    capture_cfg = config.get("capture", {})
    max_output = int(capture_cfg.get("max_tool_output_chars", 30000))
    max_detail = int(capture_cfg.get("max_detail_chars", 100000))
    max_summary = int(capture_cfg.get("max_summary_chars", 240))

    # Sanitize before the payload touches disk, including the crash-recovery spool.
    sanitized_payload, report = sanitize_payload(payload, config, max_string_chars=max_detail)
    if not isinstance(sanitized_payload, dict):
        sanitized_payload = {"value": sanitized_payload}

    tool_input = sanitized_payload.get("tool_input") or {}
    tool_response = sanitized_payload.get("tool_response", sanitized_payload.get("tool_output", ""))
    if not bool(capture_cfg.get("capture_tool_response", True)):
        tool_response = {"omitted": "capture_tool_response=false"}
    else:
        tool_response = truncate_middle(_stringify(tool_response), max_output)

    if event_type == "user_prompt":
        prompt = str(sanitized_payload.get("prompt") or "")
        summary = one_line(prompt, max_summary)
        normalized_detail: dict[str, Any] = {"prompt": truncate_middle(prompt, max_detail)}
    elif event_type in {"tool_success", "tool_failure"}:
        error = str(sanitized_payload.get("error") or "")
        summary = _tool_summary(tool_name, tool_input, event_type == "tool_success", error)
        normalized_detail = {
            "tool_input": tool_input,
            "tool_response": tool_response if event_type == "tool_success" else None,
            "error": truncate_middle(error, max_output) if error else None,
            "is_interrupt": sanitized_payload.get("is_interrupt"),
            "duration_ms": sanitized_payload.get("duration_ms"),
        }
    elif event_type == "post_compact":
        compact_summary = str(sanitized_payload.get("compact_summary") or "")
        summary = one_line(f"PostCompact: {compact_summary}", max_summary)
        normalized_detail = {
            "trigger": sanitized_payload.get("trigger"),
            "compact_summary": truncate_middle(compact_summary, max_detail),
        }
    elif event_type == "pre_compact":
        summary = one_line(f"PreCompact ({sanitized_payload.get('trigger') or 'unknown'})", max_summary)
        normalized_detail = {
            "trigger": sanitized_payload.get("trigger"),
            "custom_instructions": truncate_middle(str(sanitized_payload.get("custom_instructions") or ""), max_detail),
        }
    elif event_type == "session_start":
        summary = one_line(f"SessionStart ({sanitized_payload.get('source') or 'unknown'})", max_summary)
        normalized_detail = {
            "source": sanitized_payload.get("source"),
            "model": sanitized_payload.get("model"),
            "agent_type": sanitized_payload.get("agent_type"),
            "session_title": sanitized_payload.get("session_title"),
        }
    elif event_type == "session_end":
        summary = one_line(f"SessionEnd ({sanitized_payload.get('reason') or 'unknown'})", max_summary)
        normalized_detail = {"reason": sanitized_payload.get("reason")}
    elif event_type == "recovery_injected":
        packet = str(sanitized_payload.get("recovery_packet") or "")
        summary = one_line(packet, max_summary)
        normalized_detail = {"recovery_packet": packet}
    elif event_type in {"turn_stop", "subagent_stop"}:
        message = str(sanitized_payload.get("last_assistant_message") or "")
        summary = one_line(f"{hook_name}: {message}", max_summary)
        normalized_detail = {
            "last_assistant_message": truncate_middle(message, max_detail),
            "agent_id": sanitized_payload.get("agent_id"),
            "agent_type": sanitized_payload.get("agent_type"),
            "agent_transcript_path": sanitized_payload.get("agent_transcript_path"),
        }
    elif event_type == "turn_failure":
        error = str(sanitized_payload.get("error") or sanitized_payload.get("message") or "")
        error_details = str(sanitized_payload.get("error_details") or "")
        last_message = str(sanitized_payload.get("last_assistant_message") or "")
        summary = one_line(f"StopFailure: {error} {error_details}", max_summary)
        normalized_detail = {
            "error": truncate_middle(error, max_detail),
            "error_details": truncate_middle(error_details, max_detail),
            "last_assistant_message": truncate_middle(last_message, max_detail),
        }
    elif event_type == "subagent_start":
        agent_type = str(sanitized_payload.get("agent_type") or "unknown")
        child_agent_id = str(sanitized_payload.get("agent_id") or "")
        summary = one_line(f"SubagentStart: {agent_type} {child_agent_id}", max_summary)
        normalized_detail = {
            "agent_id": child_agent_id,
            "agent_type": agent_type,
        }
    elif event_type in {"task_created", "task_completed"}:
        task_id = str(sanitized_payload.get("task_id") or "")
        task_subject = str(sanitized_payload.get("task_subject") or "")
        action = "created" if event_type == "task_created" else "completed"
        summary = one_line(f"Task {action}: {task_subject} ({task_id})", max_summary)
        normalized_detail = {
            "task_id": task_id,
            "task_subject": truncate_middle(task_subject, max_detail),
            "task_description": truncate_middle(str(sanitized_payload.get("task_description") or ""), max_detail),
            "teammate_name": sanitized_payload.get("teammate_name"),
            "team_name": sanitized_payload.get("team_name"),
            "status": action,
        }
    elif event_type == "permission_denied":
        summary = _tool_summary(tool_name, tool_input, False, "permission denied")
        normalized_detail = {
            "tool_input": tool_input,
            "permission_mode": sanitized_payload.get("permission_mode"),
            "reason": sanitized_payload.get("reason"),
        }
    else:
        summary = one_line(sanitized_payload, max_summary)
        normalized_detail = sanitized_payload

    normalized_detail, detail_json = encode_detail(normalized_detail, max_detail)
    retention_days = int(capture_cfg.get("raw_event_retention_days", 30))
    expires = now + timedelta(days=max(retention_days, 1))
    input_hash = sha256_text(canonical_json(tool_input)) if tool_input else ""
    output_hash = sha256_text(_stringify(tool_response)) if tool_response else ""
    event = {
        "event_uuid": str(payload.get("event_uuid") or uuid.uuid4()),
        "project_id": paths.project_id,
        "session_id": session_id,
        "agent_id": agent_id,
        "ts_utc": utc_iso(now),
        "ts_epoch_ms": epoch_ms(now),
        "hook_event_name": hook_name,
        "event_type": event_type,
        "tool_name": tool_name,
        "tool_use_id": str(payload.get("tool_use_id") or ""),
        "success": success,
        "summary": summary,
        "detail_json": detail_json,
        "detail_sha256": sha256_text(detail_json),
        "input_sha256": input_hash,
        "output_sha256": output_hash,
        "sensitivity": "restricted" if report.count or report.sensitive_path else "internal",
        "redaction_count": report.count,
        "redaction_categories": sorted(report.categories),
        "transcript_path": str(sanitized_payload.get("transcript_path") or ""),
        "cwd": str(sanitized_payload.get("cwd") or paths.root),
        "source": str(sanitized_payload.get("source") or ""),
        "trigger": str(sanitized_payload.get("trigger") or ""),
        "duration_ms": sanitized_payload.get("duration_ms"),
        "expires_at_utc": utc_iso(expires),
        "normalized_detail": normalized_detail,
        "files": _extract_file_refs(paths.root, event_type, tool_name, sanitized_payload),
        "received_pid": os.getpid(),
    }
    event["memory_candidates"] = [candidate.__dict__ for candidate in extract_candidates(event)]
    return event
