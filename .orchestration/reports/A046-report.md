# A046 PrjOps scheduler wiring report

## Status

Ready for orchestrator review in [PR #146](https://github.com/mryfmo/ai-ops-platform/pull/146), commit `eda96d993439a7288a53c334f657588b5464e009`.

## Delivered

- Registered resident `prjops-weekly-analyze` at Monday 06:00 JST and `prjops-daily-tracker` at business-day 09:00 JST without duplicating CI report generation or AGT-04/05/07 delivery.
- Applied the existing AGT-01 `decideOnJobFailure()` contract: two ten-minute retries, then Graph mail escalation to the normalized `PMO_NOTIFY_MAILBOX`; missing escalation configuration is degraded and audited.
- Added an injectable, fail-closed pinned PrjOps snapshot provider for active project/self-status and open action/assignee/manager projections.
- Added `action_reminder_state` fresh schema, migration, least-privilege grant, repository, rollback note, and unit/real-PostgreSQL tests. Successful external notifications persist immediately; snapshot and DB counts are combined monotonically and capped at three.
- Revised ASM-006 and the dated ADR-0003 amendment while preserving GitHub Actions as the report-generation source of truth. Regenerated the canonical `docs/PrjOps.zip` mirror and traceability matrix.

## Review

Crit data review found one missing real-PostgreSQL repository coverage case. It was fixed with concurrent upsert/baseline coverage; the review has one resolved record and zero unresolved comments. GitHub has zero review threads.
