# 根拠: ADR-0031 — CompactionDB の永続化前 sanitization 境界を自己検証する。
from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))

from contextdb.config import load_config  # noqa: E402
from contextdb.normalize import normalize_hook_payload  # noqa: E402
from contextdb.paths import project_paths  # noqa: E402
from contextdb.spool import drain_spool, spool_event  # noqa: E402


class ContextDbSelfCheck(unittest.TestCase):
    def test_credential_shaped_metadata_is_not_persisted_raw(self) -> None:
        secret = "github" + "_pat_" + "abcdefghijklmnopqrstuvwxyz0123456789"
        with tempfile.TemporaryDirectory() as directory:
            paths = project_paths(explicit=directory)
            config = load_config(paths)
            event = normalize_hook_payload(
                {
                    "hook_event_name": "SessionStart",
                    "session_id": secret,
                    "agent_id": secret,
                    "tool_use_id": secret,
                    "cwd": directory,
                },
                paths,
                config,
            )
            spool_path = spool_event(paths, event)
            self.assertNotIn(secret, spool_path.read_text(encoding="utf-8"))
            self.assertEqual(drain_spool(paths, config).inserted, 1)

            base = paths.base
            with sqlite3.connect(base / "state" / "context.db") as connection:
                event_metadata = connection.execute(
                    "SELECT session_id, agent_id, tool_use_id FROM events"
                ).fetchall()
                session_metadata = connection.execute("SELECT session_id FROM sessions").fetchall()

            persisted = json.dumps([event_metadata, session_metadata])
            self.assertNotIn(secret, persisted)
            self.assertIn("[REDACTED:github-token]", persisted)


if __name__ == "__main__":
    unittest.main(verbosity=2)
