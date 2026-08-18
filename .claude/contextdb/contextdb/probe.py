from __future__ import annotations

import sqlite3

from .recovery import _detail, _modified_files
from .storage import ContextStore
from .util import one_line


def generate_probes(
    store: ContextStore,
    conn: sqlite3.Connection,
    *,
    session_id: str,
) -> list[dict[str, str]]:
    project_id = store.paths.project_id
    probes: list[dict[str, str]] = []

    failure = conn.execute(
        """
        SELECT summary FROM events
        WHERE project_id=? AND session_id=? AND hook_event_name='PostToolUseFailure'
        ORDER BY id LIMIT 1
        """,
        (project_id, session_id),
    ).fetchone()
    if failure is None:
        failure = conn.execute(
            "SELECT summary FROM events WHERE project_id=? AND session_id=? AND success=0 ORDER BY id LIMIT 1",
            (project_id, session_id),
        ).fetchone()
    if failure and str(failure["summary"]).strip():
        probes.append(
            {
                "type": "recall",
                "question": "What was the first error in this session?",
                "ground_truth": str(failure["summary"]),
            }
        )

    files = _modified_files(conn, project_id, session_id, maximum=2**63 - 1)
    if files:
        probes.append(
            {
                "type": "artifact",
                "question": "Which files were modified in this session?",
                "ground_truth": files,
            }
        )

    decisions = [
        f"[{row['scope']}/decision] {row['summary']}"
        for row in store.current_memories(conn, project_id, session_id=session_id, include_project=True)
        if row["kind"] == "decision"
    ]
    if decisions:
        probes.append(
            {
                "type": "decision",
                "question": "What decisions were made?",
                "ground_truth": "\n".join(decisions),
            }
        )

    open_tasks = [
        f"[{row['scope']}/open_task] {row['summary']}"
        for row in store.current_memories(
            conn,
            project_id,
            session_id=session_id,
            include_project=bool(store.config.get("recovery", {}).get("include_project_memories", True)),
        )
        if row["kind"] == "open_task"
    ]
    task_rows = conn.execute(
        """
        SELECT * FROM events
        WHERE project_id=? AND session_id=? AND event_type IN ('task_created', 'task_completed')
        ORDER BY id
        """,
        (project_id, session_id),
    ).fetchall()
    active_tasks: dict[str, tuple[int, str]] = {}
    for row in task_rows:
        detail = _detail(row)
        task_id = str(detail.get("task_id") or "")
        if not task_id:
            continue
        if row["event_type"] == "task_created":
            active_tasks[task_id] = (
                int(row["id"]),
                one_line(str(detail.get("task_subject") or "Task"), 500),
            )
        else:
            active_tasks.pop(task_id, None)
    open_tasks.extend(
        f"{subject} ({task_id})"
        for task_id, (_, subject) in sorted(active_tasks.items(), key=lambda item: item[1][0], reverse=True)
    )
    if open_tasks:
        probes.append(
            {
                "type": "continuation",
                "question": "What remains to be done?",
                "ground_truth": "\n".join(open_tasks),
            }
        )

    return probes
