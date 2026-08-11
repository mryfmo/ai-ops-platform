# T28 Report: Codex Bot Review Triage

## Summary

- Branch: `agent/T27`
- PR: #22
- Commit: `938255d` (initial T28 commit: `76e1326`)
- Source comments: fetched PR #5-#22 review comments from `chatgpt-codex-connector[bot]`.
- Raw bot comments fetched: 46. T28 task-file triage scope: 29 clustered findings; extra raw comments were older duplicates or previously handled review comments outside the 29-item task scope.
- Result: valid current-tip issues fixed; known follow-ups documented; `mise run ci` green.

## Fixed In T28

- `pg` CommonJS import in `packages/devops/src/db/migrate.ts`.
- Graph lifecycle webhook now returns 202 before lifecycle work completes, with async failure audit.
- DevOps throughput now maps `pm_events.repository` through `project_channels.github_owner/github_repo` when `project_id` is absent, and reads merged/not-planned state from stored `raw_payload`.
- Seven Keys monthly diff treats `grey` as unknown and excludes it from improved/worsened lists.
- Server runtime now starts OpenTelemetry before dynamic import of instrumented application modules via `packages/server/src/main.ts`.
- Event failure updates are guarded by active `claimed_at` lease and report stale failures explicitly.
- XLSX import fixes: milestone titles resolve to milestone numbers, Project v2 field values honor `field_type`, pending/failed ledger rows retry, and Excel `Date` cells use UTC dates.
- Report ingest retries delivery for duplicate reports; delivery remains idempotent at distribution log level.
- Standard report IDs include schema/evidence fields and ignore only `period.generatedAt`.
- Graph subscription CLI persists created subscriptions to `graph_subscriptions`.
- PRF-G report recipients are treated as global audience.
- Dependabot file now has a basis header.
- GitHub deployment status normalization records only terminal statuses.

## Triage Table

| # | Finding | Status | Notes |
|---|---|---|---|
| 1 | PR19 `migrate.ts` named `Pool` import from CommonJS `pg` | fixed | Switched to repo convention `import pg from "pg"; const { Pool } = pg`. |
| 2 | PR18 Graph lifecycle awaited before 202 | fixed | Lifecycle work is launched after ack; failures audited as `graph_lifecycle_failed`. |
| 3 | PR22 throughput drops issue/PR rows with null `project_id` | fixed | Repository-to-project mapping via `project_channels` fills scope for GitHub issue/PR rows. |
| 4 | PR22 merged PR status missing from normalized payload | fixed | Normalizer saves `merged`; report data also falls back to `raw_payload.pull_request`. |
| 5 | PR6 Seven Keys grey ranked as real RAG value | fixed | `grey` excluded from monthly improvement/worsening diffs. |
| 6 | PR20 OTel bootstrapped after instrumented modules | fixed | New `src/main.ts` starts telemetry before dynamic importing `index.ts`; start commands point to `dist/main.js`. |
| 7 | PR18 stale worker failure can overwrite newer event state | fixed | `markFailed` requires `status='dispatched'` and matching `claimed_at`; stale result is explicit. |
| 8 | PR6 DORA deployments not period bounded | already-fixed | T27 R-A1: `fetchDeployments` is period-bounded. |
| 9 | PR6 unresolved incident counted as 0h recovery | already-fixed | T27 NEW-2 excludes unresolved incidents from MTTR. |
| 10 | PR22 DORA portfolio rate median instead of pool | already-fixed | T27 R-A3/F1 uses pooled raw records and de-dupes incidents by event unit. |
| 11 | PR22 rework hard-coded zero | already-fixed | T27 R-A4 removed fake rework metric; unavailable data remains absent/NA. |
| 12 | PR6 reportGenerator truncate without revalidation | already-fixed | T26 R2 corrected validation flow. |
| 13 | PR21 period/evidence numerals rejected as hallucinations | already-fixed | T26 R6 strips literal prompt labels from numeric grounding. |
| 14 | PR20 queue gauge stale after status disappears | already-fixed | T25 resets known event queue statuses to zero every scrape. |
| 15 | PR19 migration transaction not pinned to one client | already-fixed | T24 uses `pool.connect()` client + advisory lock. |
| 16 | PR5/PR11 XLSX import unauthenticated | already-fixed | T20 HMAC and repo allowlist guard the execute route. |
| 17 | PR6 milestone delay days hard-coded | follow-up(#27) | Existing issue #27 covers real delay-day data wiring. |
| 18 | PR5 issue milestone title sent directly to GitHub | fixed | Milestones execute first; issue rows pass milestone number or fail row validation. |
| 19 | PR5/PR11 Project v2 `field_type` ignored | fixed | GraphQL mutation now sends `ProjectV2FieldValue` keys by `field_type`. |
| 20 | PR14 duplicate report ingest suppresses delivery retry | fixed | Duplicate ingests invoke delivery unless failsafe is active. |
| 21 | PR14 PRF-G recipients masked as PRF-03 with empty projects | fixed | PRF-G maps to global `PRF-04` audience. |
| 22 | PR14 createGraphSubscription CLI did not persist | fixed | CLI upserts created subscription into `graph_subscriptions`. |
| 23 | PR15 pending/failed import ledger rows not retryable | fixed | Only `imported` ledger rows skip; pending/failed rows retry. |
| 24 | PR15 standard report hash excluded evidence/schema | fixed | Stable report ID includes full payload with only `period.generatedAt` neutralized. |
| 25 | PR15 traceability server namespace false positives | nit-wontfix | Current traceability check is green; changing corpus semantics is larger than T28 and needs a dedicated design to avoid dropping legitimate shared server IDs. Recorded as inspected, not silently claimed. |
| 26 | PR16 non-terminal deployment statuses counted | fixed | `deployment_status` normalization ignores non-terminal states. |
| 27 | PR16 Excel `Date` cell timezone drift | fixed | `normalizeDate(Date)` uses `toISOString().slice(0,10)`. |
| 28 | PR17 coding-task token should be minted at runtime | nit-wontfix | T22 intentionally enforces `AIOPS_PR_TOKEN` fail-fast; runtime GitHub App token minting remains infra follow-up, not implemented here. |
| 29 | PR17 Dependabot basis header missing | fixed | Added ADR/A-9 basis header. |

## Validation

- Focused tests:
  - `pnpm --filter @aiops/server test -- reportIngestRoutes.test.ts standardReportsRepo.test.ts reportDeliveryTask.test.ts createGraphSubscriptionTool.test.ts eventsRepo.test.ts app.test.ts githubEventRouter.test.ts eventsPollingTask.test.ts`
  - `pnpm --filter @aiops/shared test -- githubClient.test.ts xlsxImport.test.ts`
  - `pnpm --filter @aiops/web test -- reportData/devopsReportData.test.ts`
  - `pnpm --filter @aiops/prjops test -- executiveSevenKeys.test.ts`
- Full DoD:
  - `mise run ci` -> green, final run outside sandbox because `tsx` IPC pipe creation was blocked by sandbox EPERM.

## Revise Response

| Revise finding | Status | Evidence |
|---|---|---|
| #1 XLSX incremental import skips imported milestone ledger rows before seeding `knownMilestones` | fixed | `executeXlsxImport` now seeds milestone title -> number from imported milestone ledger rows before skipping them. Added run1/run2 regression test where run2 creates a new issue against the existing milestone title. |
| #2 Numeric milestone titles are misread as literal GitHub milestone numbers | fixed | Removed numeric literal fallback. Issue milestone references always resolve through `knownMilestones`, including titles such as `2026`. Added regression test. |
| #3 Standard report hash change can create one-time redispatch on existing deployed DB rows | documented | No production deployment/existing report rows are present in this environment, so no backfill is required. Release note: first deployment after this hash fix can create new `STD-*` ids for existing logical reports and dispatch them once; distribution ledger remains idempotent afterward. |
| #4 Repo -> project mapping was last-wins for shared repositories | fixed | `repositoryProjectIds` now stores all project ids per `owner/repo`; null-`project_id` GitHub events are counted for every scoped project mapped to that repository. Added shared-repository regression test. |
| #5 Graph lifecycle failure audit catch could itself reject | fixed | The asynchronous lifecycle chain now has a terminal catch. Added route test with lifecycle failure plus audit failure returning 202 without surfacing a rejected promise. |

Revise focused tests:

- `pnpm --filter @aiops/shared test -- xlsxImport.test.ts` -> green (19 tests)
- `pnpm --filter @aiops/web test -- reportData/devopsReportData.test.ts` -> green (17 tests)
- `pnpm --filter @aiops/server test -- app.test.ts` -> green (19 tests)
- `mise run ci` -> green, final revise run used normal parallel CI (`-j 1` not used).
- `make require-crit-review` was attempted per local AGENTS.md, but this repository has no `require-crit-review` target.
