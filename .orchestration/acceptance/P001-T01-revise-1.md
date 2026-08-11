# P001-T01 Acceptance — Revise 1

Status: **revise**

## Critical findings

1. `202607110000_audit_log_partitions.sql` assigns every non-empty legacy table without `retention_class` to `devops_1y`. This violates the Plan 001 STOP condition for non-deterministic backfill and can shorten PrjOps retention from five years to one year. The migration must abort without changing data unless every legacy row already has a validated retention class. An empty legacy table may migrate automatically.
2. `ensure_audit_log_partition` is not tested when the DEFAULT partition already contains rows in the requested month. PostgreSQL will reject overlapping attachment; the contract must explicitly fail without losing or moving rows, and the integration test/runbook must prove the quarantine row remains intact.

## Required revision

- Remove implicit `devops_1y` legacy backfill.
- Add a static regression assertion and real-DB adversarial scenario for non-empty unclassified legacy data: migration fails and the original table/data remain.
- Document a human-reviewed preclassification procedure; do not invent actor/action heuristics.
- Add the DEFAULT-overlap adversarial scenario and preservation check.
- Keep Plan 001 `IN PROGRESS` until real PostgreSQL validation and full CI pass.

The existing real-DB environment blocker remains valid and is not waived.
