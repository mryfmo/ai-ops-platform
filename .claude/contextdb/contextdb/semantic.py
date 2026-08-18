from __future__ import annotations

import json
import math
import subprocess
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SemanticConfig:
    enabled: bool
    command: tuple[str, ...]
    model: str
    timeout_seconds: float
    batch_size: int


def semantic_config(config: dict[str, Any]) -> SemanticConfig:
    raw = config.get("semantic", {})
    command_raw = raw.get("command", [])
    if isinstance(command_raw, str):
        raise ValueError("semantic.command must be a JSON array, not a shell command string")
    command = tuple(str(item) for item in command_raw)
    return SemanticConfig(
        enabled=bool(raw.get("enabled", False)),
        command=command,
        model=str(raw.get("model", "external-command")),
        timeout_seconds=max(1.0, float(raw.get("timeout_seconds", 30))),
        batch_size=max(1, int(raw.get("batch_size", 32))),
    )


def embed_texts(texts: list[str], config: dict[str, Any]) -> tuple[str, list[list[float]]]:
    cfg = semantic_config(config)
    if not cfg.enabled:
        raise ValueError("semantic search is disabled; set semantic.enabled=true in .claude/contextdb/config.json")
    if not cfg.command:
        raise ValueError("semantic.command is empty; configure an executable and arguments")
    payload = json.dumps({"texts": texts}, ensure_ascii=False)
    completed = subprocess.run(
        list(cfg.command),
        input=payload,
        text=True,
        capture_output=True,
        timeout=cfg.timeout_seconds,
        check=False,
    )
    if completed.returncode != 0:
        error = completed.stderr.strip() or completed.stdout.strip() or f"exit code {completed.returncode}"
        raise RuntimeError(f"semantic embedding command failed: {error[:2000]}")
    try:
        value = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError(f"semantic embedding command returned invalid JSON: {exc}") from exc
    model = cfg.model
    if isinstance(value, dict):
        vectors = value.get("embeddings")
        model = str(value.get("model") or model)
    else:
        vectors = value
    if model != cfg.model:
        raise ValueError(
            f"semantic embedding response model {model!r} does not match configured model {cfg.model!r}"
        )
    if not isinstance(vectors, list) or len(vectors) != len(texts):
        raise ValueError("semantic embedding response must contain one vector per input text")
    parsed: list[list[float]] = []
    dimensions: int | None = None
    for index, vector in enumerate(vectors):
        if not isinstance(vector, list) or not vector:
            raise ValueError(f"embedding {index} is not a non-empty array")
        current = [float(item) for item in vector]
        if not all(math.isfinite(item) for item in current):
            raise ValueError(f"embedding {index} contains a non-finite value")
        if dimensions is None:
            dimensions = len(current)
        elif len(current) != dimensions:
            raise ValueError("embedding dimensions are inconsistent")
        parsed.append(current)
    return model, parsed


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return float("-inf")
    dot = sum(a * b for a, b in zip(left, right))
    norm_left = math.sqrt(sum(a * a for a in left))
    norm_right = math.sqrt(sum(b * b for b in right))
    if norm_left == 0.0 or norm_right == 0.0:
        return 0.0
    return dot / (norm_left * norm_right)
