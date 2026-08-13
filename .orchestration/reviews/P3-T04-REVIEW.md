# P3-T04-REVIEW — PR #205 approved at `c8298ca`

```yaml
task_id: P3-T04-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-13T18:02:31+09:00
re_reviewed_at: 2026-08-13T18:21:21+09:00
round_3_reviewed_at: 2026-08-13T18:44:41+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/205
base_ref_sha: d08f9dfd1eae27f42419344aa2c1e48ee429df5d
merge_base_sha: d7076c6d91d0452c679240444d366f375716db72
initial_head_sha: dc90804bab0369575062ade5c31137c71c50de46
round_2_head_sha: 63dee57299ddf5d9f4b89f3184b3a69b4b8f4de9
head_sha: c8298ca8d062affe6d6a69bca0a7b00db5bcb703
verdict: approve
findings:
  - id: P3-T04-001
    severity: high
    status: resolved
  - id: P3-T04-002
    severity: high
    status: resolved
  - id: P3-T04-003
    severity: medium
    status: resolved
  - id: P3-T04-004
    severity: medium
    status: resolved
  - id: P3-T04-005
    severity: high
    status: resolved
```

## Findings

### P3-T04-001 — high — review signal alone can complete the workflow without an authoritative approval decision

- Location: `packages/control-plane/src/lib/codingTaskState.ts:32-37,116-133`;
  `packages/control-plane/src/workflows/codingTask.ts:117-120`
- The task contract requires `approvalsRepo` to remain the authority and the
  workflow to durably wait for that result. It also calls for a state-reading
  activity contract. The implementation has no such activity or versioned
  decision binding: any signal containing the task ID, literal `complete`, and
  any nonblank `reviewerObjectId` sets `reviewAccepted = true` and completes the
  workflow. The reviewer string proves neither an approvalsRepo CAS nor that the
  reviewer was authorized.
- This is materially weaker than the reused approval child, which at least binds
  its signal to `approvalId` and `version`. A stale, forged, or prematurely sent
  review signal therefore becomes a second completion authority, contrary to
  the stated boundary.
- Required correction: make completion consume an immutable/versioned result of
  the authoritative DB decision (for example, signal-to-wake followed by an
  injected state read, or an equally strong CAS receipt contract). Reject stale,
  missing, non-approved, and mismatched decisions, and test that a merely named
  signal cannot complete the workflow.

### P3-T04-002 — high — callback replay classification ignores `runId` and is not bound to the dispatched run

- Location: `packages/control-plane/src/lib/codingTaskState.ts:24-30,84-113`;
  `packages/control-plane/src/workflows/codingTask.ts:90,106-115,169-180`
- `dispatchCodingTask()` returns a dispatch identifier, but the workflow drops
  that result. `evaluateCallbackSignal()` requires a nonblank `runId` and then
  never uses it. After the first callback, any later callback with the same
  outcome is classified as `duplicate-callback`, even when its `runId` is
  different. An independent probe at this head returned
  `{ accepted: false, reason: 'duplicate-callback' }` for `run-2` after `run-1`.
- A stale or unrelated run can consequently win first and drive the workflow to
  review/complete; the genuine callback for the dispatched run is silently
  suppressed if it happens to report the same outcome. `prNumber` is likewise
  neither validated nor retained, so the result cannot be reconciled to the
  actual PR.
- Required correction: retain the dispatch correlation identifier and accepted
  callback identity. Accept only the callback belonging to that dispatch; treat
  an exact immutable replay (`runId`, outcome, and applicable PR identity) as a
  duplicate and a different identity as mismatch/conflict. Add different-run,
  different-PR, and exact-replay cases to both state and workflow-history tests.

### P3-T04-003 — medium — review timeout destroys the durable review wait, and `no_change` has no sound completion path

- Location: `packages/control-plane/src/workflows/codingTask.ts:187-208`
- Both `pr_created` and `no_change` are forced into `review_pending`. A finite
  timer then rewrites either outcome to terminal `failed` with
  `review-timeout`. The canonical state machine defines `failed` as a callback
  outcome and does not define a review-timeout failure transition. More
  importantly, the workflow is closed, so an authorized reviewer arriving
  later cannot resume the durable wait.
- The live null-signal probe reproduced this exact terminal result after a valid
  `pr_created` callback. For `no_change`, there is no PR to review, yet the only
  successful path still requires a synthetic review-complete signal; otherwise
  a correct no-op is reported as a coding failure.
- Required correction: obtain/record the canonical terminal policy. At minimum,
  keep review pending across human delay rather than converting it to a coding
  failure, and define an explicit sound path for `no_change` (direct terminal
  success or a separately named human acknowledgement). Cover late review and
  `no_change` end to end.

### P3-T04-004 — medium — the workflow request validator accepts an invalid dispatch target and envelope

- Location: `packages/control-plane/src/lib/codingTaskState.ts:54-81`;
  `packages/control-plane/src/workflows/codingTask.ts:83-87,145-177`
- `assertCodingTaskRequest()` validates only IDs, version, and timeouts. It does
  not validate the `VersionedPayload` envelope/schema version, repository
  object, nonblank owner/repo/ref, or `requestedBy`, even though those values
  feed the approval child and the external dispatch activity. A direct probe at
  this head confirmed that empty owner/repo/ref/requester is accepted.
- TypeScript annotations are not a runtime boundary for Temporal payloads. A
  missing repository can throw during workflow execution after approval, while
  empty or malformed values can reach the external side-effect port.
- Required correction: validate the full versioned request before starting the
  child workflow or scheduling an activity, including supported schema version,
  complete object shape, and nonblank dispatch/requester fields. Add unknown/null,
  missing repository, empty field, and unsupported-version tests.

## Round 2 at `63dee57`

### Disposition of original findings

- `P3-T04-001`: resolved. Review signals now increment a wake counter only.
  Completion requires the injected `readReviewDecision` read-class activity to
  return a task-matched complete decision with a named reviewer. The complete
  history records a pending first read and a complete second read; a signal by
  itself does not complete the workflow.
- `P3-T04-002`: resolved for dispatch correlation and immutable callback replay
  identity. The workflow retains the dispatch result, rejects a mismatched
  `dispatchId`, and distinguishes exact `(runId, outcome, prNumber)` replay from
  a different run, PR, or outcome. A separate ordering defect remains; see
  `P3-T04-005`.
- `P3-T04-003`: resolved. Review wait has no timer or timeout-failure transition,
  and `no_change` completes directly without scheduling a review read. The new
  no-change history proves that terminal path.
- `P3-T04-004`: resolved. The validator now accepts `unknown` and checks the
  complete versioned envelope, supported schema, IDs/timeouts, repository
  object and nonblank owner/repo/ref/requester before starting the child or an
  activity. Negative coverage exercises malformed and missing shapes.

### P3-T04-005 — high — a valid callback arriving while dispatch is in flight is discarded and ends as callback-timeout

- Location: `packages/control-plane/src/lib/codingTaskState.ts:141-180`;
  `packages/control-plane/src/workflows/codingTask.ts:107-117,167-197`
- The signal handler evaluates callbacks immediately. While
  `dispatchCodingTask` or its lost-response reconciliation is still in flight,
  the workflow is in `queued` and `dispatchId` remains `null`; even a callback
  carrying the exact correlation ID is counted as `dispatch-mismatch`. Signals
  are not queued or re-evaluated after lines 184-185 store the returned dispatch
  ID, so the only valid callback can be lost permanently.
- This is a real TMP-003 crossover rather than an impossible ordering. The
  external GitHub run may complete and call back while the dispatch HTTP
  response is lost and the single-attempt Activity is waiting to time out or
  reconcile. Temporal signals are durable, but this handler turns that durable
  event into a terminal rejection without telling the sender to retry.
- An independent live Temporal probe held a successful dispatch Activity open,
  sent one callback with its correct future `dispatchId`, then released the
  Activity. The exact-head result was `phase=failed`,
  `failureReason=callback-timeout`, `dispatchOutcome=executed`, `callback=null`,
  and `dispatch-mismatch=1`. The submitted fixture instead sends its early
  callback before approval and asserts rejection; it does not cover a legitimate
  callback racing an already-scheduled dispatch.
- Required correction: preserve a structurally valid in-flight callback and
  re-evaluate it when dispatch correlation becomes known, or establish the
  immutable correlation ID before scheduling the Activity and safely accept it
  while that approved dispatch is in flight. Keep pre-approval/forged callbacks
  fail-closed. Add a live/history regression where the sole correct callback
  arrives during dispatch response loss/reconciliation and still drives the
  intended terminal outcome without resend.

## Initial review evidence at `dc90804`

- Used `gh` first and fixed the review to PR #205 head
  `dc90804bab0369575062ade5c31137c71c50de46`; reviewed the complete merge-base
  diff from `d7076c6d91d0452c679240444d366f375716db72`.
- Scope is confined to 13 control-plane implementation/test/fixture files.
  Server, web, dependencies, and lockfile are untouched; `git diff --check`
  passed.
- `pnpm --filter @aiops/control-plane exec vitest run
  tests/codingTaskState.test.ts tests/codingTaskReplay.test.ts`: 19/19 passed,
  including replay of all five submitted histories.
- `pnpm --filter @aiops/control-plane run typecheck`: passed.
- GitHub `build-test`, `gitleaks`, and CodeRabbit checks are green at the exact
  reviewed head.
- TMP-003 evidence is sound: the reconciled history schedules one
  `dispatchCodingTask` activity with `maximumAttempts=1`, then reads for
  reconciliation; the rejected-approval history schedules no dispatch.
- TMP-004 is scoped honestly enough for this task: `maxCachedWorkflows=0` plus
  replay covers deterministic history reconstruction, while real process
  kill/restart remains explicitly deferred to staging smoke.
- The record script's per-fixture unique task-ID change is deterministic and
  addresses the documented old-run handle/query collision without adding a
  production path.
- A live time-skipping Temporal probe proved malformed null callback/review
  signals increment deterministic rejection counters without wedging the
  workflow; it also exposed the terminal review-timeout behavior in
  P3-T04-003.

## Round 2 independent evidence at `63dee57`

- Used `gh` first and fixed the re-review to PR #205 head
  `63dee57299ddf5d9f4b89f3184b3a69b4b8f4de9`; the rewritten PR body describes
  the complete current PR and all round-1 corrections.
- Reviewed the full merge-base diff and the complete `dc90804..63dee57` fix
  delta. The final diff remains confined to 14 control-plane files; server,
  web, dependencies, and lockfiles are untouched. Merged P3-T02/P3-T03 history
  fixtures are byte-identical to `origin/main`; `git diff --check` passed.
- `pnpm --filter @aiops/control-plane run test`: 81/81 passed.
- Targeted state/history run: 23/23 passed, including replay of all six coding
  task histories.
- `pnpm --filter @aiops/control-plane run typecheck` and `run lint`: passed.
- Fixture inspection independently confirms one single-attempt
  `dispatchCodingTask`, two authoritative review reads on the complete path,
  and no review read on `no_change`.
- GitHub clean-runner `build-test`, `gitleaks`, and CodeRabbit checks are green
  at the exact reviewed head.
- The live in-flight callback probe failed exactly as described in
  `P3-T04-005`; no repository file was created for the probe.

## Round 3 at `c8298ca`

### Disposition

- `P3-T04-005`: resolved. The workflow now derives the dispatch correlation ID
  deterministically from the dispatch idempotency key before scheduling the
  Activity, assigns it only after approval when entering `queued`, and passes
  the same key to the dispatch Activity contract for propagation into the
  external run. Correlated callbacks are accepted in `queued` and `running`;
  pre-approval callbacks still fail closed because `dispatchId` remains null,
  and forged IDs remain `dispatch-mismatch`.
- The submitted in-flight fixture records the coding callback signal at history
  event 15 before dispatch Activity completion at event 23, completes normally,
  and retains `dispatch-mismatch=0`. Its Activity input contains the same
  deterministic correlation key and `maximumAttempts=1`.
- The reviewer reran the stronger original race with a synthetic lost response:
  the Activity created its external record, a sole correlated callback arrived
  while it was still in flight, the Activity then failed, reconciliation found
  the record, and the workflow completed with `dispatchOutcome=reconciled`, the
  original callback identity, and all callback rejection counters at zero.
- No open findings remain. Verdict: **approve**.

### Independent evidence

- Used `gh` first and fixed round 3 to PR #205 head
  `c8298ca8d062affe6d6a69bca0a7b00db5bcb703`; the PR body was rewritten to
  describe the complete current implementation and P3-T04-005 correction.
- Reviewed the complete `63dee57..c8298ca` delta and full merge-base envelope.
  The final PR remains confined to 15 control-plane files; server, web,
  dependencies, and lockfiles are untouched. Merged P3-T02/P3-T03 histories
  remain byte-identical to `origin/main`; `git diff --check` passed.
- `pnpm --filter @aiops/control-plane run test`: 84/84 passed, including all
  seven coding-task history replays.
- `pnpm --filter @aiops/control-plane run typecheck` and `run lint`: passed.
- GitHub clean-runner `build-test`, `gitleaks`, and CodeRabbit checks are green
  at the exact reviewed head.
