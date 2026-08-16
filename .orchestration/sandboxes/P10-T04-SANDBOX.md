# P10-T04 Sandbox Record

- OpenSandbox was unavailable; work used the repository worktree plus exact
  `mktemp -d` directories removed by validated EXIT traps.
- PostgreSQL checks used disposable local PostgreSQL 16 clusters and synthetic
  passwords only. No tenant, production row, endpoint, or database was reached.
- Terraform validation used disposable module copies. Floci ran in an ephemeral
  Apple Container bound to `127.0.0.1:4566` and was deleted after each plan.
- The Terraform guard rejected real/ambient AWS profiles, sessions, credentials,
  endpoints, and injected CLI arguments. No AWS plan, apply, backup, or restore
  operation was executed.
- Network effects were limited to pinned provider download, official AWS
  documentation reads, and GitHub PR metadata reads.
- Existing uncommitted user/orchestrator files were preserved and excluded from
  staging.
