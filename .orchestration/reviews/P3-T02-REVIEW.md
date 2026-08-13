# P3-T02-REVIEW — PR #200 approved at `565689b`

```yaml
task_id: P3-T02-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-13T12:44:30+09:00
re_reviewed_at: 2026-08-13T13:37:11+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/200
base_sha: ef438dc5b3cc8692de9019f6a6079363c1588c60
head_sha: 565689b5a7edf2b51656e4958dd876155f411428
verdict: approve
summary: >-
  Round 2 resolves all four findings. A genuine cancelled Workflow history
  proves that the external write is never scheduled, non-cancellable cleanup
  runs once, and the Workflow ends cancelled; the negative replay now asserts
  DeterminismViolationError. Scope, dependencies, PR metadata, focused gates,
  and the authoritative clean GitHub workflow are all green.
```

## Findings

### P3-T02-001 — medium — the cancellation acceptance path is not tested

- Location: `packages/control-plane/src/workflows/cancellation.ts:13-16`;
  `packages/control-plane/tests/workflowHelpers.test.ts:1-4,32-48`;
  `packages/control-plane/src/workflows/replayProbe.ts:28-42`;
  `packages/control-plane/vitest.config.ts:11-14`.
- The component acceptance requires Workflow cancellation to stop an unstarted
  side effect. The only test call to `guardSideEffectDispatch()` runs outside a
  Workflow context and merely accepts either success or any non-`RangeError`.
  Neither recorded history contains a cancellation event, and the probe calls
  the guard only in a non-cancelled scope.
- Independent coverage confirms the gap: `cancellation.ts` is 66.66% lines /
  50% branches and the only uncovered statement is the `CancelledFailure` at
  line 15. Excluding `replayProbe.ts` itself is justified because it executes in
  the bundled Workflow sandbox, but replaying its two success histories does
  not cover cancellation propagation as the test comment claims.
- Required correction: add a real Workflow-context test or recorded history
  that requests cancellation before dispatch and asserts that the external
  activity is never scheduled/called and the Workflow reports cancellation.
  Keep a positive non-cancelled dispatch case.

### P3-T02-002 — low — the negative replay gate passes on unrelated failures

- Location: `packages/control-plane/tests/replay.test.ts:36-40`.
- The test is titled as a nondeterminism check but uses only
  `rejects.toThrow()`. A bundle/import/fixture decoding failure would satisfy
  it and leave TMP-001's negative evidence falsely green.
- Independent execution of the current fixture does produce the intended
  `DeterminismViolationError` with `[TMPRL1100] Nondeterminism error`, so the
  fixture is valid today; the assertion does not preserve that guarantee.
- Required correction: assert `DeterminismViolationError` (exported by the
  pinned Workflow SDK) or at minimum its stable nondeterminism classification,
  not an arbitrary rejection.

### P3-T02-003 — low — a generated timestamp changed outside the task boundary

- Location: `packages/traceability/output/traceability_matrix.md:3`.
- The complete merge-base diff changes only the generated timestamp in this
  file. P3-T02 permits `packages/control-plane/**` and the necessary lockfile;
  it does not permit this traceability output, and the change carries no task
  evidence.
- Required correction: restore this file to the merge-base content.

### P3-T02-004 — low — dependency and PR metadata overstate the submitted diff

- Location: `packages/control-plane/package.json:24-25`; PR #200 description.
- `@temporalio/activity` and `@temporalio/common` are added as direct dev
  dependencies but have no imports anywhere in `packages/control-plane`.
  `@temporalio/testing` already owns its transitive requirements. The task file
  permits only subpackages that are needed, so these two direct pins and their
  lockfile churn should be removed unless a direct consumer is added.
- The PR description reports 45 tests, while independent exact-head Vitest and
  coverage runs both report 8 files / 44 tests. Update the full PR description
  after the corrections so its head, file scope, dependencies, and test count
  match the submitted tree.

## Independent validation

- Used `gh` first and pinned PR #200 to exact head
  `da94aa5f9477803f50b6bd96a5b44512169d7a7e`; no web fallback was needed.
- Reviewed all 20 files in the complete merge-base diff from
  `ef438dc5b3cc8692de9019f6a6079363c1588c60`; `git diff --check` passes.
- Fresh detached-worktree frozen install: pass with zero downloads and the
  lockfile unchanged.
- Control-plane test/typecheck/lint: pass; 8 files / 44 tests. Tests completed
  under the restricted sandbox without a Temporal server or external network.
- Coverage: pass, 94.8% statements / 92.63% branches / 97.14% functions /
  94.7% lines. The `replayProbe.ts` exclusion is appropriate because
  `Worker.runReplayHistory` bundles and executes it outside V8 instrumentation.
- Recorded fixtures are real Temporal histories. The executed fixture schedules
  `createExternalObject` once and completes it. The reconciled fixture schedules
  it once with `maximumAttempts: 1`, records
  `RETRY_STATE_MAXIMUM_ATTEMPTS_REACHED`, then schedules
  `findExternalObject` once and completes as `v2:reconciled:obj:fixture`.
- `Worker.runReplayHistory` accepts both committed histories locally. The
  mutated Workflow independently rejects with `DeterminismViolationError` and
  the expected nondeterminism classification.
- The dev-only record script successfully ran in the disposable worktree using
  `TestWorkflowEnvironment.createTimeSkipping()` and reproduced both semantic
  paths. Its regenerated JSON differs only in expected run-specific metadata
  such as timestamps, run IDs, worker identity/checksum, formatting, and stack
  path.
- TMP-003 unit tests prove success skips reconciliation, lost response creates
  one external object with one execute call and recovers by key, and reconcile
  returning `null` throws `ExternalSideEffectUnresolvedError` without another
  execute call.
- GitHub Actions run `31663930151`: `build-test`, `gitleaks`, and CodeRabbit
  contexts are green at the reviewed head.

## Round 2 at `565689b`

### Disposition of findings

- `P3-T02-001`: resolved. `cancellationProbeWorkflow` waits on a Temporal timer,
  receives cancellation, calls the dispatch guard, runs only the idempotent
  cleanup read in a non-cancellable scope, then rethrows cancellation. The
  recorded history contains timer start, cancel request, timer cancellation,
  exactly one `findExternalObject` activity, and terminal Workflow cancellation;
  it contains no `createExternalObject` schedule. The test asserts these data
  properties and successfully replays the history.
- `P3-T02-002`: resolved. The negative replay now requires the pinned SDK's
  `DeterminismViolationError`, so unrelated bundle/fixture failures cannot make
  the gate green.
- `P3-T02-003`: resolved. The complete merge-base diff no longer contains
  `packages/traceability/output/traceability_matrix.md`; all changed files are
  within `packages/control-plane/**` plus the task-authorized lockfile.
- `P3-T02-004`: resolved. The unused direct `@temporalio/activity` and
  `@temporalio/common` dev dependencies and matching importer lock entries are
  removed. The refreshed PR description identifies exact head `565689b`, the
  three replay paths, the narrowed dependencies, and the correct 46-test count.

### Round-2 independent validation

- Used `gh` first and pinned PR #200 to exact head
  `565689b5a7edf2b51656e4958dd876155f411428`; no web fallback was needed.
- Reviewed the nine-file delta from round 1 and the complete merge-base diff;
  `git diff --check` passes and no out-of-boundary file remains.
- Fresh detached-worktree frozen install: pass; lockfile supply-chain policy is
  green.
- Control-plane test/typecheck/lint: pass, 8 files / 46 tests. All replay tests,
  including the cancelled history and typed nondeterminism assertion, pass
  without an external Temporal server or network.
- Independently regenerated all three fixtures in the disposable worktree.
  Five consecutive cancellation generations produced the same semantic order:
  timer start before cancel request, scheduled activities exactly
  `[findExternalObject]`, and terminal `EVENT_TYPE_WORKFLOW_EXECUTION_CANCELED`.
- GitHub Actions run `31666525918`: clean `build-test` success in 5m50s;
  `gitleaks` and CodeRabbit contexts success.
- All findings are resolved. Verdict: approve.

No GitHub review was submitted and no PR branch was edited, pushed, or merged.
