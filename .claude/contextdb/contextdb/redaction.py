from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from pathlib import PurePath
from typing import Any

from .util import canonical_json, sha256_text, truncate_middle


@dataclass
class RedactionReport:
    count: int = 0
    categories: set[str] = field(default_factory=set)
    sensitive_path: bool = False

    def mark(self, category: str, amount: int = 1) -> None:
        self.count += amount
        self.categories.add(category)


# High-signal credential patterns. Values are replaced before persistence or spooling.
_TEXT_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "private-key",
        re.compile(
            r"-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----.*?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    ("anthropic-key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{16,}\b")),
    ("openai-key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")),
    ("aws-access-key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("stripe-key", re.compile(r"\b[rs]k_live_[A-Za-z0-9]{16,}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("gcp-key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    (
        "jwt",
        re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"),
    ),
    (
        "bearer-token",
        re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{16,}"),
    ),
    (
        "credential-assignment",
        re.compile(
            r"(?i)(\b(?:[A-Z0-9_]*(?:secret|token|key)[A-Z0-9_]*|password|passwd|pwd)\b\s*[:=]\s*)"
            r"(?:\"[^\"\r\n]*\"|'[^'\r\n]*'|[^\s,;\]\}]+)"
        ),
    ),
    (
        "basic-auth-url",
        re.compile(r"(?i)\b([a-z][a-z0-9+.-]*://)([^\s/@:]+):([^\s/@]+)@"),
    ),
]

_SENSITIVE_FILE_NAMES = {
    ".env",
    "credentials",
    "credentials.json",
    "secrets.json",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "known_hosts",
    ".netrc",
    ".npmrc",
    ".pypirc",
    "authorized_keys",
}
_SENSITIVE_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".kdbx"}
_SENSITIVE_DIRS = {".git", ".ssh", ".aws", ".gnupg", ".kube", ".docker"}
_CONTENT_KEYS = {
    "content",
    "new_string",
    "old_string",
    "text",
    "file_content",
    "notebook_content",
    "tool_response",
    "tool_output",
    "response",
    "result",
}
_PATH_KEYS = {
    "file_path",
    "path",
    "notebook_path",
    "filepath",
    "target_path",
    "source_path",
}


def is_sensitive_path(path: str | None) -> bool:
    if not path:
        return False
    normalized = path.replace("\\", "/").strip().casefold()
    if not normalized:
        return False
    parts = [part for part in normalized.split("/") if part not in ("", ".")]
    name = parts[-1] if parts else normalized
    if any(part in _SENSITIVE_DIRS for part in parts):
        return True
    if name in _SENSITIVE_FILE_NAMES or name.startswith(".env."):
        return True
    if PurePath(name).suffix.casefold() in _SENSITIVE_SUFFIXES:
        return True
    if any(token in name for token in ("credential", "private_key", "private-key", "secret")):
        return True
    return False


def _replacement(template: str, kind: str) -> str:
    try:
        return template.format(kind=kind)
    except (KeyError, ValueError):
        return "[REDACTED]"


def redact_text(text: str, report: RedactionReport, replacement_template: str) -> str:
    value = text
    for category, pattern in _TEXT_PATTERNS:
        def repl(match: re.Match[str]) -> str:
            report.mark(category)
            if category == "credential-assignment" and match.lastindex:
                return match.group(1) + _replacement(replacement_template, category)
            if category == "basic-auth-url" and match.lastindex:
                return match.group(1) + _replacement(replacement_template, category) + "@"
            return _replacement(replacement_template, category)

        value = pattern.sub(repl, value)
    return value


def _key_is_sensitive(key: str, sensitive_keys: set[str]) -> bool:
    normalized = re.sub(r"[^a-z0-9]", "_", key.casefold()).strip("_")
    return normalized in sensitive_keys or any(
        normalized.endswith("_" + suffix)
        for suffix in ("password", "secret", "token", "key", "api_key", "access_key", "secret_key", "private_key")
    )


def find_paths(value: Any) -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key.casefold() in _PATH_KEYS and isinstance(item, str):
                found.append(item)
            else:
                found.extend(find_paths(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(find_paths(item))
    return found


def redact_value(
    value: Any,
    report: RedactionReport,
    *,
    sensitive_keys: set[str],
    replacement_template: str,
    suppress_content: bool = False,
    suppress_reason: str = "sensitive_path",
    max_string_chars: int | None = None,
) -> Any:
    if isinstance(value, str):
        redacted = redact_text(value, report, replacement_template)
        return truncate_middle(redacted, max_string_chars) if max_string_chars else redacted
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for raw_key, item in value.items():
            key = str(raw_key)
            if _key_is_sensitive(key, sensitive_keys):
                report.mark("sensitive-key")
                result[key] = _replacement(replacement_template, "sensitive-key")
            elif suppress_content and key.casefold() in _CONTENT_KEYS:
                if suppress_reason == "sensitive_path":
                    report.mark("sensitive-file-content")
                else:
                    report.categories.add("content-capture-disabled")
                result[key] = {
                    "omitted": suppress_reason,
                    "stored_sha256": sha256_text(canonical_json(item)),
                }
            else:
                result[key] = redact_value(
                    item,
                    report,
                    sensitive_keys=sensitive_keys,
                    replacement_template=replacement_template,
                    suppress_content=suppress_content,
                    suppress_reason=suppress_reason,
                    max_string_chars=max_string_chars,
                )
        return result
    if isinstance(value, list):
        return [
            redact_value(
                item,
                report,
                sensitive_keys=sensitive_keys,
                replacement_template=replacement_template,
                suppress_content=suppress_content,
                suppress_reason=suppress_reason,
                max_string_chars=max_string_chars,
            )
            for item in value
        ]
    if isinstance(value, tuple):
        return [
            redact_value(
                item,
                report,
                sensitive_keys=sensitive_keys,
                replacement_template=replacement_template,
                suppress_content=suppress_content,
                suppress_reason=suppress_reason,
                max_string_chars=max_string_chars,
            )
            for item in value
        ]
    return copy.deepcopy(value)


def sanitize_payload(value: Any, config: dict[str, Any], *, max_string_chars: int | None = None) -> tuple[Any, RedactionReport]:
    redaction_cfg = config.get("redaction", {})
    capture_cfg = config.get("capture", {})
    replacement = str(redaction_cfg.get("replacement", "[REDACTED:{kind}]"))
    sensitive_keys = {
        re.sub(r"[^a-z0-9]", "_", str(key).casefold()).strip("_")
        for key in redaction_cfg.get("sensitive_keys", [])
    }
    report = RedactionReport()
    paths = find_paths(value)
    sensitive = bool(capture_cfg.get("skip_sensitive_files", True) and any(is_sensitive_path(p) for p in paths))
    capture_contents = bool(capture_cfg.get("capture_file_contents", True))
    suppress_content = sensitive or not capture_contents
    suppress_reason = "sensitive_path" if sensitive else "capture_file_contents=false"
    report.sensitive_path = sensitive
    sanitized = redact_value(
        value,
        report,
        sensitive_keys=sensitive_keys,
        replacement_template=replacement,
        suppress_content=suppress_content,
        suppress_reason=suppress_reason,
        max_string_chars=max_string_chars,
    )
    return sanitized, report
