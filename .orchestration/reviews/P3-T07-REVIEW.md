# P3-T07-REVIEW — PR #213 at `85ff498`

```yaml
task_id: P3-T07-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-14T09:26:25+09:00
round_2_reviewed_at: 2026-08-14T09:41:52+09:00
round_3_reviewed_at: 2026-08-14T09:54:32+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/213
base_sha: fe6b1cf6d27650cd28b1fc965e2cd71fe5ec2ee1
merge_base_sha: fe6b1cf6d27650cd28b1fc965e2cd71fe5ec2ee1
initial_head_sha: d707bd7911614eaf2131c1a125ef26c7474e310f
round_2_head_sha: 27109b2713547c14a0dca035d035358f6bfec9a1
head_sha: 85ff498eea9c6eeda19e65395e112465ee0b18ed
verdict: approve
findings:
  - id: P3-T07-001
    severity: high
    status: resolved
  - id: P3-T07-002
    severity: high
    status: resolved
  - id: P3-T07-003
    severity: high
    status: resolved
```

## Findings

### P3-T07-001 — high — approval is unconditional, so PRF-01..03 can no longer use their canonical approval-free path

- Location: `packages/control-plane/src/lib/reportDeliveryState.ts:13-21,66-74`;
  `packages/control-plane/src/workflows/reportDelivery.ts:154-176`
- The request requires an approval ID/version/expiry for every report and carries no authoritative
  profile or `requiresApproval` decision. The workflow consequently starts `approvalWorkflow` for
  every valid report and cannot schedule delivery unless that child returns `approved`.
- This conflicts with the existing authority in
  `packages/prjops/src/lib/reportJobStateMachine.ts:17-31` and the canonical
  `PrjOps:SPEC-INT-050` transition: PRF-01..03 go directly from `verified` to `delivered`, while only
  PRF-04/05 go through `pending_approval -> approved`. For PRF-01..03, no legitimate approval should
  be created or signalled, so this workflow waits until expiry and turns normal automated delivery
  into `approval-expired` failure.
- The submitted five histories all force the approval path and therefore cannot detect this
  regression. This also makes the PR body's claim that approval profiles are preserved inaccurate.
- Required correction: resolve the report profile from an authoritative activity result (or carry a
  validated authority-issued classification) and reuse the existing `requiresApproval` decision.
  Start the approval child only for PRF-04/05; deliver verified PRF-01..03 without manufacturing an
  approval. Add recorded histories/replay for both an approval-free profile and an approval-required
  profile, including a negative case proving PRF-04/05 still cannot bypass approval.

### P3-T07-002 — high — the lost-response fixture proves a fake ledger model, not safe re-run against DeliveryLogStore

- Location: `packages/control-plane/scripts/record-replay-history.mjs:615-643`;
  `packages/control-plane/src/workflows/reportDelivery.ts:193-209,215-235`
- The fixture activity writes its private `Map` before throwing, and `findReportDelivery` treats any
  Map entry as definitively delivered. That guarantees the fixture's post-failure reconcile succeeds.
  The actual authority does not have that model: `DeliveryLogStore` records `pending` before Graph
  send and `sent` only after the call returns (`AGT05_distributor.ts:53-75`), while
  `ReportDeliveryLogRepo.exists()` recognizes only `sent` and `decideDelivery()` explicitly resends
  `pending` rows with `(再送)`.
- A live exact-head probe using the existing `InMemoryDeliveryLogStore` and `distributeOne` simulated
  a Graph response loss twice. Result:
  `{"sends":2,"status":"pending","exists":false}`. The same `(reportId, recipientId)` was sent
  twice. A smaller authority probe returned
  `{"exists":false,"status":"pending","decision":{"shouldSend":true,"subjectSuffix":"(再送)"}}`.
- Therefore a send accepted externally but left `pending` cannot be proven absent or sent. The first
  workflow correctly ends `E-CP-EXTERNAL-UNRESOLVED`, but the claimed safe re-run story is false:
  preflight cannot reconcile the pending row as success, and re-entering the existing delivery
  authority schedules another send. TMP-003 / SPEC-EXT-023 is not established by the submitted
  history.
- Required correction: make the authority-read contract expose at least `absent | pending | sent`
  and never auto-dispatch a `pending` recipient. Pending must remain unresolved/manual-reconcile
  unless a provider-side immutable delivery identity can confirm the send. Record a history using
  the real pending/sent semantics, then prove both the first unresolved termination and a subsequent
  run do not schedule a second `deliverReport`. Update the PR body to stop claiming no duplicate until
  this is demonstrated.

### P3-T07-003 — high — malformed post-failure reconcile receipt wedges the execution instead of terminating `E-CP-CONTRACT`

- Location: `packages/control-plane/src/workflows/reportDelivery.ts:276-313`;
  `packages/control-plane/src/lib/reportDeliveryState.ts:210-225`
- After `deliverReport` throws, `runExternalSideEffect` calls the reconcile callback. That callback
  parses `findReportDelivery` inside the helper. A malformed or mismatched `sent` receipt therefore
  throws `RangeError` before the helper can return. The outer catch maps only
  `ExternalSideEffectUnresolvedError` and rethrows every other error, so this helper-external contract
  violation is not converted to the required non-retryable `E-CP-CONTRACT` workflow failure.
- A live exact-head Temporal probe used PRF-02 with an absent preflight ledger, a synthetic lost
  `deliverReport` response, then a reconcile result whose `sent` receipt carried a forged idempotency
  key. Temporal repeatedly failed the workflow task at `reportDelivery.ts:284`; after one second the
  execution was still `{"status":"RUNNING","reads":2}`. This is a deterministic poison result, so it
  can retry indefinitely instead of reaching a terminal contract failure.
- Required correction: classify parser failures from the post-failure reconcile path as
  `contractFailure` without misclassifying activity/runtime errors. Add a time-skipping or recorded
  regression proving a mismatched reconcile receipt terminates non-retryably as `E-CP-CONTRACT`, does
  not remain `RUNNING`, and never schedules a duplicate delivery.

## Round 2 disposition

- **P3-T07-001 resolved:** the workflow now resolves and validates the authoritative profile before
  generation, permits `approval: null` only for PRF-01..03, and starts the approval child only for
  PRF-04/05. The approval-free and PRF-05-without-approval histories cover both sides.
- **P3-T07-002 resolved:** the ledger contract now exposes `absent | pending | sent`; `sent` alone is
  reconciled as success, while `pending` is terminal-unresolved and neither preflight nor post-failure
  handling resends it. The unresolved and pending-no-resend histories prove one/zero delivery activity
  schedules respectively.
- The PR body accurately described the 001/002 correction. Finding P3-T07-003 was discovered in that
  round and carried into the round-3 re-review below.

## Round 3 disposition

- **P3-T07-003 resolved:** the reconcile callback now awaits `findReportDelivery` before entering the
  parser catch. Activity/runtime failures therefore propagate unchanged, while only a malformed or
  mismatched ledger receipt is converted to non-retryable `E-CP-CONTRACT`.
- The new reconcile-contract history terminates with
  `EVENT_TYPE_WORKFLOW_EXECUTION_FAILED`, failure type `E-CP-CONTRACT`, and
  `applicationFailureInfo.nonRetryable=true`. It contains exactly one `deliverReport` schedule with
  `maximumAttempts=1`.
- Re-running the original live forged-receipt Temporal probe changed its observed state from
  `{"status":"RUNNING","reads":2}` to `{"status":"FAILED","reads":2}`. No workflow-task retry
  wedge or redispatch was observed.

## Other review judgments

- Recipient key derivation is deterministic and collision-safe within the validated grammar:
  `report/delivery:<reportId>:<recipientId>#deliverReport#0`; delivery receipts bind report,
  recipient, and key, and history shows `maximumAttempts=1` for each `deliverReport` schedule.
- Validation failure correctly terminates before the approval child; rejected approval terminates
  without delivery; malformed preflight/direct delivery receipts become non-retryable
  `E-CP-CONTRACT`; an unresolved external result is not reported as complete.
- Deferring content/profile filtering to the delivery activity is acceptable for this isolated
  workflow task only because the workflow transports IDs and runtime worker wiring is explicitly
  deferred. The contract comment is not production enforcement: P3-T09 wiring must call the existing
  request-time `reportPermissionFilter` and `isActiveRecipient` path and must add a negative integration
  test where an injected out-of-scope/inactive recipient cannot produce a delivery receipt.
- Scope is clean: no `packages/prjops`, `packages/server`, dependency, package manifest, or lockfile
  changes. Only the nine task-owned report-delivery fixtures differ under the fixture tree; merged
  fixtures are byte-identical. The coverage exclusion adds only the sandbox-executed workflow and
  leaves pure lib coverage and thresholds unchanged. `git diff --check` passes.
- PR metadata is correct (App bot author, `ai-generated`, non-draft, exact assigned head), and the PR
  body accurately describes all submitted fixes, including the new reconcile-contract evidence.

## Independent evidence

- Used `gh` first; initial review was at `d707bd7911614eaf2131c1a125ef26c7474e310f`, then reviewed
  https://github.com/mryfmo/ai-ops-platform/pull/213 at exact round-2 head
  `27109b2713547c14a0dca035d035358f6bfec9a1`. No web fallback was used.
- Complete merge-base diff remains confined to the task/control-plane boundary; the fix commit changes
  only report-delivery implementation, tests, recording script, and task-owned fixture histories.
- `pnpm --filter @aiops/control-plane exec vitest run tests/reportDeliveryState.test.ts tests/reportDeliveryReplay.test.ts`:
  23/23 passed, including all eight submitted replays.
- `pnpm --filter @aiops/control-plane run typecheck`: passed.
- `pnpm --filter @aiops/control-plane run lint`: passed.
- Round-2 history inspection: approval-free `child=0`; PRF-05 missing approval `child=0, deliver=0`;
  delivery-unresolved `child=1, deliver=1, find=2`; pending-no-resend `child=1, deliver=0, find=1`;
  all scheduled `deliverReport` activities use `maximumAttempts=1`.
- Round-2 exact-head checks at `27109b2713547c14a0dca035d035358f6bfec9a1`: `build-test`,
  `gitleaks`, and CodeRabbit green.
- Independent `codex review --base origin/main` reported finding P3-T07-001. The pending-ledger live
  probe independently established P3-T07-002.
- Independent `codex review --commit 27109b2` found no regression in the 001/002 fix. A separate live
  Temporal probe independently established P3-T07-003.
- Reviewed the P3-T07-003 fix at exact head `85ff498eea9c6eeda19e65395e112465ee0b18ed`.
  `pnpm --filter @aiops/control-plane exec vitest run tests/reportDeliveryState.test.ts tests/reportDeliveryReplay.test.ts`:
  25/25 passed, including all nine replay fixtures.
- `pnpm --filter @aiops/control-plane exec vitest run --maxWorkers=1`: 183/183 passed. The default
  parallel invocation initially hit the local sandbox's concurrent Temporal ephemeral-server
  `EPERM`; serial execution isolated that environment limit and passed the complete package suite.
- Exact-head live Temporal probe: terminal `FAILED`, two authority reads, non-retryable
  `E-CP-CONTRACT`; the recorded history independently confirms one delivery schedule only.
- Independent `codex review --commit 85ff498` found no actionable regression; its targeted 28 tests,
  typecheck, and lint also passed.
- GitHub exact-head checks at `85ff498eea9c6eeda19e65395e112465ee0b18ed`: `build-test`,
  `gitleaks`, and CodeRabbit green.
- Plan-quality validator/Make target, hook, subagent definition, and CI entry points are not present
  in this repository; no plan file was changed.

## Actions not taken

No PR-branch edit, push, merge, GitHub review submission, dependency change, browser Crit review, or
runtime source edit was performed.

## Verdict

**approve**. Findings P3-T07-001 through P3-T07-003 are independently verified as resolved. The
workflow now preserves profile-specific approval, refuses pending-ledger redispatch, and terminates a
malformed post-failure reconcile receipt non-retryably without duplicating delivery.
