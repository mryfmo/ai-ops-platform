<!-- 根拠: FinalArch:GOV-004, FinalArch:GOV-005 -->

# P0-T04 Sandbox

- Branch: `agent/P0-T04-fitness-checks`
- Base: `f179156588c3f5c83fab89d361f22032956013bf`
- Task-owned PostgreSQL 16 cluster: `/private/tmp/aiops-p0-t04-pg.javZp8`, loopback port `55441`.
- Dedicated databases: `aiops_test`, `aiops_load_test`, and `aiops_p001`.
- The PostgreSQL cluster was stopped after validation and its exact temporary directory was removed.
- P0-T08 immutable review worktrees and disposable test copies were removed after the merge verification completed.
- No production service, tenant, customer data, dependency, schema, merge, force-push, or main direct-push mutation was performed.
- Pre-existing untracked `.pnpm-store/` and `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip` were left untouched.
