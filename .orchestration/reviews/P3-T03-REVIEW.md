# P3-T03-REVIEW — PR #202 approved at `9d15092`

```yaml
task_id: P3-T03-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-13T14:52:23+09:00
re_reviewed_at: 2026-08-13T15:03:01+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/202
base_sha: d8560dd7bcf8b2010a143a51278efc1bf5acb174
initial_head_sha: 3c11713e15f32103b6e5d4c93a3d76d621ac00c1
head_sha: 9d1509219dcb573a9243f552fb18d8688130a53f
verdict: approve
summary: >-
  All findings P3-T03-001 through P3-T03-003 are independently verified as
  resolved. Malformed signals are deterministically rejected without wedging
  expiry, recorded histories prove the full adversarial matrix and invalid-only
  expiry path, unrelated P3-T02 fixture churn is removed, and exact-head CI is
  green.
```

## Findings

### P3-T03-001 — high — a malformed signal wedges the workflow and defeats expiry

- Location: `packages/control-plane/src/lib/approvalDecision.ts:52-65`;
  `packages/control-plane/src/workflows/approval.ts:57-70`
- `defineSignal<[ApprovalDecisionSignalPayload]>` is only a TypeScript contract;
  Temporal callers can encode `null` or another malformed runtime payload. The
  handler forwards it directly to `evaluateDecisionSignal`, which dereferences
  `signal.approvalId`. The resulting workflow-task failure is retried against
  the same history, so the workflow cannot advance to its expiry outcome.
- Independent exact-head probe: start a 50 ms approval workflow, send
  `approvalDecision(null)`, advance the time-skipping environment by 1 second,
  and describe/fetch history. The execution remained `RUNNING`; history ended
  at `WORKFLOW_TASK_STARTED` after the signal, with no task completion or
  workflow completion. Temporal therefore accepts the payload at the transport
  boundary, while the workflow never reaches `expired`.
- This contradicts the deliverable that invalid signals are rejected and the
  acceptance requirement that expiry is durable/no-auto-approval.
- Required correction: make the pure evaluator accept `unknown`, validate the
  payload object and each field before dereference, classify malformed payloads
  as a deterministic rejected-signal reason, and leave an integration/history
  test proving malformed input is counted and the workflow still expires or
  subsequently accepts a valid decision.

### P3-T03-002 — medium — recorded histories cover only part of the required CAS/no-auto-approval matrix

- Location: `packages/control-plane/scripts/record-replay-history.mjs:109-140`;
  `packages/control-plane/tests/approvalReplay.test.ts:35-53`
- The approved history contains only an old version, an ID mismatch, and a
  valid approval. The expired history contains no signals. Future-version
  staleness, double decision, invalid decision strings, blank approvers, and
  rejected-signal accumulation before expiry exist only in pure-function tests
  (or are not exercised at all through the workflow handler).
- TMP-002 requires signal evidence plus a stale-version negative, and this
  review assignment explicitly requires recorded histories to be real proof of
  both stale directions, double-decision handling, ID mismatch, unnamed
  approver, and invalid decisions. The current history assertions cannot detect
  a wiring regression for most of that matrix or prove that a series of rejected
  signals still ends as `expired` rather than `approved`.
- Required correction: regenerate the approval fixtures with the complete
  adversarial matrix (including a post-accept duplicate queued before workflow
  completion) and an invalid-only/expired path, then decode/assert each signal
  class and every resulting counter/status before replaying the histories.

### P3-T03-003 — low — P3-T02 replay fixtures were regenerated without semantic benefit

- Location: `packages/control-plane/tests/fixtures/replay-probe.cancelled.history.json`;
  `packages/control-plane/tests/fixtures/replay-probe.executed.history.json`;
  `packages/control-plane/tests/fixtures/replay-probe.reconciled.history.json`
- These three files contribute 176 added and 179 deleted lines. Inspection shows
  run timestamps/IDs, worker identity, bundle checksum, history byte counts,
  core-used-flag order, and JSON key ordering changed; the exact-head replay
  tests already pass against the prior semantic histories.
- Required correction: restore these three fixtures from `origin/main`. Keep the
  necessary one-line shared `workflowsPath` move to `workflows/entry.ts` and the
  new approval fixtures. Re-record P3-T02 histories only when their semantic
  event/command contract changes.

## Review judgments

- **CAS/no-auto-approval code shape:** exact `version` equality rejects both
  numeric directions; accepted state is set only for explicit
  `approved|rejected`; timeout returns only `expired`. No default approval path
  was found.
- **Restart safety:** `maxCachedWorkflows: 0` plus multi-task history and full
  replay is a valid cache-eviction/reconstruction proxy. The PR correctly does
  not claim the deferred real three-process-restart deploy smoke is complete.
- **Authority/scope:** this isolated workflow is not wired to production and
  makes no DB write. Treating `approvalsRepo` as authoritative and deferring the
  flag-gated server/web integration is acceptable for this task; the later
  integration must perform the DB CAS before emitting the matching workflow
  signal and must not consume a workflow result as a competing approval ledger.
- **Boundary/determinism/dependencies:** diff is within the task's stated
  workflow/lib/test allowance; server/web and dependency pins are unchanged;
  `git diff --check` passes. The workflow code uses deterministic Temporal APIs.
- **Coverage exclusion:** excluding sandbox-only workflow/entry files from V8
  instrumentation is reasonable because recorded-history replay executes them;
  the missing handler paths are an evidence gap captured in findings 001/002.

## Initial independent verification at `3c11713`

- GitHub inspected with `gh` first; no web fallback used.
- Exact PR: https://github.com/mryfmo/ai-ops-platform/pull/202
- `gh pr view 202`: open, non-draft, mergeable, exact head `3c11713e...`.
- `gh run view 31671432604`: clean-runner `build-test` success including fresh
  PostgreSQL integration; `gitleaks` success.
- `mise exec -- pnpm --filter @aiops/control-plane run test`: 57/57 passed.
- control-plane typecheck and lint: passed.
- `mise run traceability`: passed.
- `git diff --check origin/main...origin/pr-202-review`: passed.
- Local full `mise run ci` was not duplicated because this machine has no
  configured disposable PostgreSQL; the exact-head GitHub clean-runner executed
  the DB integration gate successfully.

## Actions not taken

- No PR-branch edit, push, merge, GitHub review submission, dependency change,
  browser Crit review, or server/web edit.

## Re-review at `9d15092`

### Finding dispositions

- `P3-T03-001`: resolved. `evaluateDecisionSignal()` now accepts `unknown` and
  rejects null, non-object, array, and missing/mistyped identity/version payloads
  before dereference. Re-running the original live Temporal probe with a 50 ms
  expiry and `approvalDecision(null)` completed as `expired` with
  `malformed-payload: 1`; it no longer remains `RUNNING`.
- `P3-T03-002`: resolved. The approved history contains eight ordered signals:
  stale versions 2 and 4, ID mismatch, invalid decision, blank approver, null,
  valid approval, and a post-accept rejected duplicate. Replay yields the exact
  six-category rejection counters and preserves the valid approval. The expired
  history receives null plus stale input, fires its timer, and returns `expired`
  with both rejection counters, proving rejected-signal accumulation cannot
  auto-approve or wedge the workflow.
- `P3-T03-003`: resolved. The three P3-T02 replay-probe fixtures are byte-equal
  to `origin/main` and absent from the final merge-base diff.

### Final exact-head evidence

- GitHub was inspected with `gh` first; no web fallback was used. The PR body is
  updated for the complete two-commit contents at `9d15092`.
- `mise exec -- pnpm --filter @aiops/control-plane run test`: 58/58 passed.
- Independent malformed-signal Temporal probe: passed and completed `expired`.
- control-plane typecheck, lint, and merge-base `git diff --check`: passed.
- GitHub Actions run `31672114665`: `build-test` success in 4m52s, including
  coverage, traceability, and fresh PostgreSQL integration; `gitleaks` success.

Final verdict: **approve** for exact head
`9d1509219dcb573a9243f552fb18d8688130a53f`.
