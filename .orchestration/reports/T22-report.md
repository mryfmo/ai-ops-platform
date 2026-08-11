# T22 Report: G1 Production Gate

## Summary

Branch: `agent/T22`
Base: `agent/T21`

Implemented the G1 production gates from the best-practice audits. No secret value was invented. The CODEOWNERS account was set only after confirming `mryfmo/ai-ops-platform` owner and `mryfmo` user through `gh`.

## Findings Matrix

| Finding | Status | Resolution |
| --- | --- | --- |
| B-1.1 CODEOWNERS placeholder | fixed+fail-fast | Replaced `@OWNER` with verified repository owner `@mryfmo` after `gh repo view` and `gh api users/mryfmo` confirmed it. `governance:check` now fails while common CODEOWNERS placeholder tokens remain. This is still not branch-protection proof; repository settings must require CODEOWNERS review. |
| B-1.3 AI PR does not trigger CI | fixed | `coding-task.yml` now requires `AIOPS_PR_TOKEN`, uses it for checkout branch credentials and `gh pr create`, and fails before checkout if missing. Default `GITHUB_TOKEN` write permissions were removed. Chosen route: dedicated PAT or GitHub App installation token via `AIOPS_PR_TOKEN`; PR-created event from that token is the CI trigger path. |
| B-4.1 gitleaks-action license issue | fixed | Removed `gitleaks/gitleaks-action@v2` and `GITLEAKS_LICENSE` dependency. `ci.yml` downloads gitleaks CLI v8.30.1 directly, verifies the linux x64 tarball SHA-256, and runs `gitleaks detect`. |
| B-2.1 Actions SHA pinning | fixed | Pinned all remote workflow `uses:` entries to verified 40-character commit SHAs with version comments. Local `./.github/actions/run-coding-agent` is intentionally exempt. |
| B-3.1 Dependabot | fixed | Added `.github/dependabot.yml` for weekly npm/pnpm and GitHub Actions grouped updates. |
| A-9 Failsafe does not stop work | fixed | Added `guardFailsafeTask` for dangerous scheduler dispatch paths and route-level guards for direct dangerous writes. Coding task confirm returns 503 and does not dispatch workflows while failsafe is active. `/readyz` returns not ready through the composition-root readiness check. Keepalive/read paths and JIT revocation remain allowed under REQ-029. |
| T22-R1 report ingest delivery bypasses failsafe | fixed | `/reports/ingest` now persists a newly ingested report but skips `deliverReport` while failsafe is active, appending `report_delivery_blocked_by_failsafe` with `basis=REQ-029`. Regression test proves `deliverReport` is not called for a newly created ingest during failsafe. |
| T22-R2 governance warn-only / typo owner gap | fixed | `governance:check` now runs `scripts/check-codeowners.mjs`, fails unresolved placeholders, and also fails owner tokens not in the verified owner allowlist. `@mryfmo` was verified with read-only `gh` metadata before use. |
| T22-R3 missing explicit tests | fixed | Added explicit `/readyz` readiness false -> 503 coverage and a JIT revocation test documenting that revoke is outside the failsafe guard. |
| T22-R1b xlsx import execute bypasses failsafe | fixed | `/xlsx-import/execute` now checks `isFailsafeActive` before `executeXlsxImport`, returns 503, and appends `xlsx_import_blocked_by_failsafe` with `basis=REQ-029`. Regression test proves `createIssue` is not called while failsafe is active. |
| T22-R2b email CODEOWNERS owner bypass | fixed | `scripts/check-codeowners.mjs` now evaluates CODEOWNERS owner tokens without dropping non-`@` owners and rejects email-style owners such as `nobody@example.com` unless verified. Runbook notes the hardcoded `@mryfmo` allowlist must be updated only after `gh` verification. |
| T22-R3b tests overclaimed composition-root failsafe coverage | fixed | Test names and report wording no longer claim composition-root failsafe state is driven. `/readyz` is covered at the `ReadinessCheck` boundary, and JIT coverage states only that the task is outside the failsafe guard. |
| T22-R1c createGraphSubscription CLI omitted from matrix | documented-scope-out | Added `createGraphSubscription` to the matrix as an out-of-band operator CLI. It is intentionally not gated because it is a recovery path and is not reached by HTTP or the scheduler. |
| T22-R1d keepalive tasks over-gated | fixed | Removed `guardTask` from subscription renewal and channel polling. Failsafe now gates REQ-029 dangerous operations only; keepalive/read+enqueue paths continue so Graph subscriptions and polling recovery do not die during a long failsafe. |

## Failsafe Entry Point Matrix

| Entry point | Side effect | Failsafe status | Evidence |
| --- | --- | --- | --- |
| `createSubscriptionRenewalTask` | Graph subscription renewal keepalive | not gated; continues during failsafe | renewal prevents Graph subscription TTL expiry during long failsafe windows |
| `createChannelPollingTask` | Graph polling read+enqueue fallback | not gated; continues during failsafe | polling keeps inbound events recoverable; dangerous event execution remains gated downstream |
| `createEventsPollingTask` | dispatches inbound Teams notifications, GitHub events, monitor events | guarded by `guardFailsafeTask` | `index.ts` wraps with `guardTask(...)`; Teams conversation is reached only through this guarded dispatcher in the production composition |
| `createPmSnapshotReconcileTask` | GitHub Project snapshot read/reconcile persistence | guarded by `guardFailsafeTask` | `index.ts` wraps with `guardTask(...)` |
| `createSevenKeysMonthlySnapshotTask` | monthly Seven Keys snapshot persistence | guarded by `guardFailsafeTask` | `index.ts` wraps with `guardTask(...)` |
| `createReportDeliveryTask` | scheduled email/Teams report delivery | guarded by `guardFailsafeTask` | `index.ts` wraps with `guardTask(...)` |
| `createJitRevocationTask` | revoke expired GitHub grants | intentionally allowed during failsafe | task is not wrapped; `schedulerTasks.test.ts` verifies the unguarded revoke task runs |
| `POST /coding-tasks/:taskId/confirm` | GitHub Actions `workflow_dispatch` | guarded at route before dispatch | `codingTasks.ts` returns 503 and audits `coding_task_blocked_by_failsafe`; `codingTaskRoutes.test.ts` verifies no dispatch/update |
| `POST /reports/ingest` | report delivery after ingest | guarded at route before `deliverReport` | `reportIngest.ts` audits `report_delivery_blocked_by_failsafe`; `reportIngestRoutes.test.ts` verifies no delivery call |
| `POST /xlsx-import/execute` | GitHub issue/milestone/project writes | guarded at route before `executeXlsxImport` | `xlsxImport.ts` audits `xlsx_import_blocked_by_failsafe`; `xlsxImportRoutes.test.ts` verifies `createIssue` is not called |
| Teams conversation commands | GitHub issue creation or coding task queue through Teams message handling | guarded by production dispatcher | inbound Graph webhook only enqueues; production execution of `TeamsConversationAgent.handleNotification` happens via guarded `createEventsPollingTask` |
| `createGraphSubscription` CLI | out-of-band operator subscription creation | not gated; recovery tool | `packages/server/src/tools/createGraphSubscription.ts`; not reachable from HTTP/scheduler and needed for manual recovery |
| `GET /readyz` | load balancer readiness | returns not ready when composition readiness is false | composition-root readiness returns `!failsafeActive`; route test covers false -> 503 and recovery -> 200 at the `ReadinessCheck` boundary |

## Verified External Values

Action tag commit SHAs were verified with `gh api`:

- `actions/checkout@v4` -> `34e114876b0b11c390a56381ad16ebd13914f8d5`
- `jdx/mise-action@v2` -> `c37c93293d6b742fc901e1406b8f764f6fb19dac`
- `pnpm/action-setup@v4` -> annotated tag dereferenced to `b906affcce14559ad1aafd4ab0e942779e9f58b1`
- `actions/setup-node@v4` -> `49933ea5288caeca8642d1e84afbd3f7d6820020`
- `actions/upload-artifact@v4` -> `ea165f8d65b6e75b540449e92b4886f43607fa02`

gitleaks latest release was verified as `v8.30.1`; checksum for `gitleaks_8.30.1_linux_x64.tar.gz` was verified from the release checksum file:

- `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`

## Scope Notes

- CODEOWNERS uses verified repository owner `@mryfmo`; `governance:check` proves placeholder, unknown owner, and email-style owner tokens are absent, but branch protection/CODEOWNERS review enforcement remains a repository settings task before go-live.
- `AIOPS_PR_TOKEN` value cannot be configured from this workspace; workflow now fails loudly when absent.
- No real API calls were made beyond read-only GitHub metadata/checksum lookup for exact pins.
