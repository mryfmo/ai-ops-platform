from __future__ import annotations

import sqlite3
from typing import Any

from .semantic import semantic_config
from .storage import ContextStore


def normalize_scores(scores: dict[str, float]) -> dict[str, float]:
    if not scores:
        return {}
    low, high = min(scores.values()), max(scores.values())
    if high == low:
        return {key: 1.0 for key in scores}
    return {key: (value - low) / (high - low) for key, value in scores.items()}


def _key(row: dict[str, Any]) -> str:
    record_type = str(row["record_type"])
    return f"{record_type}:{row[record_type + '_uuid']}"


def _event(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    item.pop("_score", None)
    item.update(record_type="event", kind=item["event_type"], ts=item["ts_utc"])
    return item


def _memory(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    item.pop("_score", None)
    item.update(record_type="memory", ts=item["created_at_utc"])
    return item


def _lexical(
    store: ContextStore,
    conn: sqlite3.Connection,
    query: str,
    session_id: str | None,
) -> tuple[dict[str, dict[str, Any]], dict[str, float]]:
    if store.fts_tokenizer(conn) == "none":
        return {}, {}
    phrase = '"' + query.replace('"', '""') + '"'
    if session_id is None:
        events = conn.execute(
            """
            SELECT e.*, -bm25(events_fts) AS _score
            FROM events_fts JOIN events e ON e.id=events_fts.rowid
            WHERE events_fts.project_id=? AND events_fts MATCH ?
            """,
            (store.paths.project_id, phrase),
        ).fetchall()
    else:
        events = conn.execute(
            """
            SELECT e.*, -bm25(events_fts) AS _score
            FROM events_fts JOIN events e ON e.id=events_fts.rowid
            WHERE events_fts.project_id=? AND events_fts.session_id=? AND events_fts MATCH ?
            """,
            (store.paths.project_id, session_id, phrase),
        ).fetchall()

    visible = {
        str(row["memory_uuid"])
        for row in store.current_memories(
            conn,
            store.paths.project_id,
            session_id=session_id,
            include_project=True,
        )
    }
    memories = conn.execute(
        """
        SELECT m.*, -bm25(memories_fts) AS _score
        FROM memories_fts JOIN memories m ON m.id=memories_fts.rowid
        WHERE memories_fts.project_id=? AND memories_fts MATCH ?
        """,
        (store.paths.project_id, phrase),
    ).fetchall()

    rows: dict[str, dict[str, Any]] = {}
    scores: dict[str, float] = {}
    for raw in events:
        item = _event(raw)
        key = _key(item)
        rows[key] = item
        scores[key] = float(raw["_score"])
    for raw in memories:
        if str(raw["memory_uuid"]) not in visible:
            continue
        item = _memory(raw)
        key = _key(item)
        rows[key] = item
        scores[key] = float(raw["_score"])
    return rows, scores


def _semantic(
    store: ContextStore,
    conn: sqlite3.Connection,
    query: str,
    session_id: str | None,
) -> tuple[dict[str, dict[str, Any]], dict[str, float]]:
    cfg = semantic_config(store.config)
    if not cfg.enabled:
        return {}, {}
    stored = conn.execute(
        "SELECT COUNT(*) FROM memory_embeddings WHERE project_id=? AND model=?",
        (store.paths.project_id, cfg.model),
    ).fetchone()[0]
    if not stored:
        return {}, {}
    try:
        matches = store.semantic_search_memories(
            conn,
            store.paths.project_id,
            query,
            session_id=session_id,
            limit=int(stored),
        )
    except Exception:
        return {}, {}
    rows: dict[str, dict[str, Any]] = {}
    scores: dict[str, float] = {}
    for match in matches:
        item = _memory(match["memory"])
        key = _key(item)
        rows[key] = item
        scores[key] = float(match["score"])
    return rows, scores


def _closure(
    conn: sqlite3.Connection,
    parent: dict[str, Any],
    session_id: str | None,
) -> list[tuple[str, dict[str, Any]]]:
    project_id = str(parent["project_id"])
    event_id = int(parent["id"])
    session_clause = " AND e.session_id=?" if session_id is not None else ""
    session_params: tuple[Any, ...] = (session_id,) if session_id is not None else ()
    paths: list[tuple[str, list[sqlite3.Row]]] = []

    tool_use_id = str(parent.get("tool_use_id") or "")
    if tool_use_id:
        paths.append(
            (
                "tool_use_id",
                conn.execute(
                    "SELECT e.* FROM events e WHERE e.project_id=? AND e.id<>? AND e.tool_use_id=?"
                    + session_clause
                    + " ORDER BY e.id",
                    (project_id, event_id, tool_use_id, *session_params),
                ).fetchall(),
            )
        )

    paths.append(
        (
            "adjacent",
            conn.execute(
                """
                SELECT e.* FROM events e
                WHERE e.project_id=? AND e.session_id=? AND e.id IN (?, ?)
                ORDER BY e.id
                """,
                (project_id, parent["session_id"], event_id - 1, event_id + 1),
            ).fetchall(),
        )
    )
    paths.append(
        (
            "shared_file",
            conn.execute(
                """
                SELECT DISTINCT e.* FROM event_files source
                JOIN event_files related
                  ON related.project_id=source.project_id AND related.file_path=source.file_path
                JOIN events e ON e.id=related.event_id
                WHERE source.event_id=? AND e.project_id=? AND e.id<>?
                """
                + session_clause
                + " ORDER BY e.id",
                (event_id, project_id, event_id, *session_params),
            ).fetchall(),
        )
    )

    seen: set[str] = set()
    result: list[tuple[str, dict[str, Any]]] = []
    for path, rows in paths:
        for row in rows:
            item = _event(row)
            key = _key(item)
            if key not in seen:
                seen.add(key)
                result.append((path, item))
    return result


def recall(
    store: ContextStore,
    conn: sqlite3.Connection,
    query: str,
    *,
    session_id: str | None,
    k: int,
    rho: float,
) -> list[dict[str, Any]]:
    if k <= 0 or not query.strip():
        return []
    lexical_rows, lexical_raw = _lexical(store, conn, query.strip(), session_id)
    semantic_rows, semantic_raw = _semantic(store, conn, query.strip(), session_id)
    lexical = normalize_scores(lexical_raw)
    semantic = normalize_scores(semantic_raw)
    semantic_available = bool(semantic)
    rows = lexical_rows | semantic_rows

    base: list[dict[str, Any]] = []
    for key in lexical.keys() | semantic.keys():
        if semantic_available:
            score = rho * lexical.get(key, 0.0) + (1.0 - rho) * semantic.get(key, 0.0)
        else:
            score = lexical.get(key, 0.0)
        item = rows[key] | {
            "score": score,
            "via": "fused" if key in lexical and key in semantic else "semantic" if key in semantic else "lexical",
        }
        base.append(item)
    base.sort(
        key=lambda item: (
            -float(item["score"]),
            str(item["record_type"]),
            -int(item["id"]),
        )
    )

    base_scores = {_key(item): float(item["score"]) for item in base}
    seen: set[str] = set()
    results: list[dict[str, Any]] = []
    for parent in base:
        parent_key = _key(parent)
        if parent_key not in seen:
            results.append(parent)
            seen.add(parent_key)
            if len(results) >= k:
                break
        if parent["record_type"] != "event":
            continue
        inherited = float(parent["score"]) * 0.5
        for path, child in _closure(conn, parent, session_id):
            key = _key(child)
            if key in seen or base_scores.get(key, float("-inf")) >= inherited:
                continue
            results.append(child | {"score": inherited, "via": f"closure:{path}"})
            seen.add(key)
            if len(results) >= k:
                break
        if len(results) >= k:
            break
    return results
