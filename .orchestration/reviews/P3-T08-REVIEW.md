# P3-T08-REVIEW — PR #215 re-reviewed at `36e6640`

```yaml
task_id: P3-T08-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-14T10:31:26+09:00
re_reviewed_at: 2026-08-14T11:01:45+09:00
round_3_reviewed_at: 2026-08-14T11:09:14+09:00
final_reviewed_at: 2026-08-14T11:14:22+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/215
base_sha: 843bdcaf52bcd54077df7f834288c7dfd448b1b9
initial_head_sha: 97d89b584dd99f59d0aebccddfc41f83c897bd58
round_2_head_sha: c79789dd702c05a27d0aa175eb88fd2aa285df03
head_sha: 36e6640bd3abf6defeba2536fdb18aebde5789c3
verdict: approve
findings_open: 0
findings_resolved: 8
summary: >-
  Findings P3-T08-001 through P3-T08-008 are resolved at 36e6640. The PR
  description matches the exact head, local validation is green, and exact-head
  build-test, gitleaks, and CodeRabbit checks are green.
```

## Findings

### P3-T08-001 — high — resolved at `c79789d` — accepted dedupe identities collide and can exceed the workflow ID limit

- Location: `packages/control-plane/src/workflows/planeSync.ts:87-94,129,249,347`;
  `packages/control-plane/src/lib/planeSyncState.ts:45-63`
- `identityKey()` joins four independently colon-permitting fields with `:`.
  Two valid, different tuples — `(github, issue:a, proj, 3)` and
  `(github, issue, a:proj, 3)` — both produce
  `plane-sync/github:issue:a:proj:3`. They therefore share parent/child workflow
  IDs and idempotency scopes instead of implementing the canonical quadruple
  identity.
- The request validator also accepts maximum field lengths whose joined key is
  longer than `buildWorkflowId()` permits. An exact-head Temporal probe left
  that otherwise-valid parent workflow `RUNNING` after the uncaught `RangeError`
  failed its workflow task; the ID builder is outside the contract-failure
  guards.
- Required correction: use one collision-free, bounded canonical encoding (or
  constrain the accepted grammar and combined length) for all four fields,
  translate construction errors to `E-CP-CONTRACT`, and add collision and
  boundary-length regression tests.

### P3-T08-002 — high — resolved at `c79789d` — directly callable child workflows can write with an invalid identity

- Location: `packages/control-plane/src/workflows/planeSync.ts:101-116,197-232`
- All three children are exported Temporal workflows, but `assertChildRequest()`
  checks only that `identity` is a non-null object. It does not run the full
  field validation used by the parent.
- An exact-head Temporal probe directly started `planeProjectionWorkflow` with
  `externalId: ""`; it completed with `outcome: "executed"` and dispatched one
  external write. Unknown payloads are therefore referenced at an exported
  trust boundary before validation.
- Required correction: export/reuse the full identity validator from the
  state module in every child before building IDs or scheduling activities,
  with direct-child negative tests for malformed and missing fields.

### P3-T08-003 — high — resolved at `c79789d` — promotion reconciliation bypasses the draft and baseline receipt contract

- Location: `packages/control-plane/src/lib/planeSyncState.ts:129-149,184-203`;
  `packages/control-plane/src/workflows/planeSync.ts:261-272,295-324`
- The shared ledger's `written` receipt binds only the identity and idempotency
  key. Promotion preflight accepts that generic receipt immediately, and the
  lost-response path validates `parsePlanePromotionDraftReceipt()` only when
  the outcome is `executed`, never when it is `reconciled`.
- In an exact-head lost-response probe, reconciliation returned a generic
  `written` receipt with neither `baselineRevision` nor `draft`; the workflow
  still completed `promotion/reconciled` after one write and two ledger reads.
  No runtime activity adapter in this change invokes integrations'
  `operationBoundary`, so the result contract alone is not a capability
  boundary and cannot undo a publish performed by an activity.
- Required correction: make every promotion `written`/reconciled receipt bind
  the pinned baseline, draft status, and immutable provider object/readback,
  validate it on both preflight and lost-response paths, and wire the activity
  through the existing capability-limited draft-only adapter/boundary. If the
  runtime wiring is deferred, amend the task/PR claims rather than describing
  the boundary as mechanically enforced.

### P3-T08-004 — high — resolved at `c79789d` — the revision re-read does not close the stale-write TOCTOU window

- Location: `packages/control-plane/src/workflows/planeSync.ts:283-302`
- `readWorkItemRevision` and `createPromotionDraft` are separate activities.
  The authoritative revision can change after the comparison and before the
  write, so the re-read does not guarantee that Git/Plane drift terminates
  `stale`.
- An exact-head probe returned `rev-7`, changed authoritative state to `rev-8`
  immediately before the create activity, and still completed
  `promotion/executed` with one write.
- Required correction: enforce the baseline in the write authority itself
  (CAS/precondition or an immutable pinned snapshot) and test a revision change
  between the read and write. A prior read alone is insufficient.

### P3-T08-005 — medium — resolved at `c79789d` — operational read failures are converted into non-retryable contract failures

- Location: `packages/control-plane/src/workflows/planeSync.ts:141-150,238-244,261-269,285-290`
- These blocks put the activity `await` and the parser in one `try/catch`.
  Exhausted activity retries are caught and rewritten as `E-CP-CONTRACT`, even
  though the established invariant requires only malformed activity results to
  become contract failures.
- In an exact-head probe, five failed `findPlaneSyncWrite` attempts terminated
  as non-retryable `E-CP-CONTRACT` with message `Activity task failed`, rather
  than preserving the `ActivityFailure`; no write was dispatched.
- Required correction: await the activity outside the parser catch at all four
  sites, as the reconciliation callbacks already do, and cover outage versus
  malformed-result behavior separately.

### P3-T08-006 — high — resolved at `c79789d` — the six replay fixtures contain no child activity execution evidence

- Location: `packages/control-plane/tests/fixtures/plane-sync.*.history.json`;
  `packages/control-plane/tests/planeSyncReplay.test.ts`
- Independent inspection of every new fixture found zero
  `activityTaskScheduled` events. They are parent histories, so replay consumes
  recorded child completions/failures without running or inspecting the child
  workflow histories where all reads, writes, retry policies, parsing, pending
  handling, and stale decisions occur.
- The fixtures therefore cannot substantiate the PR body's claims that replay
  proves write-zero shadow/stale/eligibility paths, one write on lost response,
  no duplicate write, or `maximumAttempts=1`. This evidence gap is material:
  the direct probes above demonstrate unsafe child paths while all parent
  replays remain green.
- Required correction: record and replay the three child histories (or add
  equivalent live time-skipping workflow tests), assert scheduled activity
  names/counts and retry policy, and keep all previously merged fixtures
  byte-identical.

## Positive checks

- The parent delegates projection, event, and promotion to three distinct child
  workflow types and executes requested operations deterministically in order.
- The generic write path uses preflight `absent|pending|written`, suppresses
  shadow writes, sets `maximumAttempts=1`, and reconciles after an unknown write
  result. The recorded pending child failure propagates
  `E-CP-EXTERNAL-UNRESOLVED` through the parent.
- Fixture workflow IDs are unique, previously merged fixtures are unchanged,
  and the coverage-exclude amendment is limited to the authorized workflow
  entry file.
- The diff is confined to the task's control-plane/orchestration scope; no
  dependency, integrations, server, or prjops source changes are present.

## Independent validation

- GitHub CLI was used first. PR metadata and checks were re-read at exact head
  `97d89b584dd99f59d0aebccddfc41f83c897bd58`; `build-test`, `gitleaks`, and
  CodeRabbit are green.
- `pnpm --filter @aiops/control-plane exec vitest run --maxWorkers=1`: pass,
  24 files / 202 tests.
- Focused plane/state/replay/side-effect run: pass, 3 files / 22 tests.
- `pnpm --filter @aiops/control-plane run typecheck`: pass.
- `pnpm --filter @aiops/control-plane run lint`: pass.
- `git diff --check`: pass.
- Independent `codex review --commit 97d89b5...` corroborated findings 001,
  002, 003, and 005.

## Initial verdict at `97d89b5`

Revise. Six findings remain open. Green tests and parent replay do not cover the
unsafe direct-child, promotion-reconcile, and stale-race paths above, and the PR
description overstates mechanical draft/baseline enforcement and fixture proof.

## Round 2 at `c79789d`

### Disposition of findings 001–006

- `P3-T08-001`: resolved. The delimiter is excluded from all string identity
  fields, combined lengths fit the 200-character business-key bound, and ID
  construction is inside `E-CP-CONTRACT` guards. The exact maximum accepted
  identity completed a live parent workflow; colon-bearing collision inputs
  failed before activities.
- `P3-T08-002`: resolved. Parent and all directly callable children reuse
  `assertPlaneSyncIdentity`. A live direct-child probe with an empty external ID
  terminated `E-CP-CONTRACT` with zero writes, and the recorded negative child
  history contains zero activities.
- `P3-T08-003`: resolved. Promotion preflight and lost-response reconciliation
  now use the promotion-specific draft receipt parser. A live forged generic
  reconcile receipt terminated `E-CP-CONTRACT`; the committed-lost child
  history binds the exact baseline and `draft:true`. The PR description now
  explicitly scopes this to contract-level enforcement and defers runtime
  operationBoundary wiring.
- `P3-T08-004`: resolved for the requested TOCTOU path. The create activity now
  carries an explicit CAS/precondition contract and returns `created|stale`;
  the child history covers revision movement between the prior read and CAS.
  The remaining malformed-result issue is tracked separately as 007.
- `P3-T08-005`: resolved. All four activity awaits are outside parser catches.
  A live five-attempt authority-read outage propagated `ActivityFailure`
  (`Activity task failed`) rather than `E-CP-CONTRACT`, with zero writes.
- `P3-T08-006`: resolved. Child histories now expose activity names/counts and
  `maximumAttempts=1` for the write paths; replay exercises 15 representative
  parent/child histories and the static assertions cover the additional
  recorded shadow children.

### P3-T08-007 — medium — resolved at `36e6640` — contradictory CAS stale results are accepted

- Location: `packages/control-plane/src/lib/planeSyncState.ts:260-280`;
  `packages/control-plane/src/workflows/planeSync.ts:324-340`
- `parsePlanePromotionWriteResult()` receives `pinnedBaseline`, but its
  `result: "stale"` branch only checks that `observedRevision` has a valid
  shape. It accepts `observedRevision === pinnedBaseline`, even though the task
  contract defines stale only when the pinned baseline and current revision
  differ.
- An exact-head live workflow probe supplied a CAS result with both values
  `rev-7`; the child completed `{ operation: "promotion", outcome: "stale" }`
  instead of rejecting the contradictory activity result. This permits a
  malformed or faulty activity to suppress an otherwise eligible promotion.
- Required correction: reject a stale result when `observedRevision` equals
  `pinnedBaseline` and convert it to `E-CP-CONTRACT`; add a pure parser test and
  one workflow/fixture negative case. The existing genuine `rev-7 → rev-8`
  CAS-stale history must remain green.

### Round-2 validation

- GitHub CLI was used first. PR body, commits, files, and checks were inspected
  at exact head `c79789dd702c05a27d0aa175eb88fd2aa285df03`;
  `build-test`, `gitleaks`, and CodeRabbit are green.
- `pnpm --filter @aiops/control-plane exec vitest run --maxWorkers=1`: pass,
  24 files / 219 tests.
- Focused plane/state/replay/side-effect run: pass, 3 files / 39 tests.
- `pnpm --filter @aiops/control-plane run typecheck`: pass.
- `pnpm --filter @aiops/control-plane run lint`: pass.
- `git diff --check 97d89b5..c79789d`: pass; merged non-Plane fixtures are
  unchanged.
- Independent `codex review --commit c79789d...` independently reproduced
  finding 007 at the same parser branch.

## Round 3 at `36e6640`

### Disposition of finding 007

- `P3-T08-007`: resolved. The shared parser rejects a stale result when its
  observed revision equals the pinned baseline. A live exact-head child probe
  now terminates `E-CP-CONTRACT` after one CAS write and one authority read;
  the pure parser test and recorded negative child history cover the same
  contradiction, while the genuine `rev-7` to `rev-8` stale history remains
  green.

### P3-T08-008 — low — resolved — PR description is stale after the finding-007 fix

- Location: PR #215 description.
- The description names head `c79789d`, reports 219 control-plane tests and 15
  replay histories, and does not mention the equality guard or negative stale
  fixture. The actual reviewed head is `36e6640`, with 221 tests and 16 replay
  histories.
- Required correction: refresh the complete PR description to identify head
  `36e6640`, 221 tests, 16 replay histories, and the finding-007 contract fix.

### Round-3 validation

- GitHub CLI was used first. PR metadata, body, commits, diff, and checks were
  inspected at exact head `36e6640bd3abf6defeba2536fdb18aebde5789c3`;
  gitleaks and CodeRabbit are green, while build-test is still in progress.
- `pnpm --filter @aiops/control-plane exec vitest run --maxWorkers=1`: pass,
  24 files / 221 tests.
- Focused plane/state/replay/side-effect run: pass, 3 files / 41 tests.
- `pnpm --filter @aiops/control-plane run typecheck`: pass.
- `pnpm --filter @aiops/control-plane run lint`: pass.
- `git diff --check c79789d..36e6640`: pass.
- Exact-head live probes cover malformed identity, identity length, generic
  promotion receipts, contradictory stale results, and authority-read outages.

## Round 4 at `36e6640`

### Disposition of finding 008

- `P3-T08-008`: resolved without a code change. The complete PR description now
  identifies head `36e6640`, reports 221 tests and 16 replay histories, and
  documents the finding-007 equality guard plus its parser and workflow-fixture
  evidence.

### Final validation

- GitHub CLI was used first. PR metadata and the refreshed full description
  were re-read at exact head `36e6640bd3abf6defeba2536fdb18aebde5789c3`.
- Exact-head GitHub Actions run `31762721214`: build-test and gitleaks pass;
  CodeRabbit is green.

## Current verdict

Approve. Findings 001–008 are resolved, the PR description matches the full
current change, and all exact-head local and GitHub gates are green.
