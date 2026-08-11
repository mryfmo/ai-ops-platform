# T18 Learning

## Reusable Findings

- For scheduler tasks that must run on monthly business days, reuse shared `todayJstDateString` and `isNthBusinessDayOfMonth` instead of adding cron-specific logic.
- Documentation/artifact files under untracked `.orchestration/` can still fail repository-wide Prettier checks; format them even when they are not committed.
- The current server composition root has no real prjops-data provider. Monthly Seven Keys task should stay DI-driven so the production provider can be added without changing scheduler logic.

## Applied To

- `packages/server/src/scheduler/tasks/sevenKeysMonthlySnapshotTask.ts`
- `packages/server/src/index.ts`
- T18 validation notes
