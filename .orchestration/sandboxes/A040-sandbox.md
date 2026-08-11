# A040 sandbox record

- Work was limited to the assigned repository and the three allowed product files.
- No external OpenSandbox environment was required; local workspace isolation and a disposable PostgreSQL 16 cluster in the OS temporary directory were sufficient.
- The temporary database contained only generated test data and was stopped after CI.
- A `pnpm exec` wrapper attempt created an untracked local store directory; it was removed before commit and was not pushed.
- No dependency, GitHub review thread, merge state, or unrelated branch was changed.
