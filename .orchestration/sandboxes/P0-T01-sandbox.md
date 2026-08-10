# P0-T01 Sandbox

- Branch: `agent/P0-T01-baseline-revalidation`
- Base: `1f8e12c97cca8604cabaa9f35d5bcb0bfda2c91c`
- Disposable PostgreSQL: Homebrew PostgreSQL 16.14 cluster under `/private/tmp/aiops-p0-t01-pg.Y7kRH6`, loopback port 55432.
- Dedicated databases: `aiops_test`, `aiops_load_test`, `aiops_p001`.
- Before the final full-CI run, all three task-owned databases were dropped and recreated to remove earlier migration-fixture state.
- A temporary `/private/tmp/p0-t01-next-webpack.cjs` shim selected Next's official `--webpack` option for the local runner only; it was not added to the repository.
- The cluster was used only for repository verification and is stopped during task cleanup.
- Network escalation was limited to lockfile-pinned dependency restoration, `pnpm audit`, and GitHub evidence retrieval.
- No implementation, dependency, production configuration, production data/service, merge, force-push, or main-push mutation was performed.
- Pre-existing untracked `.pnpm-store/` and `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip` were not staged or intentionally modified.
