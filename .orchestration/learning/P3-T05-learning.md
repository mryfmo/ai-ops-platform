# P3-T05 learning

## L-P3T05-01: workflow contract failures must terminate, not retry the workflow task

Throwing `RangeError` directly from workflow code after an activity result is malformed makes Temporal retry the workflow task. Convert the validated boundary error to non-retryable `ApplicationFailure` (`E-CP-CONTRACT`) so invalid transport data cannot wedge a run.

## L-P3T05-02: shadow safety requires a preflight authoritative read

Single-attempt + reconcile only protects an unknown result from the new write. To coexist with a legacy writer, read the external/ledger authority before scheduling the write and return the existing receipt when the legacy operation already completed.

Preflight alone cannot close the race with an unmodified legacy writer. While both paths coexist, an explicit shadow mode must structurally suppress new workflow writes; active mode begins only after cutover.

## L-P3T05-03: full record scripts must restore merged fixtures

Temporal-generated histories contain run-specific values. After recording new task fixtures, restore every merged fixture from `origin/main`, then verify the tracked prior fixture set has zero diff.

## L-P3T05-04: relative timers must account for worker pickup delay

Schedule inputs carry an absolute due time. Compute remaining delay using Temporal's replay-safe logical `Date.now()` when the workflow task actually runs; sleeping the original duration after a backlog can renew after expiry.

## L-P3T05-05: recurring Schedule arguments are static

Temporal Schedule reuses its action arguments. A recurring external write must derive its per-fire idempotency identity and target timestamp from replay-safe logical workflow time, not reuse a sequence or expiry embedded in the static action payload.

## L-P3T05-06: activity contracts and timeouts include downstream client behavior

Activity inputs and outputs need `VersionedPayload` envelopes at the workflow boundary. The activity timeout must also cover the downstream client's valid wait contract; a 60-second Temporal timeout conflicts with Graph `Retry-After` handling that intentionally waits longer.

## L-P3T05-07: a long activity timeout needs a heartbeat contract

Extending `startToCloseTimeout` preserves Graph throttling waits but delays worker-loss detection. Pair long renewal/delta timeouts with a short heartbeat timeout, and require the activity implementation to inject a retry sleep/page loop that heartbeats more frequently than that timeout.

## L-P3T05-08: finite workflows still need explicit Schedule definitions

Delegating repetition to Temporal Schedule is incomplete unless the task exports and tests the concrete recurring definitions. Keep runtime enablement separate for the shadow task, but make renewal/delta/reconcile creation callable and deterministic here.

## L-P3T05-09: renewal failure preserves the availability state transition

Single-attempt write plus reconcile prevents duplication but does not replace the legacy recovery behavior. If renewal remains unresolved, switch to polling and backfill through an idempotent activity so subscription expiry does not silently stop ingestion.

## L-P3T05-10: interval cadence needs an explicit phase

A Temporal interval's `every` value does not encode the intended first fire by itself. Set `offset = startAtMs % every` so recurring executions remain anchored to the subscription-specific renewal/delta/reconcile phase, and size catch-up windows by operation risk rather than using one global value.

## L-P3T05-11: shadow suppresses writes, not observation

Shadow mode must keep authoritative reconcile reads active so parity can be measured. Suppress only mutation activities, and keep ScheduleClient registration I/O outside the pure `src/lib` schedule-option builder.

## L-P3T05-orch-01: AI PR は必ず App token author で作成する（worker 逸脱の検出）
worker が自前の gh 認証（= Owner 本人）で PR を作成すると、CODEOWNERS 必須
レビューを Owner が self-approve できず merge 不能になる。AGMSG-TASK の指示
どおり AIOPS_PR_TOKEN（aiops-pr-bot）を使うか、blocked-auth で orchestrator に
委譲する。orchestrator は acceptance 前に PR author を検分項目に加える。
