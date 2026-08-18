from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any, Sequence

from .config import load_config
from .hook import process_payload
from .paths import project_paths
from .probe import generate_probes
from .recall import recall
from .recovery import build_recovery_context
from .spool import drain_spool, validate_ingestion_source
from .storage import ContextStore
from .util import atomic_write_text, canonical_json, one_line, pretty_json


def _add_scope(parser: argparse.ArgumentParser, *, default: str = "session") -> None:
    parser.add_argument("--session", help="exact Claude Code session_id")
    parser.add_argument(
        "--scope",
        choices=("session", "project"),
        default=default,
        help="session is the safe default; project must be explicit",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="contextdb",
        description="Compaction-safe event ledger and durable-memory CLI",
    )
    parser.add_argument("--project-root", help="project root; defaults to CLAUDE_PROJECT_DIR or cwd")
    parser.add_argument("--json", action="store_true", help="machine-readable JSON output where supported")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("recent", help="recent events")
    p.add_argument("limit", type=int, nargs="?", default=30)
    _add_scope(p)

    p = sub.add_parser("prompts", help="recent user prompts")
    p.add_argument("limit", type=int, nargs="?", default=10)
    _add_scope(p)

    p = sub.add_parser("search", help="search event summaries and details")
    p.add_argument("query", nargs="+")
    p.add_argument("--limit", type=int, default=30)
    _add_scope(p)

    p = sub.add_parser("show", help="show one event by numeric id")
    p.add_argument("event_id", type=int)
    _add_scope(p)

    p = sub.add_parser("files", help="files referenced or changed")
    p.add_argument("--limit", type=int, default=100)
    _add_scope(p)

    sub.add_parser("sessions", help="project session list")

    p = sub.add_parser("recover", help="render the same recovery context used after compaction")
    p.add_argument("--session", required=True)

    p = sub.add_parser("probe", help="generate deterministic recovery probes with ground truth")
    p.add_argument("--session", required=True)
    p.add_argument("--json", action="store_true", default=argparse.SUPPRESS)

    p = sub.add_parser("recall", help="retrieve fused lexical and optional semantic context")
    p.add_argument("query")
    p.add_argument("--session")
    p.add_argument("--k", type=int)
    p.add_argument("--json", action="store_true", default=argparse.SUPPRESS)

    sub.add_parser("health", help="database, spool, and integrity summary")
    sub.add_parser("drain", help="drain pending spool records")
    sub.add_parser("verify", help="verify SQLite and event detail hashes")

    p = sub.add_parser("prune", help="delete expired raw events; durable memories remain")
    p.add_argument("--days", type=int, help="override retention and remove events older than N days")

    p = sub.add_parser("export", help="export redacted raw events as JSONL")
    p.add_argument("--session")
    p.add_argument("--scope", choices=("session", "project"), default="session")
    p.add_argument("--output", help="output file; stdout when omitted")

    p = sub.add_parser("ingest", help="ingest one hook-compatible JSON object from a file or stdin")
    p.add_argument("source", nargs="?", default="-", help="JSON file or - for stdin")
    p.add_argument("--ingested-from", help="trusted local ingestion source token")

    memory = sub.add_parser("memory", help="durable-memory operations")
    memsub = memory.add_subparsers(dest="memory_command", required=True)

    p = memsub.add_parser("list", help="list current, non-superseded memories")
    p.add_argument("--session")
    p.add_argument("--limit", type=int, default=100)

    p = memsub.add_parser("search", help="search current memories")
    p.add_argument("query", nargs="+")
    p.add_argument("--session")
    p.add_argument("--limit", type=int, default=30)

    p = memsub.add_parser("candidates", help="list unpromoted memory candidates")
    p.add_argument("--limit", type=int, default=100)

    p = memsub.add_parser("promote", help="promote a candidate to durable memory")
    p.add_argument("candidate_id", type=int)
    p.add_argument("--scope", choices=("project", "session"), help="override candidate scope; project is explicit cross-session promotion")

    p = memsub.add_parser("add", help="add an explicit durable memory")
    p.add_argument("--kind", required=True)
    p.add_argument("--content", required=True)
    p.add_argument("--scope", choices=("project", "session"), default="project")
    p.add_argument("--session")
    p.add_argument("--confidence", type=float, default=1.0)
    p.add_argument("--salience", type=float, default=0.9)
    p.add_argument("--supersedes")

    p = memsub.add_parser("retract", help="append a retraction that supersedes a memory")
    p.add_argument("memory_uuid")
    p.add_argument("--reason", required=True)

    p = memsub.add_parser("embed", help="build or refresh optional external semantic embeddings")
    p.add_argument("--session")
    p.add_argument("--force", action="store_true")

    p = memsub.add_parser("semantic-search", help="search memories by optional external embeddings")
    p.add_argument("query", nargs="+")
    p.add_argument("--session")
    p.add_argument("--limit", type=int, default=10)

    memsub.add_parser("compact", help="rebuild hierarchical project-memory projections")
    return parser


def _format_event(row: Any) -> str:
    tool = f" [{row['tool_name']}]" if row["tool_name"] else ""
    return f"#{row['id']} {row['ts_utc']} ({row['event_type']}){tool} {row['summary']}"


def _resolve_session(store: ContextStore, conn: Any, requested: str | None, scope: str) -> str | None:
    if scope == "project":
        return None
    value = requested or store.latest_session_id(conn, store.paths.project_id)
    if not value:
        raise ValueError("no session is available; pass --session <session_id> or use --scope project")
    return value


def _rows_json(rows: Sequence[Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def _print_json_or_lines(args: argparse.Namespace, value: Any, lines: Sequence[str]) -> None:
    if args.json:
        print(pretty_json(value))
    else:
        print("\n".join(lines))


def run(args: argparse.Namespace) -> int:
    paths = project_paths(explicit=args.project_root)
    config = load_config(paths)
    store = ContextStore(paths, config)

    if args.command == "ingest":
        ingested_from = validate_ingestion_source(args.ingested_from) if args.ingested_from is not None else None
        raw = sys.stdin.read() if args.source == "-" else Path(args.source).read_text(encoding="utf-8")
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("ingest input must be a JSON object")
        process_payload(payload, project_root=str(paths.root), ingested_from=ingested_from)
        result = drain_spool(paths, config, blocking_lock=True)
        _print_json_or_lines(args, result.__dict__, [f"ingested={result.inserted} pending={result.remaining}"])
        return 0

    if args.command == "drain":
        result = drain_spool(paths, config, blocking_lock=True)
        _print_json_or_lines(
            args,
            result.__dict__,
            [
                f"acquired={result.acquired} processed={result.processed} inserted={result.inserted} ",
                f"duplicates={result.duplicates} quarantined={result.quarantined} remaining={result.remaining}",
            ],
        )
        return 0

    if args.command == "probe":
        conn = store.connect(initialize=False)
        try:
            result = {"probes": generate_probes(store, conn, session_id=args.session)}
        finally:
            conn.close()
        _print_json_or_lines(
            args,
            result,
            [
                f"[{probe['type']}] {probe['question']}\n{probe['ground_truth']}"
                for probe in result["probes"]
            ]
            or ["No probes."],
        )
        return 0

    if args.command == "recall":
        recall_config = config["recall"]
        limit = int(recall_config["k"] if args.k is None else args.k)
        if limit < 0:
            raise ValueError("recall --k must be an integer >= 0")
        conn = store.connect(initialize=False)
        try:
            results = recall(
                store,
                conn,
                args.query,
                session_id=args.session,
                k=limit,
                rho=float(recall_config["rho"]),
            )
        finally:
            conn.close()
        _print_json_or_lines(
            args,
            results,
            [
                f"{row['score']:.6f} {row['ts']} {row['kind']} {row['summary']}"
                for row in results
            ]
            or ["No matches."],
        )
        return 0

    # Every read path first gives pending, already-redacted spool records a chance to settle.
    drain_spool(paths, config, blocking_lock=False)
    conn = store.connect()
    try:
        project_id = paths.project_id

        if args.command == "recent":
            session = _resolve_session(store, conn, args.session, args.scope)
            if session is None:
                rows = conn.execute(
                    "SELECT * FROM events WHERE project_id=? ORDER BY id DESC LIMIT ?",
                    (project_id, args.limit),
                ).fetchall()
            else:
                rows = store.recent_events(conn, project_id, session, args.limit)
            _print_json_or_lines(args, _rows_json(rows), [_format_event(row) for row in rows] or ["No events."])

        elif args.command == "prompts":
            session = _resolve_session(store, conn, args.session, args.scope)
            if session is None:
                rows = conn.execute(
                    "SELECT * FROM events WHERE project_id=? AND event_type='user_prompt' ORDER BY id DESC LIMIT ?",
                    (project_id, args.limit),
                ).fetchall()
            else:
                rows = store.recent_prompts(conn, project_id, session, args.limit)
            if args.json:
                print(pretty_json(_rows_json(rows)))
            elif not rows:
                print("No user prompts.")
            else:
                for row in rows:
                    detail = json.loads(row["detail_json"])
                    print(f"--- #{row['id']} {row['ts_utc']} session={row['session_id']} ---")
                    print(detail.get("prompt", row["summary"]))

        elif args.command == "search":
            session = _resolve_session(store, conn, args.session, args.scope)
            rows = store.search_events(conn, project_id, " ".join(args.query), session_id=session, limit=args.limit)
            _print_json_or_lines(args, _rows_json(rows), [_format_event(row) for row in rows] or ["No matches."])

        elif args.command == "show":
            row = conn.execute("SELECT * FROM events WHERE project_id=? AND id=?", (project_id, args.event_id)).fetchone()
            if not row:
                raise ValueError(f"event not found: {args.event_id}")
            session = _resolve_session(store, conn, args.session, args.scope)
            if session is not None and row["session_id"] != session:
                raise ValueError(
                    f"event #{args.event_id} belongs to a different session; pass its --session explicitly or use --scope project"
                )
            if args.json:
                print(pretty_json(dict(row)))
            else:
                print(_format_event(row))
                print("-" * 72)
                print(row["detail_json"])

        elif args.command == "files":
            session = _resolve_session(store, conn, args.session, args.scope)
            if session is None:
                rows = conn.execute(
                    """
                    SELECT ef.file_path, ef.operation, ef.sensitivity, e.ts_utc, e.id AS event_id, e.session_id
                    FROM event_files ef JOIN events e ON e.id=ef.event_id
                    WHERE ef.project_id=? ORDER BY e.id DESC LIMIT ?
                    """,
                    (project_id, args.limit),
                ).fetchall()
            else:
                rows = store.recent_files(conn, project_id, session, args.limit)
            unique: dict[str, Any] = {}
            for row in rows:
                unique.setdefault(row["file_path"], row)
            selected = list(unique.values())
            _print_json_or_lines(
                args,
                _rows_json(selected),
                [f"#{row['event_id']} [{row['operation']}] {row['file_path']}" for row in selected] or ["No file records."],
            )

        elif args.command == "sessions":
            rows = store.sessions(conn, project_id)
            _print_json_or_lines(
                args,
                _rows_json(rows),
                [
                    f"{row['session_id']} events-through=#{row['last_event_id']} "
                    f"{row['started_at_utc'] or '?'} ~ {row['ended_at_utc'] or 'active'}"
                    for row in rows
                ] or ["No sessions."],
            )

        elif args.command == "recover":
            context = build_recovery_context(store, conn, session_id=args.session)
            print(pretty_json({"session_id": args.session, "context": context}) if args.json else context)

        elif args.command == "health":
            health = store.health(conn)
            _print_json_or_lines(args, health, [pretty_json(health)])

        elif args.command == "verify":
            health = store.health(conn)
            hashes = store.verify_hashes(conn, project_id)
            result = {"health": health, "event_hashes": hashes, "ok": health["integrity"] == "ok" and hashes["ok"]}
            _print_json_or_lines(args, result, [pretty_json(result)])
            return 0 if result["ok"] else 2

        elif args.command == "prune":
            with conn:
                removed = store.prune_expired(conn, project_id, days=args.days)
            result = {"removed_events": removed, "days_override": args.days}
            _print_json_or_lines(args, result, [f"removed_events={removed}"])

        elif args.command == "export":
            session = _resolve_session(store, conn, args.session, args.scope)
            rows = store.export_events(conn, project_id, session_id=session)
            text = "".join(canonical_json(row) + "\n" for row in rows)
            if args.output:
                atomic_write_text(Path(args.output).expanduser(), text, 0o600)
                print(f"exported={len(rows)} path={args.output}")
            else:
                sys.stdout.write(text)

        elif args.command == "memory":
            return _run_memory(args, store, conn)

        else:
            raise ValueError(f"unsupported command: {args.command}")
    finally:
        conn.close()
    return 0


def _run_memory(args: argparse.Namespace, store: ContextStore, conn: Any) -> int:
    project_id = store.paths.project_id
    command = args.memory_command
    if command == "list":
        rows = store.current_memories(conn, project_id, session_id=args.session, limit=args.limit)
        if args.json:
            print(pretty_json(_rows_json(rows)))
        else:
            for row in rows:
                print(
                    f"{row['memory_uuid']} [{row['scope']}/{row['kind']}] "
                    f"confidence={row['confidence']:.2f} salience={row['salience']:.2f} {row['summary']}"
                )
            if not rows:
                print("No active memories.")
    elif command == "search":
        rows = store.search_memories(
            conn,
            project_id,
            " ".join(args.query),
            session_id=args.session,
            limit=args.limit,
        )
        _print_json_or_lines(
            args,
            _rows_json(rows),
            [f"{row['memory_uuid']} [{row['scope']}/{row['kind']}] {row['summary']}" for row in rows] or ["No matches."],
        )
    elif command == "candidates":
        rows = conn.execute(
            "SELECT * FROM memory_candidates WHERE project_id=? AND promoted_memory_uuid IS NULL ORDER BY id DESC LIMIT ?",
            (project_id, args.limit),
        ).fetchall()
        _print_json_or_lines(
            args,
            _rows_json(rows),
            [f"#{row['id']} [{row['kind']}] confidence={row['confidence']:.2f} {one_line(row['content'], 500)}" for row in rows]
            or ["No unpromoted candidates."],
        )
    elif command == "promote":
        with conn:
            memory_uuid = store.promote_candidate(conn, project_id, args.candidate_id, scope=args.scope)
        print(pretty_json({"memory_uuid": memory_uuid}) if args.json else memory_uuid)
    elif command == "add":
        with conn:
            memory_uuid = store.add_memory(
                conn,
                project_id=project_id,
                session_id=args.session or "",
                scope=args.scope,
                kind=args.kind,
                content=args.content,
                confidence=args.confidence,
                salience=args.salience,
                source="manual-cli",
                generator="manual-cli",
                supersedes_memory_uuid=args.supersedes,
            )
            store.rebuild_memory_blocks(conn, project_id)
        print(pretty_json({"memory_uuid": memory_uuid}) if args.json else memory_uuid)
    elif command == "retract":
        with conn:
            memory_uuid = store.retract_memory(conn, project_id, args.memory_uuid, args.reason)
        print(pretty_json({"retraction_memory_uuid": memory_uuid}) if args.json else memory_uuid)
    elif command == "embed":
        with conn:
            result = store.index_memory_embeddings(
                conn, project_id, session_id=args.session, force=args.force
            )
        _print_json_or_lines(args, result, [pretty_json(result)])
    elif command == "semantic-search":
        results = store.semantic_search_memories(
            conn, project_id, " ".join(args.query), session_id=args.session, limit=args.limit
        )
        if args.json:
            print(pretty_json(results))
        elif not results:
            print("No semantic matches. Build embeddings with `memory embed` first.")
        else:
            for item in results:
                memory = item["memory"]
                print(f"score={item['score']:.4f} {memory['memory_uuid']} [{memory['scope']}/{memory['kind']}] {memory['summary']}")
    elif command == "compact":
        with conn:
            count = store.rebuild_memory_blocks(conn, project_id)
        result = {"memory_blocks": count}
        _print_json_or_lines(args, result, [f"memory_blocks={count}"])
    else:
        raise ValueError(f"unsupported memory command: {command}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return run(args)
    except (ValueError, OSError, sqlite3.Error, json.JSONDecodeError) as exc:
        print(f"contextdb: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
