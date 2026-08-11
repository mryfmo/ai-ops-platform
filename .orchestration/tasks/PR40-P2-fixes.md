# PR40-P2-fixes

## Objective

Resolve both unresolved P2 review threads on PR #40 at their shared root causes.

## Workspace

- Isolated clone: `/tmp/aiops-pr40-fix`
- Branch: `agent/005-microsoft-graph`

## Allowed files

- `packages/server/src/scheduler/tasks/channelPollingTask.ts`
- `packages/server/src/scheduler/tasks/reportDeliveryTask.ts`
- `packages/server/tests/channelPollingTask.test.ts`
- `packages/server/tests/reportDeliveryTask.test.ts`

## Requirements

1. Reject unauthorized/paused/closed channels before any Graph subscription renew/create mutation, while retaining a re-check before message ingestion.
2. A configured default Teams target must emit at most one summary card per report delivery invocation, while all eligible recipients still receive email.
3. Add focused regression tests for both paths.

## Forbidden actions

- Do not merge PRs.
- Do not change dependencies, configuration contracts, or unrelated files.
- Do not weaken trust-boundary validation, audit logging, or cleanup.

## Validation

- `pnpm --filter @aiops/server run test -- channelPollingTask.test.ts reportDeliveryTask.test.ts`
- `git diff --check`
- Report the exact changed files and any remaining risk.

## Expected result

Return a review-ready diff in the isolated clone. Do not commit or push until orchestrator acceptance.
