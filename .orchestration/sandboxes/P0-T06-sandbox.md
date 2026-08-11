<!-- 根拠: GOV-003 -->

# P0-T06 Sandbox

- Branch: `agent/P0-T06-license-inventory`
- Base: `192889a0c499a431548ae885cfc412d2dc4e6038`
- Official-source access was read-only through GitHub APIs and public vendor
  documentation/legal pages.
- Task-owned PostgreSQL 16.14 cluster:
  `/private/tmp/aiops-p0-t06-pg.ZPYHZ1`, loopback port `55439`.
- Dedicated databases: `aiops_test`, `aiops_load_test`, and `aiops_p001`.
- The cluster was stopped, port `55439` returned `no response`, and the exact
  temporary directory was removed after validation.
- No production service, tenant, mailbox, provider credential, customer data,
  or signed contract was accessed.
- No implementation, dependency, production configuration, merge, force-push,
  or main direct-push mutation was performed.
- Pre-existing untracked `.pnpm-store/` and
  `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip` were
  left untouched.

