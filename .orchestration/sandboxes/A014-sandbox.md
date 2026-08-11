# A014 Sandbox

- Reused the dependency-populated linked worktree and created
  `agent/p010-f02-t03-stable-subject` from accepted `origin/main` commit
  `c2c7e2da78708c28b65f61478d4081584c3551ff`.
- The linked worktree isolated A014 from the dirty primary checkout.
- PostgreSQL 16.14 disposable clusters were created only under `/private/tmp`,
  listened only on port 55432, and never used or changed the Homebrew system
  service.
- The final instance was stopped with `pg_ctl`, its complete temporary directory
  was removed, and `pg_isready` returned `no response` for port 55432.
- The primary checkout was used only for exact A014 orchestration artifacts.
- No dependency, worklog, `docs/audit`, system PostgreSQL service, audit mutation
  grant, LLM API, browser Crit, user review request, direct `main` push, or merge
  was performed.
