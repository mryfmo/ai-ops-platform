# BOT-FIX-272 Validation

Full verbatim CI logs:

- initial format failure: `BOT-FIX-272-ci-format-failure.log`
- successful rerun: `BOT-FIX-272-ci-success.log`
- final staged rerun: `BOT-FIX-272-ci-final.log`

## RED: credential-shaped metadata

Command: `uv run python .claude/contextdb/self_check.py`

```text
test_credential_shaped_metadata_is_not_persisted_raw (__main__.ContextDbSelfCheck.test_credential_shaped_metadata_is_not_persisted_raw) ... FAIL

======================================================================
FAIL: test_credential_shaped_metadata_is_not_persisted_raw (__main__.ContextDbSelfCheck.test_credential_shaped_metadata_is_not_persisted_raw)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/mryfmo/Workspace/ai-ops-platform/.claude/contextdb/self_check.py", line 40, in test_credential_shaped_metadata_is_not_persisted_raw
    self.assertNotIn(secret, persisted)
AssertionError: 'github_pat_abcdefghijklmnopqrstuvwxyz0123456789' unexpectedly found in '[[["github_pat_abcdefghijklmnopqrstuvwxyz0123456789", "github_pat_abcdefghijklmnopqrstuvwxyz0123456789", "github_pat_abcdefghijklmnopqrstuvwxyz0123456789"]], [["github_pat_abcdefghijklmnopqrstuvwxyz0123456789"]]]'

----------------------------------------------------------------------
Ran 1 test in 0.017s

FAILED (failures=1)
```

## GREEN: credential-shaped metadata

Command: `uv run python .claude/contextdb/self_check.py`

```text
test_credential_shaped_metadata_is_not_persisted_raw (__main__.ContextDbSelfCheck.test_credential_shaped_metadata_is_not_persisted_raw) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.026s

OK
```

## Portability and canonical-file check

```text
portable hooks: 15; ADR-0031 headers: 20; CLAUDE.md canonical import: ok
```

## Compile check

Command: `python3 -m compileall -q .claude/contextdb .claude/hooks`

```text
```

Exit code: 0.

## ContextDB integrity

Commands: `python3 .claude/hooks/contextdb_cli.py verify` and `python3 .claude/hooks/contextdb_cli.py health`

```text
{
  "event_hashes": {
    "checked": 17,
    "failures": [],
    "ok": true
  },
  "health": {
    "counts": {
      "events": 17,
      "memories": 0,
      "memory_blocks": 0,
      "memory_candidates": 2,
      "memory_embeddings": 0,
      "sessions": 1
    },
    "db_bytes": 503808,
    "fts_tokenizer": "trigram",
    "integrity": "ok",
    "journal_mode": "wal",
    "pending_spool": 0,
    "quarantined_spool": 0,
    "schema_version": "1"
  },
  "ok": true
}
```

## Full CI first run

Command: fresh PostgreSQL 16 on port 55482 + `CI=true mise run ci`.

```text
Checking formatting...
[warn] .claude/contextdb/config.json
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
[ELIFECYCLE] Command failed with exit code 1.
[format] ERROR task failed
[ci] ERROR task failed
```

Full verbatim output: `BOT-FIX-272-ci-format-failure.log`.

## Full CI successful rerun

Command: separate fresh PostgreSQL 16 on port 55483 + `CI=true mise run ci`.

```text
All matched files use Prettier code style!
packages/channel-teams test:coverage: Test Files  4 passed (4)
packages/channel-teams test:coverage: Tests  65 passed (65)
packages/shared test:coverage: Test Files  29 passed (29)
packages/shared test:coverage: Tests  498 passed (498)
packages/traceability test:coverage: Test Files  1 passed (1)
packages/traceability test:coverage: Tests  129 passed (129)
packages/devops test:coverage: Test Files  21 passed (21)
packages/devops test:coverage: Tests  216 passed (216)
packages/integrations test:coverage: Test Files  9 passed (9)
packages/integrations test:coverage: Tests  71 passed (71)
packages/prjops test:coverage: Test Files  26 passed (26)
packages/prjops test:coverage: Tests  367 passed (367)
packages/control-plane test:coverage: Test Files  37 passed (37)
packages/control-plane test:coverage: Tests  354 passed (354)
packages/web test:coverage: Test Files  44 passed (44)
packages/web test:coverage: Tests  365 passed (365)
packages/server test:coverage: Test Files  91 passed (91)
packages/server test:coverage: Tests  977 passed (977)
P001 PostgreSQL integration passed
```

Exit code: 0. Full verbatim output: `BOT-FIX-272-ci-success.log`.

## Full CI final staged rerun

Command: separate fresh PostgreSQL 16 on port 55484 + `CI=true mise run ci` after the final self-check fixture update.

```text
All matched files use Prettier code style!
packages/channel-teams test:coverage: Test Files  4 passed (4)
packages/channel-teams test:coverage: Tests  65 passed (65)
packages/shared test:coverage: Test Files  29 passed (29)
packages/shared test:coverage: Tests  498 passed (498)
packages/traceability test:coverage: Test Files  1 passed (1)
packages/traceability test:coverage: Tests  129 passed (129)
packages/devops test:coverage: Test Files  21 passed (21)
packages/devops test:coverage: Tests  216 passed (216)
packages/integrations test:coverage: Test Files  9 passed (9)
packages/integrations test:coverage: Tests  71 passed (71)
packages/prjops test:coverage: Test Files  26 passed (26)
packages/prjops test:coverage: Tests  367 passed (367)
packages/control-plane test:coverage: Test Files  37 passed (37)
packages/control-plane test:coverage: Tests  354 passed (354)
packages/web test:coverage: Test Files  44 passed (44)
packages/web test:coverage: Tests  365 passed (365)
packages/server test:coverage: Test Files  91 passed (91)
packages/server test:coverage: Tests  977 passed (977)
P001 PostgreSQL integration passed
```

Exit code: 0. Full verbatim output: `BOT-FIX-272-ci-final.log`.

## Diff and review gate

```text
$ git diff --check

$ make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
```

## Git and decision evidence

```text
$ git log -1 --format='%H %s'  # on task branch before returning to main
72cd8a988d17403b1c0115bdd32092319abce792 fix(compactiondb): harden portable persistence boundary

$ git status --porcelain=v1  # task branch: implementation clean; expected artifacts remain untracked
?? .orchestration/autoskill/runs/BOT-FIX-272.md
?? .orchestration/learning/BOT-FIX-272-learning.md
?? .orchestration/reports/BOT-FIX-272-REPORT.md
?? .orchestration/sandboxes/BOT-FIX-272-SANDBOX.md
?? .orchestration/tasks/BOT-FIX-272-compactiondb-hardening.md
?? .orchestration/validation/BOT-FIX-272-validation.md
?? .pnpm-store/
?? references/ai-ops-platform-final-implementation-pack_2026-08-09.zip
?? references/ai-ops-platform-jira-fixed.zip

$ git branch --show-current  # after completion
main
```

CompactionDB command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'BOT-FIX-272: CompactionDB remains project-local opt-in; hook commands use python3 plus ${CLAUDE_PROJECT_DIR:-.}; all persisted hook metadata is derived from the sanitizer output; ledger/spool/health and bytecode stay uncommitted.'
```

Output / verified persisted row:

```text
1039f4c2-1450-4c39-bd06-d21e9637eb65
1039f4c2-1450-4c39-bd06-d21e9637eb65|decision|project|BOT-FIX-272: CompactionDB remains project-local opt-in; hook commands use python3 plus ${CLAUDE_PROJECT_DIR:-.}; all persisted hook metadata is derived from the sanitizer output; ledger/spool/health and bytecode stay uncommitted.
```
