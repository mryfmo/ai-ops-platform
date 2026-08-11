# T23 Report: G2 ingest reliability

## Summary

- A-6 fixed: `events` now tracks `attempts`, `next_attempt_at`, `claimed_at`, and terminal `dead`; `claimNextQueued` reclaims due queued/delayed rows and expired dispatched leases.
- T23 revise R2 fixed: expired dispatched lease recovery now counts attempts and sends poison events to `dead` at `maxAttempts`.
- A-7 fixed: GitHub `X-GitHub-Delivery` is required fail-closed; normal Graph change notifications use the parsed channel `messageId` as the dedupe key. Graph changes without a parseable message id are audited and skipped while valid batch items continue. Accepted GitHub/Graph notifications persist `dedupe_key` through `EventsRepo.enqueue(..., { dedupeKey })` with `ON CONFLICT DO NOTHING`.
- A-8 fixed: Graph lifecycle notifications are classified; `reauthorizationRequired` renews, `subscriptionRemoved` switches to polling and audits, and `missed` invokes the delta backfill path.
- T23 revise R4 fixed: events retry/dedupe ALTERs, constraint replacement, indexes, and rollback DDL are in the `-- MIGRATIONS` section.
- T23 re-revise Rb1 fixed: Graph lifecycle notifications route before notification id enforcement, so id-less lifecycle events reach the lifecycle handler.
- T23 re-revise Rb2/Rb3 fixed: `claimNextQueued` now selects candidate rows, calls `decideEventDisposition`, and updates from the TS decision; reclaim/dead behavior tests drive that path.
- T23 revise-3 Rc1/Rc2 fixed: `claimNextQueued` now holds `FOR UPDATE SKIP LOCKED` through `BEGIN`/`COMMIT` on a dedicated client and restores SQL claimability predicates before TS disposition.
- T23 revise-3 Rc3/Rc4 fixed: Graph change dedupe uses parsed `ids.messageId`; tests cover transaction ordering, claimability predicates, and messageId-based Graph dedupe.

## Finding Map

| Audit finding | Status | Evidence |
| --- | --- | --- |
| A-6 queue silent loss | fixed | `packages/server/tests/eventsRepo.test.ts`, `packages/server/tests/eventsPollingTask.test.ts` cover retry, dead, and dispatched lease recovery. |
| A-7 webhook idempotency | fixed | `packages/server/tests/app.test.ts` covers duplicate GitHub delivery and duplicate Graph notification ids. |
| A-8 Graph lifecycle | fixed | `packages/server/tests/graphLifecycleHandler.test.ts` covers reauth, removed, missed backfill, and unknown subscription audit. |
| T23-R1 missing dedupe id | fixed | GitHub missing `X-GitHub-Delivery` returns 400 with audit; normal Graph change notifications missing a parseable message id append audit and are skipped while valid batch items continue. |
| T23-R2 lease poison retry | fixed | `claimNextQueued` increments attempts on expired `dispatched` lease recovery and marks `dead` when max is reached. |
| T23-R3 weak SQL echo tests | fixed | `decideEventDisposition` pure tests cover due, lease, max, done, and dead boundaries. |
| T23-R4 migration placement | fixed | events retry/dedupe DDL moved to `-- MIGRATIONS` with date and rollback DDL. |
| T23-Rb1 lifecycle regression | fixed | id-less lifecycle payloads are tested and routed before the normal change-notification dedupe id guard. |
| T23-Rb2 disposition overclaim | fixed | `claimNextQueued` calls `decideEventDisposition` on selected candidates before updating status/attempts. |
| T23-Rb3 reclaim behavior test | fixed | `eventsRepo.test.ts` drives reclaim attempts increment and max-attempt dead transition through `claimNextQueued`. |
| T23-Rc1 transaction regression | fixed | `claimNextQueued` uses a dedicated client transaction so row locks are held from SELECT through UPDATE/COMMIT. |
| T23-Rc2 claimability starvation | fixed | SQL WHERE again filters due queued/delayed rows and expired dispatched leases before `LIMIT 10`; TS retains attempts/dead disposition. |
| T23-Rc3 Graph dedupe source | fixed | Graph dedupe key is `ids.messageId`, not top-level notification id; duplicate test uses different notification ids for the same message. |
| T23-Rc4 claimability test | fixed | `eventsRepo.test.ts` asserts claimability predicates and transaction ordering in the production claim path. |

## Implementation Notes

- No new dependencies.
- No real API calls in tests.
- Schema additions follow the existing `-- MIGRATIONS` section pending the future migration framework.
- The direct `prettier --write` attempt included `schema.sql`; Prettier has no inferred SQL parser when invoked directly. TS files were formatted, and final `mise run ci` format passed.

## PR

- Branch: `agent/T23`
- Base: `agent/T22`
- Commits: `1bf211c`, `e3ad79b`, `a93b86e`, `d98b18e`
- URL: https://github.com/mryfmo/ai-ops-platform/pull/18
