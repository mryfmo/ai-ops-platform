# P8-T07 Sandbox

- Worktree: shared repository, isolated branch `agent/P8-T07-writer-reviewer-handoff` from latest main.
- Database: disposable PostgreSQL 16 clusters under `/private/tmp`; fresh test/load/P001 databases only; clusters stopped by shell traps.
- Network and credentials: no application network calls, production access, provider credentials, or dependency installation.
- GitHub: `gh pr view 268` was read-only; no push, approval, merge, PR creation, or branch update.
- Scope: only P8-T07 workflow, repository, schema/migration, tests, and orchestration evidence are staged. PR #268 files and unrelated untracked files remain untouched.
