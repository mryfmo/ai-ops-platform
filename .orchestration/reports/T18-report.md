# T18 Report

## Summary

Implemented Seven Keys monthly PDCA snapshot follow-up on `agent/T18` from `agent/T16`.

- Commit: `3a8b283` (`feat: persist seven keys monthly snapshots`)
- Revise commit: `001aaa1` (`fix: make seven keys snapshots explicit when disabled`)
- PR: https://github.com/mryfmo/ai-ops-platform/pull/13

## Revise Response

- R1: Server composition root now loads `packages/shared/src/calendar/jp_holidays.yaml` and builds the business calendar through shared YAML parsing instead of `buildHolidayCalendar([])`.
- R2: Removed the silent empty provider. The monthly task now treats a missing provider as disabled, writes `seven_keys_monthly_snapshot_disabled` with a reason, and never emits `created` for zero-work/no-data runs.
- R3: Changed the audit actor for the PrjOps Seven Keys monthly task from DevOps `AGT-RPT` to PrjOps `AGT-04`.

## Changes

- Added append-only `seven_keys_snapshots` table to `packages/devops/src/db/schema.sql`.
- Added `SevenKeysSnapshotsRepo` for insert, duplicate skip support, and previous snapshot lookup.
- Added `seven-keys-monthly-snapshot` scheduler task:
  - runs only on the first business day using shared business calendar helpers
  - computes current snapshot through existing `buildSevenKeysMonthlySnapshot`
  - reads previous persisted snapshot for month-over-month comparison
  - skips existing project/month snapshots and writes audit detail
- Wired the task into server composition root.
- Added optional monthly snapshot data to executive summary data flow and Executive Seven Keys view.
- Updated ADR-0010 and `verification/VERIFICATION_REPORT.md` from follow-up to implemented.
- Updated test count in `README.md` and verification report to 747.

## Scope Notes

- No dependency additions.
- No real API calls.
- No UPDATE/DELETE paths were added for audit log or Seven Keys snapshots.
- The server composition root still uses an empty `listExecutiveProjects` provider because this repository does not contain the prjops-data production provider. The scheduler path is wired and tested through DI.
- `.orchestration/` artifacts are intentionally uncommitted.

## Validation

- `pnpm --filter @aiops/server test -- sevenKeysSnapshotsRepo.test.ts sevenKeysMonthlySnapshotTask.test.ts`
- `pnpm --filter @aiops/web test -- views.test.tsx prjopsReportData.test.ts`
- `pnpm --filter @aiops/server typecheck`
- `pnpm --filter @aiops/web typecheck`
- `pnpm --filter @aiops/server lint`
- `pnpm --filter @aiops/web lint`
- `pnpm run format`
- `pnpm -r --if-present run test -- --run --reporter=dot` (750 tests)
- `mise run ci` (green)
- Revise validation: `pnpm --filter @aiops/shared test -- businessCalendar.test.ts`
- Revise validation: `pnpm --filter @aiops/server test -- sevenKeysMonthlySnapshotTask.test.ts`
- Revise validation: final `mise run ci` green
