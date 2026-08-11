# A037 sandbox record

- Work was limited to the assigned repository and the five allowed product/generated files.
- No external OpenSandbox environment was required; local workspace isolation and a disposable PostgreSQL 16 cluster in the OS temporary directory were sufficient.
- The temporary database contained only generated test data and was stopped after CI.
- `codex review` created an untracked `.pnpm-store`; it was moved out of the repository before commit and was not pushed.
- The branch was pushed normally through SSH. GitHub API operations used orchestrator-approved escalated execution after diagnostics proved sandbox network denial.
- No holiday data, dependency, GitHub review thread, merge state, or unrelated branch was changed.
- Revision CI reused the disposable PostgreSQL cluster on port 55439 and stopped it cleanly afterward.
- A pnpm shim non-TTY check created `.pnpm-store`; it was moved to `/private/tmp` and was never staged.
