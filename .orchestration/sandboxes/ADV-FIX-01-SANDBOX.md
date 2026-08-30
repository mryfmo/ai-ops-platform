# ADV-FIX-01 Sandbox

- Worktree branch: `agent/ADV-FIX-01`, created from latest `origin/main`.
- PostgreSQL: disposable local PostgreSQL 16 cluster under `/private/tmp`, with separate test/load/P001 databases; stopped by shell trap.
- Network: only authorized GitHub branch pushes, non-draft PR maintenance, checks inspection, and bot P1 inline reply; no application external calls or LLM calls.
- Credentials: no credential values read or written. Synthetic secret-shaped fixtures are assembled at runtime to avoid repository secret literals.
- Scope: only task-allowed code/tests and ADV-FIX-01 evidence are committed. Existing untracked task/context/package-cache/reference files remain untouched.
- Persistent effects: remote branch `agent/ADV-FIX-01` and open PR #271. Reversal: close PR #271 and delete the remote branch after preserving review history if the Owner rejects the change.
