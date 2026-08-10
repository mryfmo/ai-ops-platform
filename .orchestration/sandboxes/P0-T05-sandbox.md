<!-- 根拠: PrjOps:REQ-030 / PrjOps:REQ-041 / PrjOps:REQ-042 -->

# P0-T05 Sandbox

- Branch: `agent/P0-T05-perf-baseline`
- Base: `e41e6e67cf5f42b70b8aa0b15c2b2266fcdd3862`
- Task-owned PostgreSQL 16.14 cluster: `/private/tmp/aiops-p0-t05-pg.6qbrUJ`, loopback port 55434.
- Dedicated databases: `aiops_load`, `aiops_test`, `aiops_p001`.
- Initial loopback access from the sandbox failed with `EPERM`; only approved sandbox-external commands accessed the same local task-owned cluster.
- All three databases were dropped and recreated before the final full-CI run so earlier load/migration state could not contaminate the result.
- A temporary `/private/tmp/p0-t05-next-webpack.cjs` shim selected Next's official `--webpack` option for local full CI only; it was not added to the repository.
- The PostgreSQL cluster was stopped and the temporary shim removed after validation.
- No production service, tenant, mailbox, provider, credential, or data was accessed.
- No implementation, dependency, production configuration, merge, force-push, or main direct-push mutation was performed.
- Pre-existing untracked `.pnpm-store/` and `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip` were left untouched.
