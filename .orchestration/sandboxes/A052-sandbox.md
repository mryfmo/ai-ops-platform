<!-- 根拠: DevOps:REQ-003 / DevOps:REQ-010 / DevOps:REQ-012 / TH-001 / TH-003 / AC-010a -->

# A052 sandbox

- Branch: `agent/a052-agt-dep-wiring` from accepted main `18dfcc951c77c4501ff89ec3f4bb1afcf26822f1`.
- Original allowlist was extended by four explicit rulings for `.github/workflows/ci.yml`, GitHub client/tests, approval/deployment schema and migration, AGT_CHG/tests, and deployments repo/tests.
- No `deploy-prod.yml`, cron, dependency, unrelated source, or specification body was created or changed.
- D-04/D-16 unavailable inputs remain injected `null` seams and explicit degraded capabilities; no fixed coverage, Critical count, RED sample, stable version, or repository target is fabricated.
- Artifact reads are capped at 64,000 bytes and one ZIP entry. Monitoring reads are capped at 100 rows per 60-second tick.
- Real validation used disposable PostgreSQL 16 data at `/private/tmp/aiops-a052-pg.sLml5X` on port 55441 with isolated `aiops_test`, `aiops_load_test`, `aiops_p001`, and `aiops_a052_claim` databases.
- GitHub access is limited to the authorized `gh` operations needed to resolve the pinned official action SHA and publish/verify the A052 PR.
- No merge or force push occurred.
