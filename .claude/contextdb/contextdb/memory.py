from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from .util import normalize_for_fingerprint, one_line, sha256_text, truncate_middle


@dataclass(frozen=True)
class MemoryCandidate:
    kind: str
    content: str
    scope: str
    confidence: float
    salience: float
    reason: str
    explicit: bool = False

    @property
    def fingerprint(self) -> str:
        return sha256_text(f"{self.kind}\x1f{normalize_for_fingerprint(self.content)}")


_KIND_ALIASES = {
    "decision": "decision",
    "決定": "decision",
    "constraint": "constraint",
    "制約": "constraint",
    "rule": "constraint",
    "preference": "preference",
    "嗜好": "preference",
    "open_task": "open_task",
    "task": "open_task",
    "todo": "open_task",
    "未完了": "open_task",
    "failure": "failure",
    "失敗": "failure",
    "procedure": "procedure",
    "手順": "procedure",
    "fact": "fact",
    "事実": "fact",
}

_EXPLICIT_MARKER = re.compile(r"\[(?:memory|記憶)\s*:\s*([^\]]+)\]", re.IGNORECASE)
# Abbreviation over-splitting is acceptable in this best-effort heuristic layer.
_SENTENCE_SPLIT = re.compile(r"(?<=[。！？\n])|(?<=[.!?])(?=\s)")

_KEYWORDS: dict[str, tuple[tuple[str, ...], float]] = {
    "constraint": (
        ("必須", "必ず", "厳守", "禁止", "してはならない", "しないこと", "must", "never", "do not", "shall"),
        0.91,
    ),
    "decision": (
        ("決定", "方針", "採用する", "とする", "に統一", "decided", "we will use", "adopt"),
        0.88,
    ),
    "preference": (
        ("希望", "好む", "優先する", "prefer", "preference"),
        0.87,
    ),
    "open_task": (
        ("未完了", "残課題", "次に行う", "要対応", "todo", "remaining", "follow-up"),
        0.86,
    ),
}


def _sentences(text: str) -> list[str]:
    values = [part.strip() for part in _SENTENCE_SPLIT.split(text) if part.strip()]
    if len(values) <= 1 and len(text) > 500:
        values = [line.strip() for line in text.splitlines() if line.strip()]
    return values or [text.strip()]


def extract_candidates(event: dict[str, Any]) -> list[MemoryCandidate]:
    event_type = str(event.get("event_type", ""))
    detail = event.get("normalized_detail") or {}
    result: list[MemoryCandidate] = []

    if event_type == "post_compact":
        content = str(detail.get("compact_summary") or "").strip()
        if content:
            result.append(
                MemoryCandidate(
                    kind="compact_summary",
                    content=truncate_middle(content, 6000),
                    scope="session",
                    confidence=0.99,
                    salience=0.95,
                    reason="Claude Code PostCompact summary",
                    explicit=True,
                )
            )
        return result

    if event_type == "user_prompt":
        prompt = str(detail.get("prompt") or "").strip()
        if not prompt:
            return result
        markers = list(_EXPLICIT_MARKER.finditer(prompt))
        explicit_spans: list[tuple[int, int]] = []
        for index, marker in enumerate(markers):
            interior = marker.group(1).strip()
            folded = interior.casefold()
            if folded in _KIND_ALIASES:
                kind = _KIND_ALIASES[folded]
                span_end = markers[index + 1].start() if index + 1 < len(markers) else len(prompt)
                content = prompt[marker.end():span_end].strip()
            else:
                prefixed = re.match(r"^([^\s:—-]+)(?:\s*[:—-]\s*|\s+)(.+)$", interior, re.DOTALL)
                prefix = prefixed.group(1).casefold() if prefixed else ""
                if prefixed and prefix in _KIND_ALIASES:
                    kind = _KIND_ALIASES[prefix]
                    content = prefixed.group(2).strip()
                else:
                    kind = "fact"
                    content = interior
                span_end = marker.end()
            explicit_spans.append((marker.start(), span_end))
            if content:
                result.append(
                    MemoryCandidate(
                        kind=kind,
                        content=truncate_middle(content, 4000),
                        scope="project",
                        confidence=1.0,
                        salience=0.98,
                        reason="explicit memory marker",
                        explicit=True,
                    )
                )
        residual_parts: list[str] = []
        cursor = 0
        for start, end in explicit_spans:
            residual_parts.append(prompt[cursor:start])
            cursor = end
        residual_parts.append(prompt[cursor:])
        residual = " ".join(residual_parts)
        seen: set[tuple[str, str]] = set()
        for sentence in _sentences(residual):
            folded = sentence.casefold()
            for kind, (words, confidence) in _KEYWORDS.items():
                if any(word.casefold() in folded for word in words):
                    content = truncate_middle(sentence, 1200)
                    key = (kind, normalize_for_fingerprint(content))
                    if key in seen:
                        continue
                    seen.add(key)
                    result.append(
                        MemoryCandidate(
                            kind=kind,
                            content=content,
                            scope="session",
                            confidence=confidence,
                            salience=0.85 if kind in {"constraint", "decision"} else 0.75,
                            reason=f"strong {kind} language in user prompt",
                        )
                    )
        return result

    if event_type == "tool_failure":
        tool = str(event.get("tool_name") or "tool")
        error = str(detail.get("error") or "unknown error")
        tool_input = detail.get("tool_input") or {}
        content = f"{tool} failed: {one_line(tool_input, 300)} | {one_line(error, 700)}"
        result.append(
            MemoryCandidate(
                kind="failure",
                content=content,
                scope="session",
                confidence=0.98,
                salience=0.70,
                reason="tool execution failure",
            )
        )
        return result

    if event_type == "turn_stop":
        message = str(detail.get("last_assistant_message") or "").strip()
        if message and any(token in message.casefold() for token in ("completed", "完了", "remaining", "未完了")):
            result.append(
                MemoryCandidate(
                    kind="session_outcome",
                    content=truncate_middle(message, 1600),
                    scope="session",
                    confidence=0.70,
                    salience=0.55,
                    reason="turn completion summary",
                )
            )
    return result


def compress_lines(lines: Iterable[str], limit: int) -> str:
    unique: list[str] = []
    seen: set[str] = set()
    for line in lines:
        for part in re.split(r"\s*\|\s*|\n+", line):
            clean = " ".join(part.split())
            if not clean:
                continue
            key = normalize_for_fingerprint(clean)
            if key in seen:
                continue
            seen.add(key)
            unique.append(clean)
    joined = " | ".join(unique)
    if len(joined) <= limit:
        return joined
    # Preserve both early historical decisions and the newest tail.
    marker = " | … | "
    head = int((limit - len(marker)) * 0.40)
    tail = limit - len(marker) - head
    return joined[:head].rstrip(" |") + marker + joined[-tail:].lstrip(" |")
