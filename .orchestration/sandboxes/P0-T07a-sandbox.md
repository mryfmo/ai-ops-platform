<!-- 根拠: ENV-DEC-001 / ADR-0029 -->

# P0-T07a Sandbox

- Branch: `agent/P0-T07a-canonical-amendments`.
- Base: `8b42a88ce01ba98d539d0b89b7bd9e8f87600ba7`.
- Fresh PostgreSQL 16 cluster:
  `/private/tmp/aiops-p0-t07a-pg.fcIDK6`, loopback port `55445`.
- Dedicated databases: `aiops_test`, `aiops_load_test`, and `aiops_p001`.
- The cluster was stopped after CI and port `55445` returned `no response`.
- The task used repository-local documentation and tests only; no cloud,
  M365, tenant, credential, or production resource was accessed.
- No main push, force-push, merge, dependency change, implementation change,
  or ADR/ENV-DEC body change was performed.
