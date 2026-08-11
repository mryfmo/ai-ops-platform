# P001-T01 Acceptance — Revise 3

Status: **revise**

Independent `gpt-5.6-sol high` review found two product defects after the real-DB and CI gates passed.

## Required fixes

1. Remove the `PgAuditLog` default retention class. In `packages/server/src/index.ts`, create explicit `prjops_5y` and `devops_1y` writers and inject the correct writer by workflow. At minimum, XLSX import, PrjOps report/snapshot/delivery, and project conversation paths must not use the DevOps writer. Do not infer retention from actor/action text.
2. Make audit partition bounds independent of the PostgreSQL session `TimeZone` in both fresh schema and migration. Use explicit UTC instants and derive current/next months in UTC.
3. Add tests that fail if the constructor omits a retention class, that verify both writers persist distinct classes, and that create adjacent partitions under `UTC` and `Asia/Tokyo` without overlap/gap or DEFAULT misrouting.
4. Re-run the real PostgreSQL integration and full CI. Do not mark DONE until the orchestrator independently repeats both.

Expanded allowed file: `packages/server/src/index.ts` and a focused server test may be changed solely for explicit writer wiring.

Out of scope: `.codex/hooks.json` is a local agmsg delivery artifact and must not be treated as product code or committed.
