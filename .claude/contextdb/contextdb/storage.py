from __future__ import annotations

import json
import math
import sqlite3
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Any, Iterable

from . import SCHEMA_VERSION
from .memory import MemoryCandidate, compress_lines
from .paths import ProjectPaths
from .semantic import cosine_similarity, embed_texts, semantic_config
from .util import (
    canonical_json,
    normalize_for_fingerprint,
    one_line,
    safe_chmod,
    sha256_text,
    stable_id,
    utc_iso,
    utc_now,
)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    root_path TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    last_seen_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    project_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    transcript_path TEXT,
    started_at_utc TEXT,
    ended_at_utc TEXT,
    start_source TEXT,
    end_reason TEXT,
    model TEXT,
    agent_type TEXT,
    session_title TEXT,
    last_event_id INTEGER,
    last_seen_at_utc TEXT NOT NULL,
    PRIMARY KEY (project_id, session_id)
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uuid TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL,
    session_id TEXT NOT NULL DEFAULT '',
    agent_id TEXT NOT NULL DEFAULT '',
    ts_utc TEXT NOT NULL,
    ts_epoch_ms INTEGER NOT NULL,
    hook_event_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    tool_name TEXT NOT NULL DEFAULT '',
    tool_use_id TEXT NOT NULL DEFAULT '',
    success INTEGER,
    summary TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    detail_sha256 TEXT NOT NULL,
    input_sha256 TEXT NOT NULL DEFAULT '',
    output_sha256 TEXT NOT NULL DEFAULT '',
    sensitivity TEXT NOT NULL,
    redaction_count INTEGER NOT NULL DEFAULT 0,
    redaction_categories_json TEXT NOT NULL DEFAULT '[]',
    transcript_path TEXT NOT NULL DEFAULT '',
    cwd TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    trigger TEXT NOT NULL DEFAULT '',
    duration_ms INTEGER,
    expires_at_utc TEXT,
    ingested_from TEXT NOT NULL DEFAULT 'spool',
    created_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_project_id ON events(project_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(project_id, session_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(project_id, session_id, event_type, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_tool_use_id ON events(project_id, tool_use_id);
CREATE INDEX IF NOT EXISTS idx_events_expiry ON events(expires_at_utc);

CREATE TABLE IF NOT EXISTS event_files (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    session_id TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL,
    operation TEXT NOT NULL,
    sensitivity TEXT NOT NULL,
    PRIMARY KEY (event_id, file_path, operation)
);
CREATE INDEX IF NOT EXISTS idx_event_files_session ON event_files(project_id, session_id, event_id DESC);
CREATE INDEX IF NOT EXISTS idx_event_files_path ON event_files(project_id, file_path);

CREATE TABLE IF NOT EXISTS memory_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_uuid TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL,
    session_id TEXT NOT NULL DEFAULT '',
    source_event_uuid TEXT NOT NULL,
    kind TEXT NOT NULL,
    scope TEXT NOT NULL,
    content TEXT NOT NULL,
    content_fingerprint TEXT NOT NULL,
    confidence REAL NOT NULL,
    salience REAL NOT NULL,
    reason TEXT NOT NULL,
    explicit INTEGER NOT NULL DEFAULT 0,
    created_at_utc TEXT NOT NULL,
    promoted_memory_uuid TEXT
);
CREATE INDEX IF NOT EXISTS idx_candidates_project ON memory_candidates(project_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_unpromoted ON memory_candidates(project_id, promoted_memory_uuid, id DESC);

CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_uuid TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL,
    session_id TEXT NOT NULL DEFAULT '',
    scope TEXT NOT NULL CHECK(scope IN ('project', 'session')),
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT NOT NULL,
    content_fingerprint TEXT NOT NULL,
    confidence REAL NOT NULL,
    salience REAL NOT NULL,
    sensitivity TEXT NOT NULL,
    valid_from_utc TEXT NOT NULL,
    valid_until_utc TEXT,
    supersedes_memory_uuid TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'retraction')),
    source TEXT NOT NULL,
    source_event_uuids_json TEXT NOT NULL DEFAULT '[]',
    generator TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id, id);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(project_id, session_id, id);
CREATE INDEX IF NOT EXISTS idx_memories_supersedes ON memories(project_id, supersedes_memory_uuid);
CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(project_id, kind, id DESC);
CREATE INDEX IF NOT EXISTS idx_memories_fingerprint ON memories(project_id, kind, content_fingerprint);

CREATE TABLE IF NOT EXISTS memory_sources (
    memory_uuid TEXT NOT NULL,
    event_uuid TEXT NOT NULL,
    PRIMARY KEY (memory_uuid, event_uuid)
);

CREATE TABLE IF NOT EXISTS memory_embeddings (
    memory_uuid TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    vector_json TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_project ON memory_embeddings(project_id);

CREATE TABLE IF NOT EXISTS memory_blocks (
    project_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    start_ordinal INTEGER NOT NULL,
    end_ordinal INTEGER NOT NULL,
    start_memory_uuid TEXT NOT NULL,
    end_memory_uuid TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    PRIMARY KEY (project_id, level, start_ordinal, end_ordinal)
);
"""


class ContextStore:
    def __init__(self, paths: ProjectPaths, config: dict[str, Any]):
        self.paths = paths
        self.config = config
        self.paths.ensure()

    def connect(self, *, initialize: bool = True) -> sqlite3.Connection:
        timeout = max(float(self.config.get("storage", {}).get("busy_timeout_ms", 750)) / 1000.0, 0.05)
        conn = sqlite3.connect(self.paths.db_path, timeout=timeout)
        try:
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute(f"PRAGMA busy_timeout={int(timeout * 1000)}")
            if initialize:
                journal = str(self.config.get("storage", {}).get("journal_mode", "WAL")).upper()
                synchronous = str(self.config.get("storage", {}).get("synchronous", "FULL")).upper()
                conn.execute(f"PRAGMA journal_mode={journal}")
                conn.execute(f"PRAGMA synchronous={synchronous}")
                self.ensure_schema(conn)
                self.secure_storage_files()
            return conn
        except Exception:
            conn.close()
            raise

    def secure_storage_files(self) -> None:
        for path in (
            self.paths.db_path,
            Path(str(self.paths.db_path) + "-wal"),
            Path(str(self.paths.db_path) + "-shm"),
            self.paths.lock_path,
            self.paths.project_id_path,
        ):
            if path.exists():
                safe_chmod(path, 0o600)

    def ensure_schema(self, conn: sqlite3.Connection) -> None:
        conn.executescript(_SCHEMA)
        conn.execute(
            "INSERT INTO schema_meta(key, value) VALUES('schema_version', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (str(SCHEMA_VERSION),),
        )
        self._ensure_fts(conn)
        conn.commit()

    def _ensure_fts(self, conn: sqlite3.Connection) -> None:
        tokenizer = conn.execute("SELECT value FROM schema_meta WHERE key='fts_tokenizer'").fetchone()
        if tokenizer:
            return
        selected = "none"
        for candidate in ("trigram", "unicode61 remove_diacritics 2"):
            try:
                conn.execute(
                    f"CREATE VIRTUAL TABLE events_fts USING fts5("
                    f"event_uuid UNINDEXED, project_id UNINDEXED, session_id UNINDEXED, summary, detail, tokenize='{candidate}')"
                )
                conn.execute(
                    f"CREATE VIRTUAL TABLE memories_fts USING fts5("
                    f"memory_uuid UNINDEXED, project_id UNINDEXED, session_id UNINDEXED, kind, content, tokenize='{candidate}')"
                )
                selected = candidate
                break
            except sqlite3.OperationalError:
                conn.execute("DROP TABLE IF EXISTS events_fts")
                conn.execute("DROP TABLE IF EXISTS memories_fts")
        conn.execute(
            "INSERT INTO schema_meta(key, value) VALUES('fts_tokenizer', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (selected,),
        )

    def insert_event(self, conn: sqlite3.Connection, event: dict[str, Any], *, ingested_from: str = "spool") -> bool:
        now = utc_iso()
        conn.execute(
            "INSERT INTO projects(project_id, root_path, created_at_utc, last_seen_at_utc) VALUES(?,?,?,?) "
            "ON CONFLICT(project_id) DO UPDATE SET root_path=excluded.root_path, last_seen_at_utc=excluded.last_seen_at_utc",
            (event["project_id"], str(self.paths.root), now, now),
        )
        try:
            cur = conn.execute(
                """
                INSERT INTO events(
                    event_uuid, project_id, session_id, agent_id, ts_utc, ts_epoch_ms,
                    hook_event_name, event_type, tool_name, tool_use_id, success,
                    summary, detail_json, detail_sha256, input_sha256, output_sha256,
                    sensitivity, redaction_count, redaction_categories_json,
                    transcript_path, cwd, source, trigger, duration_ms,
                    expires_at_utc, ingested_from, created_at_utc
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    event["event_uuid"],
                    event["project_id"],
                    event.get("session_id", ""),
                    event.get("agent_id", ""),
                    event["ts_utc"],
                    event["ts_epoch_ms"],
                    event["hook_event_name"],
                    event["event_type"],
                    event.get("tool_name", ""),
                    event.get("tool_use_id", ""),
                    event.get("success"),
                    event["summary"],
                    event["detail_json"],
                    event["detail_sha256"],
                    event.get("input_sha256", ""),
                    event.get("output_sha256", ""),
                    event["sensitivity"],
                    int(event.get("redaction_count", 0)),
                    canonical_json(event.get("redaction_categories", [])),
                    event.get("transcript_path", ""),
                    event.get("cwd", ""),
                    event.get("source", ""),
                    event.get("trigger", ""),
                    event.get("duration_ms"),
                    event.get("expires_at_utc"),
                    ingested_from,
                    now,
                ),
            )
        except sqlite3.IntegrityError as exc:
            if "event_uuid" in str(exc) or "UNIQUE" in str(exc):
                return False
            raise
        event_id = int(cur.lastrowid)
        self._upsert_session(conn, event, event_id, now)
        for ref in event.get("files", []):
            conn.execute(
                "INSERT OR IGNORE INTO event_files(event_id, project_id, session_id, file_path, operation, sensitivity) "
                "VALUES(?,?,?,?,?,?)",
                (
                    event_id,
                    event["project_id"],
                    event.get("session_id", ""),
                    ref.get("file_path", ""),
                    ref.get("operation", "reference"),
                    ref.get("sensitivity", "internal"),
                ),
            )
        self._fts_insert_event(conn, event_id, event)
        memory_changed = self._insert_candidates(conn, event)
        if memory_changed:
            self.rebuild_memory_blocks(conn, event["project_id"])
        return True

    def _upsert_session(self, conn: sqlite3.Connection, event: dict[str, Any], event_id: int, now: str) -> None:
        session_id = event.get("session_id", "")
        if not session_id:
            return
        detail = event.get("normalized_detail") or {}
        started = event["ts_utc"] if event["event_type"] == "session_start" else None
        ended = event["ts_utc"] if event["event_type"] == "session_end" else None
        start_source = detail.get("source") if event["event_type"] == "session_start" else None
        end_reason = detail.get("reason") if event["event_type"] == "session_end" else None
        conn.execute(
            """
            INSERT INTO sessions(
                project_id, session_id, transcript_path, started_at_utc, ended_at_utc,
                start_source, end_reason, model, agent_type, session_title,
                last_event_id, last_seen_at_utc
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(project_id, session_id) DO UPDATE SET
                transcript_path=CASE WHEN excluded.transcript_path<>'' THEN excluded.transcript_path ELSE sessions.transcript_path END,
                started_at_utc=COALESCE(sessions.started_at_utc, excluded.started_at_utc),
                ended_at_utc=COALESCE(excluded.ended_at_utc, sessions.ended_at_utc),
                start_source=COALESCE(sessions.start_source, excluded.start_source),
                end_reason=COALESCE(excluded.end_reason, sessions.end_reason),
                model=COALESCE(excluded.model, sessions.model),
                agent_type=COALESCE(excluded.agent_type, sessions.agent_type),
                session_title=COALESCE(excluded.session_title, sessions.session_title),
                last_event_id=excluded.last_event_id,
                last_seen_at_utc=excluded.last_seen_at_utc
            """,
            (
                event["project_id"],
                session_id,
                event.get("transcript_path", ""),
                started,
                ended,
                start_source,
                end_reason,
                detail.get("model"),
                detail.get("agent_type") or event.get("agent_id") or None,
                detail.get("session_title"),
                event_id,
                now,
            ),
        )

    def _fts_insert_event(self, conn: sqlite3.Connection, event_id: int, event: dict[str, Any]) -> None:
        if self.fts_tokenizer(conn) == "none":
            return
        conn.execute(
            "INSERT INTO events_fts(rowid, event_uuid, project_id, session_id, summary, detail) VALUES(?,?,?,?,?,?)",
            (
                event_id,
                event["event_uuid"],
                event["project_id"],
                event.get("session_id", ""),
                event["summary"],
                event["detail_json"],
            ),
        )

    def _fts_insert_memory(self, conn: sqlite3.Connection, memory_id: int, row: dict[str, Any]) -> None:
        if self.fts_tokenizer(conn) == "none":
            return
        conn.execute(
            "INSERT INTO memories_fts(rowid, memory_uuid, project_id, session_id, kind, content) VALUES(?,?,?,?,?,?)",
            (
                memory_id,
                row["memory_uuid"],
                row["project_id"],
                row.get("session_id", ""),
                row["kind"],
                row["content"],
            ),
        )

    def fts_tokenizer(self, conn: sqlite3.Connection) -> str:
        row = conn.execute("SELECT value FROM schema_meta WHERE key='fts_tokenizer'").fetchone()
        return str(row[0]) if row else "none"

    def _insert_candidates(self, conn: sqlite3.Connection, event: dict[str, Any]) -> bool:
        changed = False
        cfg = self.config.get("memory", {})
        auto_enabled = bool(cfg.get("auto_promote", True))
        min_conf = float(cfg.get("auto_promote_min_confidence", 0.86))
        auto_kinds = {str(v) for v in cfg.get("auto_promote_kinds", [])}
        for raw in event.get("memory_candidates", []):
            candidate = MemoryCandidate(**raw)
            candidate_uuid = stable_id("candidate", event["event_uuid"], candidate.kind, candidate.fingerprint)
            conn.execute(
                """
                INSERT OR IGNORE INTO memory_candidates(
                    candidate_uuid, project_id, session_id, source_event_uuid, kind, scope,
                    content, content_fingerprint, confidence, salience, reason,
                    explicit, created_at_utc
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    candidate_uuid,
                    event["project_id"],
                    event.get("session_id", ""),
                    event["event_uuid"],
                    candidate.kind,
                    candidate.scope,
                    candidate.content,
                    candidate.fingerprint,
                    candidate.confidence,
                    candidate.salience,
                    candidate.reason,
                    int(candidate.explicit),
                    event["ts_utc"],
                ),
            )
            promote = candidate.explicit or candidate.kind == "compact_summary" or (
                auto_enabled and candidate.kind in auto_kinds and candidate.confidence >= min_conf
            )
            if promote:
                memory_uuid = self.add_memory(
                    conn,
                    project_id=event["project_id"],
                    session_id=event.get("session_id", ""),
                    scope=candidate.scope,
                    kind=candidate.kind,
                    content=candidate.content,
                    confidence=candidate.confidence,
                    salience=candidate.salience,
                    sensitivity=event["sensitivity"],
                    source="auto",
                    source_event_uuids=[event["event_uuid"]],
                    generator=f"heuristic:{candidate.reason}",
                )
                if memory_uuid:
                    conn.execute(
                        "UPDATE memory_candidates SET promoted_memory_uuid=? WHERE candidate_uuid=?",
                        (memory_uuid, candidate_uuid),
                    )
                    changed = True
        return changed

    def add_memory(
        self,
        conn: sqlite3.Connection,
        *,
        project_id: str,
        session_id: str,
        scope: str,
        kind: str,
        content: str,
        confidence: float = 1.0,
        salience: float = 0.8,
        sensitivity: str = "internal",
        source: str = "manual",
        source_event_uuids: Iterable[str] = (),
        generator: str = "manual",
        supersedes_memory_uuid: str | None = None,
        status: str = "active",
        valid_until_utc: str | None = None,
        memory_uuid: str | None = None,
    ) -> str | None:
        if scope not in {"project", "session"}:
            raise ValueError("memory scope must be 'project' or 'session'")
        if scope == "session" and not session_id:
            raise ValueError("session-scoped memory requires session_id")
        if status not in {"active", "retraction"}:
            raise ValueError("memory status must be 'active' or 'retraction'")
        content = content.strip()
        if not content:
            raise ValueError("memory content must not be empty")
        fingerprint = sha256_text(f"{kind}\x1f{normalize_for_fingerprint(content)}")
        if supersedes_memory_uuid:
            target = conn.execute(
                "SELECT 1 FROM memories WHERE project_id=? AND memory_uuid=?",
                (project_id, supersedes_memory_uuid),
            ).fetchone()
            if not target:
                raise ValueError(f"superseded memory not found in this project: {supersedes_memory_uuid}")
        stored_session_id = session_id if scope == "session" else ""
        if status == "active" and not supersedes_memory_uuid:
            # Deduplicate only inside the same visibility boundary. Treating an
            # identical session memory as the same record across sessions would
            # either hide it from the new session or leak the old session's
            # provenance into the new one.
            duplicate = conn.execute(
                """
                SELECT m.memory_uuid FROM memories m
                WHERE m.project_id=? AND m.scope=? AND m.session_id=?
                  AND m.kind=? AND m.content_fingerprint=? AND m.status='active'
                  AND NOT EXISTS (
                    SELECT 1 FROM memories n
                    WHERE n.project_id=m.project_id AND n.supersedes_memory_uuid=m.memory_uuid
                  )
                LIMIT 1
                """,
                (project_id, scope, stored_session_id, kind, fingerprint),
            ).fetchone()
            if duplicate:
                return str(duplicate[0])
        now = utc_iso()
        row = {
            "memory_uuid": memory_uuid or str(uuid.uuid4()),
            "project_id": project_id,
            "session_id": stored_session_id,
            "scope": scope,
            "kind": kind,
            "content": content,
            "summary": one_line(content, 480),
            "content_fingerprint": fingerprint,
            "confidence": max(0.0, min(float(confidence), 1.0)),
            "salience": max(0.0, min(float(salience), 1.0)),
            "sensitivity": sensitivity,
            "valid_from_utc": now,
            "valid_until_utc": valid_until_utc,
            "supersedes_memory_uuid": supersedes_memory_uuid,
            "status": status,
            "source": source,
            "source_event_uuids_json": canonical_json(list(source_event_uuids)),
            "generator": generator,
            "created_at_utc": now,
        }
        cur = conn.execute(
            """
            INSERT INTO memories(
                memory_uuid, project_id, session_id, scope, kind, content, summary,
                content_fingerprint, confidence, salience, sensitivity, valid_from_utc,
                valid_until_utc, supersedes_memory_uuid, status, source,
                source_event_uuids_json, generator, created_at_utc
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            tuple(row[key] for key in (
                "memory_uuid", "project_id", "session_id", "scope", "kind", "content", "summary",
                "content_fingerprint", "confidence", "salience", "sensitivity", "valid_from_utc",
                "valid_until_utc", "supersedes_memory_uuid", "status", "source",
                "source_event_uuids_json", "generator", "created_at_utc"
            )),
        )
        memory_id = int(cur.lastrowid)
        for event_uuid in json.loads(row["source_event_uuids_json"]):
            conn.execute(
                "INSERT OR IGNORE INTO memory_sources(memory_uuid, event_uuid) VALUES(?,?)",
                (row["memory_uuid"], event_uuid),
            )
        self._fts_insert_memory(conn, memory_id, row)
        return str(row["memory_uuid"])

    def retract_memory(self, conn: sqlite3.Connection, project_id: str, target_uuid: str, reason: str) -> str:
        target = conn.execute(
            "SELECT * FROM memories WHERE project_id=? AND memory_uuid=?",
            (project_id, target_uuid),
        ).fetchone()
        if not target:
            raise ValueError(f"memory not found: {target_uuid}")
        value = self.add_memory(
            conn,
            project_id=project_id,
            session_id=str(target["session_id"]),
            scope=str(target["scope"]),
            kind=str(target["kind"]),
            content=reason.strip() or f"Retracted memory {target_uuid}",
            confidence=1.0,
            salience=1.0,
            sensitivity=str(target["sensitivity"]),
            source="manual-retraction",
            generator="manual",
            supersedes_memory_uuid=target_uuid,
            status="retraction",
        )
        assert value is not None
        self.rebuild_memory_blocks(conn, project_id)
        return value

    def current_memories(
        self,
        conn: sqlite3.Connection,
        project_id: str,
        *,
        session_id: str | None = None,
        include_project: bool = True,
        limit: int | None = None,
    ) -> list[sqlite3.Row]:
        now = utc_iso()
        clauses = [
            "m.project_id=?",
            "m.status='active'",
            "(m.valid_until_utc IS NULL OR m.valid_until_utc>?)",
            "NOT EXISTS (SELECT 1 FROM memories n WHERE n.project_id=m.project_id AND n.supersedes_memory_uuid=m.memory_uuid)",
        ]
        params: list[Any] = [project_id, now]
        if session_id is None:
            # Safe default: an unspecified session never aggregates session memories
            # from unrelated Claude Code conversations.
            clauses.append("m.scope='project'" if include_project else "0=1")
        else:
            if include_project:
                clauses.append("(m.scope='project' OR (m.scope='session' AND m.session_id=?))")
            else:
                clauses.append("m.scope='session' AND m.session_id=?")
            params.append(session_id)
        sql = "SELECT m.* FROM memories m WHERE " + " AND ".join(clauses) + " ORDER BY m.id"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        return conn.execute(sql, params).fetchall()

    def rebuild_memory_blocks(self, conn: sqlite3.Connection, project_id: str) -> int:
        # The hierarchy is a project-memory projection only. Session memories are
        # intentionally kept raw and scoped to their originating session so a block
        # can never summarize content from another live session.
        rows = [row for row in self.current_memories(conn, project_id) if row["scope"] == "project"]
        conn.execute("DELETE FROM memory_blocks WHERE project_id=?", (project_id,))
        if not rows:
            return 0
        limit = int(self.config.get("memory", {}).get("block_summary_chars", 800))
        nodes: list[dict[str, Any]] = []
        now = utc_iso()
        inserted = 0
        for ordinal, row in enumerate(rows):
            summary = f"[{row['kind']}] {row['summary']}"
            node = {
                "level": 0,
                "start": ordinal,
                "end": ordinal,
                "start_uuid": row["memory_uuid"],
                "end_uuid": row["memory_uuid"],
                "summary": summary,
                "source_hash": sha256_text(row["memory_uuid"] + "\x1f" + summary),
            }
            self._insert_block(conn, project_id, node, now)
            nodes.append(node)
            inserted += 1
        level = 1
        while len(nodes) >= 2:
            next_nodes: list[dict[str, Any]] = []
            for index in range(0, len(nodes) - 1, 2):
                left, right = nodes[index], nodes[index + 1]
                if left["end"] + 1 != right["start"]:
                    continue
                summary = compress_lines((left["summary"], right["summary"]), limit)
                node = {
                    "level": level,
                    "start": left["start"],
                    "end": right["end"],
                    "start_uuid": left["start_uuid"],
                    "end_uuid": right["end_uuid"],
                    "summary": summary,
                    "source_hash": sha256_text(left["source_hash"] + right["source_hash"] + summary),
                }
                self._insert_block(conn, project_id, node, now)
                next_nodes.append(node)
                inserted += 1
            nodes = next_nodes
            level += 1
        return inserted

    @staticmethod
    def _insert_block(conn: sqlite3.Connection, project_id: str, node: dict[str, Any], now: str) -> None:
        conn.execute(
            """
            INSERT INTO memory_blocks(
                project_id, level, start_ordinal, end_ordinal,
                start_memory_uuid, end_memory_uuid, summary, source_hash, created_at_utc
            ) VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (
                project_id,
                node["level"],
                node["start"],
                node["end"],
                node["start_uuid"],
                node["end_uuid"],
                node["summary"],
                node["source_hash"],
                now,
            ),
        )

    def hierarchical_memory_context(
        self,
        conn: sqlite3.Connection,
        project_id: str,
        *,
        session_id: str | None,
    ) -> list[str]:
        include_project = bool(self.config.get("recovery", {}).get("include_project_memories", True))
        all_current = self.current_memories(conn, project_id, session_id=session_id, include_project=include_project)
        project_rows = [row for row in all_current if row["scope"] == "project"]
        session_rows = [row for row in all_current if row["scope"] == "session"]
        cfg = self.config.get("memory", {})
        recent_count = max(0, int(cfg.get("recent_raw_count", 8)))
        max_items = max(1, int(cfg.get("context_items", 24)))
        lines: list[str] = []

        if project_rows:
            cutoff = max(0, len(project_rows) - recent_count)
            pos = 0
            while pos < cutoff:
                remaining = cutoff - pos
                size = 1 << (remaining.bit_length() - 1)
                while size > 1 and pos % size:
                    size //= 2
                level = int(math.log2(size)) if size > 0 else 0
                block = conn.execute(
                    "SELECT summary FROM memory_blocks WHERE project_id=? AND level=? AND start_ordinal=? AND end_ordinal=?",
                    (project_id, level, pos, pos + size - 1),
                ).fetchone()
                if block:
                    lines.append(f"M{pos + 1}-{pos + size}: {block['summary']}")
                else:
                    row = project_rows[pos]
                    lines.append(f"M{pos + 1} [project/{row['kind']}]: {row['summary']}")
                    size = 1
                pos += size
            for ordinal, row in enumerate(project_rows[cutoff:], start=cutoff):
                lines.append(f"M{ordinal + 1} [project/{row['kind']}]: {row['summary']}")

        # Session-scoped memories are never folded into a cross-session block.
        for row in session_rows[-recent_count:]:
            lines.append(f"S [{row['kind']}]: {row['summary']}")

        if len(lines) > max_items:
            old_count = max(1, max_items // 3)
            lines = lines[:old_count] + ["… memory context clipped …"] + lines[-(max_items - old_count - 1):]
        return lines

    def latest_session_id(self, conn: sqlite3.Connection, project_id: str) -> str | None:
        row = conn.execute(
            "SELECT session_id FROM sessions WHERE project_id=? ORDER BY last_event_id DESC LIMIT 1",
            (project_id,),
        ).fetchone()
        return str(row[0]) if row and row[0] else None

    def recent_events(self, conn: sqlite3.Connection, project_id: str, session_id: str, limit: int) -> list[sqlite3.Row]:
        return conn.execute(
            "SELECT * FROM events WHERE project_id=? AND session_id=? ORDER BY id DESC LIMIT ?",
            (project_id, session_id, int(limit)),
        ).fetchall()

    def recent_prompts(self, conn: sqlite3.Connection, project_id: str, session_id: str, limit: int) -> list[sqlite3.Row]:
        return conn.execute(
            "SELECT * FROM events WHERE project_id=? AND session_id=? AND event_type='user_prompt' ORDER BY id DESC LIMIT ?",
            (project_id, session_id, int(limit)),
        ).fetchall()

    def recent_failures(self, conn: sqlite3.Connection, project_id: str, session_id: str, limit: int) -> list[sqlite3.Row]:
        return conn.execute(
            "SELECT * FROM events WHERE project_id=? AND session_id=? AND success=0 ORDER BY id DESC LIMIT ?",
            (project_id, session_id, int(limit)),
        ).fetchall()

    def recent_files(self, conn: sqlite3.Connection, project_id: str, session_id: str, limit: int) -> list[sqlite3.Row]:
        return conn.execute(
            """
            SELECT ef.file_path, ef.operation, ef.sensitivity, e.ts_utc, e.id AS event_id
            FROM event_files ef JOIN events e ON e.id=ef.event_id
            WHERE ef.project_id=? AND ef.session_id=?
            ORDER BY e.id DESC LIMIT ?
            """,
            (project_id, session_id, int(limit)),
        ).fetchall()

    def latest_compact_summary(self, conn: sqlite3.Connection, project_id: str, session_id: str) -> sqlite3.Row | None:
        return conn.execute(
            "SELECT * FROM events WHERE project_id=? AND session_id=? AND event_type='post_compact' ORDER BY id DESC LIMIT 1",
            (project_id, session_id),
        ).fetchone()

    def sessions(self, conn: sqlite3.Connection, project_id: str) -> list[sqlite3.Row]:
        return conn.execute(
            "SELECT * FROM sessions WHERE project_id=? ORDER BY last_event_id DESC",
            (project_id,),
        ).fetchall()

    def search_events(
        self,
        conn: sqlite3.Connection,
        project_id: str,
        query: str,
        *,
        session_id: str | None,
        limit: int = 30,
    ) -> list[sqlite3.Row]:
        query = query.strip()
        if not query:
            return []
        if self.fts_tokenizer(conn) != "none":
            phrase = '"' + query.replace('"', '""') + '"'
            try:
                if session_id is None:
                    rows = conn.execute(
                        """
                        SELECT e.* FROM events_fts f JOIN events e ON e.id=f.rowid
                        WHERE f.project_id=? AND events_fts MATCH ?
                        ORDER BY e.id DESC LIMIT ?
                        """,
                        (project_id, phrase, int(limit)),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        """
                        SELECT e.* FROM events_fts f JOIN events e ON e.id=f.rowid
                        WHERE f.project_id=? AND f.session_id=? AND events_fts MATCH ?
                        ORDER BY e.id DESC LIMIT ?
                        """,
                        (project_id, session_id, phrase, int(limit)),
                    ).fetchall()
                if rows:
                    return rows
            except sqlite3.OperationalError:
                pass
        like = f"%{query}%"
        if session_id is None:
            return conn.execute(
                "SELECT * FROM events WHERE project_id=? AND (summary LIKE ? OR detail_json LIKE ?) ORDER BY id DESC LIMIT ?",
                (project_id, like, like, int(limit)),
            ).fetchall()
        return conn.execute(
            "SELECT * FROM events WHERE project_id=? AND session_id=? AND (summary LIKE ? OR detail_json LIKE ?) ORDER BY id DESC LIMIT ?",
            (project_id, session_id, like, like, int(limit)),
        ).fetchall()

    def search_memories(
        self,
        conn: sqlite3.Connection,
        project_id: str,
        query: str,
        *,
        session_id: str | None,
        limit: int = 30,
    ) -> list[sqlite3.Row]:
        current = {row["memory_uuid"] for row in self.current_memories(conn, project_id, session_id=session_id)}
        if not current:
            return []
        rows: list[sqlite3.Row] = []
        if self.fts_tokenizer(conn) != "none":
            phrase = '"' + query.replace('"', '""') + '"'
            try:
                rows = conn.execute(
                    """
                    SELECT m.* FROM memories_fts f JOIN memories m ON m.id=f.rowid
                    WHERE f.project_id=? AND memories_fts MATCH ?
                    ORDER BY m.id DESC LIMIT ?
                    """,
                    (project_id, phrase, int(limit * 3)),
                ).fetchall()
            except sqlite3.OperationalError:
                rows = []
        if not rows:
            like = f"%{query}%"
            rows = conn.execute(
                "SELECT * FROM memories WHERE project_id=? AND (kind LIKE ? OR content LIKE ?) ORDER BY id DESC LIMIT ?",
                (project_id, like, like, int(limit * 3)),
            ).fetchall()
        return [row for row in rows if row["memory_uuid"] in current][:limit]

    def promote_candidate(
        self, conn: sqlite3.Connection, project_id: str, candidate_id: int, *, scope: str | None = None
    ) -> str:
        row = conn.execute(
            "SELECT * FROM memory_candidates WHERE project_id=? AND id=?",
            (project_id, int(candidate_id)),
        ).fetchone()
        if not row:
            raise ValueError(f"memory candidate not found: {candidate_id}")
        if row["promoted_memory_uuid"]:
            return str(row["promoted_memory_uuid"])
        selected_scope = scope or str(row["scope"])
        if selected_scope not in {"project", "session"}:
            raise ValueError("candidate promotion scope must be project or session")
        memory_uuid = self.add_memory(
            conn,
            project_id=project_id,
            session_id=str(row["session_id"]),
            scope=selected_scope,
            kind=str(row["kind"]),
            content=str(row["content"]),
            confidence=float(row["confidence"]),
            salience=float(row["salience"]),
            source="manual-promotion",
            source_event_uuids=[str(row["source_event_uuid"])],
            generator="candidate-promotion",
        )
        assert memory_uuid is not None
        conn.execute(
            "UPDATE memory_candidates SET promoted_memory_uuid=? WHERE id=?",
            (memory_uuid, int(candidate_id)),
        )
        self.rebuild_memory_blocks(conn, project_id)
        return memory_uuid

    def index_memory_embeddings(
        self,
        conn: sqlite3.Connection,
        project_id: str,
        *,
        session_id: str | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        cfg = semantic_config(self.config)
        rows = self.current_memories(conn, project_id, session_id=session_id)
        pending: list[sqlite3.Row] = []
        for row in rows:
            content_hash = sha256_text(str(row["content"]))
            existing = conn.execute(
                "SELECT model, content_sha256 FROM memory_embeddings WHERE memory_uuid=?",
                (row["memory_uuid"],),
            ).fetchone()
            if force or not existing or existing["content_sha256"] != content_hash or existing["model"] != cfg.model:
                pending.append(row)
        indexed = 0
        dimensions = 0
        indexed_model = cfg.model
        for start in range(0, len(pending), cfg.batch_size):
            batch = pending[start:start + cfg.batch_size]
            model, vectors = embed_texts([str(row["content"]) for row in batch], self.config)
            indexed_model = model
            for row, vector in zip(batch, vectors):
                dimensions = len(vector)
                conn.execute(
                    """
                    INSERT INTO memory_embeddings(
                        memory_uuid, project_id, model, dimensions, vector_json, content_sha256, updated_at_utc
                    ) VALUES(?,?,?,?,?,?,?)
                    ON CONFLICT(memory_uuid) DO UPDATE SET
                        project_id=excluded.project_id, model=excluded.model, dimensions=excluded.dimensions,
                        vector_json=excluded.vector_json, content_sha256=excluded.content_sha256,
                        updated_at_utc=excluded.updated_at_utc
                    """,
                    (
                        row["memory_uuid"], project_id, model, len(vector), canonical_json(vector),
                        sha256_text(str(row["content"])), utc_iso(),
                    ),
                )
                indexed += 1
        return {"current_memories": len(rows), "indexed": indexed, "dimensions": dimensions, "model": indexed_model}

    def semantic_search_memories(
        self,
        conn: sqlite3.Connection,
        project_id: str,
        query: str,
        *,
        session_id: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        current_rows = self.current_memories(conn, project_id, session_id=session_id)
        current = {str(row["memory_uuid"]): row for row in current_rows}
        if not current:
            return []
        model, vectors = embed_texts([query], self.config)
        query_vector = vectors[0]
        scored: list[dict[str, Any]] = []
        for row in conn.execute(
            "SELECT * FROM memory_embeddings WHERE project_id=? AND model=?",
            (project_id, model),
        ):
            memory = current.get(str(row["memory_uuid"]))
            if memory is None or int(row["dimensions"]) != len(query_vector):
                continue
            try:
                vector = [float(item) for item in json.loads(row["vector_json"])]
            except (ValueError, TypeError, json.JSONDecodeError):
                continue
            scored.append({
                "score": cosine_similarity(query_vector, vector),
                "memory": dict(memory),
            })
        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored[: max(1, int(limit))]

    def health(self, conn: sqlite3.Connection) -> dict[str, Any]:
        counts = {
            table: int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
            for table in ("events", "sessions", "memories", "memory_candidates", "memory_embeddings", "memory_blocks")
        }
        integrity = str(conn.execute("PRAGMA quick_check").fetchone()[0])
        journal = str(conn.execute("PRAGMA journal_mode").fetchone()[0])
        return {
            "schema_version": conn.execute("SELECT value FROM schema_meta WHERE key='schema_version'").fetchone()[0],
            "fts_tokenizer": self.fts_tokenizer(conn),
            "journal_mode": journal,
            "integrity": integrity,
            "counts": counts,
            "db_bytes": self.paths.db_path.stat().st_size if self.paths.db_path.exists() else 0,
            "pending_spool": len(list(self.paths.incoming_dir.glob("*.json"))),
            "quarantined_spool": len(list(self.paths.quarantine_dir.glob("*.json"))),
        }

    def verify_hashes(self, conn: sqlite3.Connection, project_id: str) -> dict[str, Any]:
        checked = 0
        failures: list[dict[str, Any]] = []
        for row in conn.execute(
            "SELECT id, event_uuid, detail_json, detail_sha256 FROM events WHERE project_id=? ORDER BY id",
            (project_id,),
        ):
            checked += 1
            actual = sha256_text(str(row["detail_json"]))
            if actual != row["detail_sha256"]:
                failures.append({"id": row["id"], "event_uuid": row["event_uuid"]})
        return {"checked": checked, "failures": failures, "ok": not failures}

    def prune_expired(self, conn: sqlite3.Connection, project_id: str, *, days: int | None = None) -> int:
        if days is None:
            cutoff = utc_iso()
            ids = [
                int(row[0])
                for row in conn.execute(
                    "SELECT id FROM events WHERE project_id=? AND expires_at_utc IS NOT NULL AND expires_at_utc<?",
                    (project_id, cutoff),
                )
            ]
        else:
            cutoff = utc_iso(utc_now() - timedelta(days=max(int(days), 0)))
            ids = [
                int(row[0])
                for row in conn.execute(
                    "SELECT id FROM events WHERE project_id=? AND ts_utc<?",
                    (project_id, cutoff),
                )
            ]
        if not ids:
            return 0
        # Keep each DELETE below conservative SQLite variable limits. The FTS
        # projection is deleted first because it has no trigger relationship to
        # the content table.
        batch_size = 500
        has_fts = self.fts_tokenizer(conn) != "none"
        for start in range(0, len(ids), batch_size):
            batch = ids[start:start + batch_size]
            placeholders = ",".join("?" for _ in batch)
            if has_fts:
                conn.execute(f"DELETE FROM events_fts WHERE rowid IN ({placeholders})", batch)
            conn.execute(f"DELETE FROM events WHERE id IN ({placeholders})", batch)
        return len(ids)

    def export_events(
        self,
        conn: sqlite3.Connection,
        project_id: str,
        *,
        session_id: str | None,
    ) -> list[dict[str, Any]]:
        if session_id is None:
            rows = conn.execute("SELECT * FROM events WHERE project_id=? ORDER BY id", (project_id,)).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM events WHERE project_id=? AND session_id=? ORDER BY id",
                (project_id, session_id),
            ).fetchall()
        return [dict(row) for row in rows]
