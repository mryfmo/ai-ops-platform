from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from .paths import ProjectPaths
from .util import atomic_write_text, pretty_json, safe_chmod

DEFAULT_CONFIG: dict[str, Any] = {
    "version": 1,
    "storage": {
        "busy_timeout_ms": 750,
        "writer_lock_timeout_ms": 3000,
        "drain_batch": 250,
        "journal_mode": "WAL",
        "synchronous": "FULL",
    },
    "capture": {
        "max_detail_chars": 100000,
        "max_tool_output_chars": 30000,
        "max_summary_chars": 240,
        "capture_tool_response": True,
        "capture_file_contents": True,
        "skip_sensitive_files": True,
        "raw_event_retention_days": 30,
    },
    "redaction": {
        "replacement": "[REDACTED:{kind}]",
        "sensitive_keys": [
            "password",
            "passwd",
            "pwd",
            "secret",
            "api_key",
            "apikey",
            "access_token",
            "refresh_token",
            "auth_token",
            "token",
            "client_secret",
            "private_key",
            "authorization",
            "cookie",
            "set_cookie",
        ],
    },
    "memory": {
        "auto_promote": True,
        "auto_promote_min_confidence": 0.86,
        "auto_promote_kinds": ["constraint", "decision", "preference", "open_task", "compact_summary"],
        "block_summary_chars": 800,
        "recent_raw_count": 8,
        "context_items": 24,
    },
    "recovery": {
        "max_chars": 12000,
        "files_budget_chars": 2000,
        "recent_events": 12,
        "recent_prompts": 4,
        "recent_files": 12,
        "recent_failures": 5,
        "include_project_memories": True,
    },
    "recall": {
        "rho": 0.6,
        "k": 5,
    },
    "semantic": {
        "enabled": False,
        "command": [],
        "model": "external-command",
        "timeout_seconds": 30,
        "batch_size": 32,
    },
    "operations": {
        "error_log_retention_days": 30,
    },
}


def _merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        else:
            result[key] = value
    return result


def _require_int(config: dict[str, Any], section: str, key: str, *, minimum: int) -> None:
    value = config.get(section, {}).get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"ContextDB config {section}.{key} must be an integer >= {minimum}")


def _require_number(
    config: dict[str, Any], section: str, key: str, *, minimum: float, maximum: float | None = None
) -> None:
    value = config.get(section, {}).get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or float(value) < minimum:
        raise ValueError(f"ContextDB config {section}.{key} must be a number >= {minimum}")
    if maximum is not None and float(value) > maximum:
        raise ValueError(f"ContextDB config {section}.{key} must be <= {maximum}")


def validate_config(config: dict[str, Any]) -> dict[str, Any]:
    if config.get("version") != 1:
        raise ValueError("ContextDB config version must be 1")
    storage = config.get("storage", {})
    journal = str(storage.get("journal_mode", "WAL")).upper()
    synchronous = str(storage.get("synchronous", "FULL")).upper()
    if journal not in {"DELETE", "TRUNCATE", "PERSIST", "MEMORY", "WAL", "OFF"}:
        raise ValueError(f"unsupported storage.journal_mode: {journal}")
    if synchronous not in {"OFF", "NORMAL", "FULL", "EXTRA"}:
        raise ValueError(f"unsupported storage.synchronous: {synchronous}")
    _require_int(config, "storage", "busy_timeout_ms", minimum=0)
    _require_int(config, "storage", "writer_lock_timeout_ms", minimum=0)
    _require_int(config, "storage", "drain_batch", minimum=1)
    _require_int(config, "capture", "max_detail_chars", minimum=512)
    _require_int(config, "capture", "max_tool_output_chars", minimum=128)
    _require_int(config, "capture", "max_summary_chars", minimum=32)
    _require_int(config, "capture", "raw_event_retention_days", minimum=1)
    _require_number(config, "memory", "auto_promote_min_confidence", minimum=0.0, maximum=1.0)
    _require_int(config, "memory", "block_summary_chars", minimum=128)
    _require_int(config, "memory", "recent_raw_count", minimum=0)
    _require_int(config, "memory", "context_items", minimum=1)
    _require_int(config, "recovery", "max_chars", minimum=1000)
    _require_int(config, "recovery", "files_budget_chars", minimum=0)
    for key in ("recent_events", "recent_prompts", "recent_files", "recent_failures"):
        _require_int(config, "recovery", key, minimum=0)
    _require_number(config, "recall", "rho", minimum=0.0, maximum=1.0)
    _require_int(config, "recall", "k", minimum=0)
    semantic = config.get("semantic", {})
    if not isinstance(semantic.get("command", []), list):
        raise ValueError("ContextDB config semantic.command must be a JSON array")
    _require_number(config, "semantic", "timeout_seconds", minimum=1.0)
    _require_int(config, "semantic", "batch_size", minimum=1)
    return config

def load_config(paths: ProjectPaths, create_if_missing: bool = True) -> dict[str, Any]:
    if not paths.config_path.exists():
        if create_if_missing:
            atomic_write_text(paths.config_path, pretty_json(DEFAULT_CONFIG) + "\n", 0o600)
        return validate_config(copy.deepcopy(DEFAULT_CONFIG))
    safe_chmod(paths.config_path, 0o600)
    try:
        user = json.loads(paths.config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid ContextDB config: {paths.config_path}: {exc}") from exc
    if not isinstance(user, dict):
        raise ValueError(f"ContextDB config must be a JSON object: {paths.config_path}")
    return validate_config(_merge(DEFAULT_CONFIG, user))


def write_default_config(path: Path) -> None:
    atomic_write_text(path, pretty_json(DEFAULT_CONFIG) + "\n", 0o600)
