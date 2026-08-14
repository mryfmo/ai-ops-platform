# P3-T10-REVIEW — PR #224 approved at `aab7541`

```yaml
task_id: P3-T10-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-14T17:10:14+09:00
ci_verified_at: 2026-08-14T17:11:15+09:00
round_2_reviewed_at: 2026-08-14T17:25:03+09:00
round_3_reviewed_at: 2026-08-14T17:33:32+09:00
round_4_reviewed_at: 2026-08-14T17:48:54+09:00
final_ci_verified_at: 2026-08-14T17:48:40+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/224
base_sha: 5e5b2318b03beedf156de48486a26f8254a73f3c
initial_head_sha: f9fef706c4c4a58890a76937e4e69733f77ed8cf
head_sha: aab75411b763ce5c44a164aca0c34d583436ad77
verdict: approve
findings_open: 0
findings_resolved: 7
summary: >-
  All findings 001-007 are resolved at aab7541. The final claim-only delta
  narrows source labels to the server-side legacy-writer constraint and states
  the Temporal-pause-first rollback precondition. The PR body matches the exact
  head, final counts, and coordinated rollback boundary; all exact-head checks
  are green.
```

## Findings

### P3-T10-001 — high — the kill switch can leave both execution paths unavailable

- Location: `packages/server/src/config.ts:473-476`;
  `packages/server/src/index.ts:608-613`; `runbooks/temporal-cutover.md:44-54`;
  existing resolver at `packages/shared/src/migration/featureFlags.ts:197-212`.
- The documented primary configuration requires
  `AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED=false`. Setting only
  `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL=1` changes the resolved Temporal
  stage to `false`, but leaves the legacy flag `false`. The cutover selector
  therefore returns an empty suppressed set while `index.ts` still sets
  `scheduler=null`; none of the 15 legacy tasks return.
- Exact-head probe:
  `primary + KILL=1 + legacy=false` resolved with `errors=[]`,
  `temporal=false`, `legacy=false`, and `suppressed=0`. The same unsafe
  zero-writer state is accepted for `temporal=false + legacy=false`; limited
  plus legacy=false also disables the whole legacy scheduler rather than only
  the selected tasks.
- Existing test coverage only exercises KILL with the legacy flag omitted, so
  the canonical default `true` masks the primary rollback failure.
- The Temporal schedule side is not driven by this server setting either;
  the runbook separately asks the operator to shadow/pause it. Thus the text
  claiming an unconditional, one-env full rollback is not mechanically true.
- Required correction: enforce an exactly-one-writer-safe flag matrix. If the
  required contract remains one-variable rollback, KILL must restore the
  effective legacy scheduler even when the persisted primary configuration
  has `legacy=false`, and the Temporal side must be placed in a non-writing
  state by the same authoritative operation. Reject other non-primary
  `legacy=false` combinations, and add `loadConfig`/startup regression tests
  for primary+kill+legacy=false, false+legacy=false, limited+legacy=false, and
  malformed base/kill values. Otherwise narrow the task and runbook to an
  explicitly coordinated multi-setting rollback.

### P3-T10-002 — high — TMP-005 ignores the cutover wrapper identity and shape

- Location: `packages/server/tests/temporalCutover.test.ts:18-20`;
  `verification/temporal-shadow/shadow.ts:477-544,748-760`;
  `packages/server/src/index.ts:539-540,613-910`.
- The new equality test compares the constant array with
  `EXPECTED_SCHEDULER_REGISTRATIONS`. The shadow parser independently finds
  the inner `create*Task()`/inline object, but never reads the first argument
  to `cutover()` and never requires exactly one cutover wrapper.
- A live mutation changed only the healthcheck wrapper key from
  `createHealthcheckTask` to `createReportDeliveryTask`. The extracted
  scheduler inventory remained byte-for-byte equal to the expected 15-item
  inventory (`inventoryStillEqual=true`). Removing a wrapper or nesting an
  extra wrapper is likewise transparent to this AST classification.
- This permits a future change to suppress the wrong task, fail to suppress a
  selected task, or double-wrap a task while the gate advertised as TMP-005
  remains green. That can create duplicate or missed execution at cutover.
- The current exact head was independently parsed and is correct today: 15
  entries, 15 unique outer keys, no unwrapped entries, and no outer/inner
  mismatch, including the conditional JIT spread and inline task. The finding
  is that the blocking invariant does not preserve that property.
- Required correction: extend the AST guard to require every effective
  scheduler element to have exactly one `cutover(<literal>, <task>)`, require
  the literal to equal the classified inner registration, and compare those
  wrapper literals in exact order with both inventories. Add negative
  mutations for wrong key, missing wrapper, duplicate wrapper, duplicate key,
  and the conditional JIT entry.

### P3-T10-003 — medium — suppressed scheduler ticks bypass all existing task metrics

- Location: `packages/server/src/index.ts:531-540` and each wrapper at
  `packages/server/src/index.ts:615-909`;
  `packages/server/src/scheduler/scheduler.ts:56-72`.
- Composition is `cutover(name, observedTask(...))`. When selected, the outer
  cutover spread replaces the already-instrumented task's `run` with a no-op,
  so `instrumentScheduledTask()` is never entered. It also bypasses any inner
  failsafe guard/audit.
- Exact-head composition probe produced `underlyingRuns=0` and
  `metricPresent=false` after a suppressed tick. There is no dedicated
  suppressed-task counter/gauge, only one startup log line.
- This makes an intentional cutover indistinguishable from a scheduler that
  stopped ticking once startup logs have aged out, weakening soak and rollback
  evidence. It also contradicts the review assignment's stated assumption
  that the outer guard still lets metrics observe no-op ticks.
- Required correction: choose and document the intended observability
  contract. Either instrument the no-op by composing `observedTask(cutover(...))`
  (while avoiding false ordinary-success semantics), or preferably expose a
  dedicated cutover-suppressed metric/audit signal. Add a wrapper-order test
  covering suppressed, non-suppressed, and failsafe-active runs.

### P3-T10-004 — medium — the committed diff exceeds the recorded task scope

- Location: `.orchestration/tasks/P3-T10-scheduler-cutover.md:8-12,31-54`;
  `docs/reference/configuration.md:33`; `.env.example:74`.
- The task grants server config/index, runbooks, server tests, and the explicit
  temporal-shadow amendment. It does not grant `docs/reference/**` or
  `.env.example`.
- `.env.example` has a separate explicit `P3-T10-ENVEX` micro-task grant in
  agmsg, but that amendment is not recorded in the task file. No corresponding
  grant was found for `docs/reference/configuration.md`; adding one table row
  also reformats 100 surrounding lines (51 additions / 50 deletions).
- Required correction: record both documentation amendments in the task
  artifact before acceptance, or remove the ungranted configuration-reference
  change. If retained, reduce unrelated table churn where the formatter allows.

### P3-T10-005 — low — the PR body test count does not match the exact head

- Location: PR #224 description.
- The body claims `server 861 tests`. Running the full server test command at
  exact head `f9fef70` collected 867 tests: 854 passed and 13 skipped across
  79 files (78 passed, 1 skipped).
- Required correction: after the code findings are fixed, refresh the complete
  PR body with the new exact head, actual collected/pass/skip counts, and final
  exact-head GitHub check results.

## Positive checks

- GitHub CLI was used first. PR metadata, body, commits, files, comments,
  review threads, and checks were inspected at exact head
  `f9fef706c4c4a58890a76937e4e69733f77ed8cf`.
- The current implementation has all 15 expected tasks wrapped exactly once
  with matching keys; ordering matches the P3-T09 inventory. The conditional
  JIT entry and inline capability-metrics entry are present and correctly
  classified.
- The selector correctly implements the intended ordinary false/shadow,
  limited, and primary cases. Unknown names, duplicates, empty limited lists,
  primary residual lists, invalid stages, and malformed kill values fail
  closed through the existing paths.
- Non-suppressed tasks retain their previous observed/failsafe composition;
  suppressed tasks retain registration metadata (`name`, interval,
  `runOnStart`) and become no-op runs.
- All four P3-T09 mutation anchors still hit the exact source and fail for the
  intended semantic mutation. Focused cutover/shadow tests pass (2 files / 11
  tests), including the read-only bundled shadow-runner checks.
- `git diff --check`, changed-file Prettier check, server typecheck, server
  lint, and traceability pass. Full server tests pass: 78 files passed, 1
  skipped; 854 tests passed, 13 skipped (867 total).
- Exact-head GitHub Actions run `31782347206` is green: `build-test` and
  `gitleaks` pass, and CodeRabbit reports success.
- No PR branch edit, push, merge, or GitHub review submission was performed.

## Understand-diff fallback

`.ua/knowledge-graph.json` is absent, so impact analysis used the exact
merge-base diff plus `rg` caller/consumer tracing. No diff overlay was written
because the task permits editing only this review artifact.

## Verdict

Revise. Findings P3-T10-001 and P3-T10-002 are blocking correctness gaps in
the rollback and TMP-005 contracts. Findings 003-005 must also be resolved or
explicitly dispositioned before approval.

## Round 2 at `cc5bc2d`

### Disposition of findings 001–005

- `P3-T10-001`: resolved for the server-side zero-writer defect.
  `resolveLegacySchedulerEffective()` rejects non-primary `legacy=false`,
  primary still requires `legacy=false`, and KILL restores the effective
  legacy scheduler from a persisted primary configuration. An independent
  `loadConfig` probe confirmed primary produces `effective=false` with 15
  suppressed tasks, primary+KILL produces `effective=true` with zero
  suppressed tasks, unsafe false/limited+legacy=false fail E-CFG08, and
  malformed base/kill values remain fail-closed. End-to-end dual-writer
  behavior is tracked separately as finding 006.
- `P3-T10-002`: resolved for the reported direct wrapper-key cases. The AST
  guard now rejects a missing/double wrapper, wrong/non-literal key, and
  duplicate key. The current 15 entries, including conditional JIT and the
  inline task, have matching unique literals. The remaining composition-chain
  weakness is tracked separately as finding 007.
- `P3-T10-003`: resolved for current-head runtime behavior. All entries now use
  `observedTask(cutover(...))`, so a suppressed no-op reaches task-duration
  instrumentation. The missing regression pin is tracked as finding 007.
- `P3-T10-004`: resolved. The task file now records both the
  configuration-reference amendment and the separately authorized
  `P3-T10-ENVEX` edit.
- `P3-T10-005`: resolved. The stale `861 tests` claim was removed. The refreshed
  body accurately reports the focused 12 cutover and 5 shadow tests and avoids
  asserting an incorrect full-suite count while code is still changing.

### P3-T10-006 — high — KILL restores legacy while active Temporal schedules remain writers

- Location: `packages/server/src/config.ts:95-119,514-518`;
  `packages/server/src/index.ts:608-615`;
  `runbooks/temporal-cutover.md:49-54`;
  `packages/control-plane/src/lib/jitHealthSchedules.ts:15-52` and
  `packages/control-plane/src/lib/graphSubscriptionSchedules.ts:16-85`.
- The server-side zero-writer case is fixed, but the new function is named and
  documented as enforcing exactly one writer without controlling the other
  writer. Existing Temporal schedules embed `executionMode: "active"` in their
  registered action input. No control-plane consumer reads
  `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL` or the resolved stage.
- On rollback from primary, KILL now restarts all legacy tasks immediately,
  while already-active Temporal schedules remain active until a separate
  operator action shadows or pauses them. The runbook itself lists that manual
  action after the restart instruction. This is an accepted configuration that
  leaves both paths alive and can duplicate writes—the second half of the
  original adversarial one-writer question.
- Required correction: either make the authoritative rollback operation
  quiesce/pause the Temporal schedules before enabling legacy, with evidence
  that no overlap window exists, or narrow all code/PR/runbook claims from
  “exactly-one-writer” and “single-env full rollback” to server-side legacy
  restoration and prescribe an ordered, coordinated rollback that pauses
  Temporal before restart. Add a testable operational guard/evidence for the
  chosen boundary.

### P3-T10-007 — medium — the AST gate does not pin the metrics-safe composition it claims

- Location: `verification/temporal-shadow/shadow.ts:542-580`;
  `packages/server/tests/temporalShadow.test.ts:53-92`;
  `packages/server/tests/temporalCutover.test.ts:93-106`.
- `cutoverKeyOf()` recursively finds any one `cutover()` descendant but does
  not require the scheduler element to be an outer `observedTask()` whose
  direct argument is `cutover()`. The metrics regression from finding 003 can
  therefore return without failing TMP-005.
- Exact-head live probes showed both the required
  `observedTask(cutover(task))` and the old metrics-breaking
  `cutover(observedTask(task))` are accepted. A synthetic element where an
  unrelated nested/decoy cutover exists while the classified task is not
  wrapped is also accepted.
- The new runtime test constructs a no-op object and instruments it directly;
  it does not parse or exercise the actual `index.ts` composition. The PR body
  statement that the AST guard pins composition is therefore false.
- Required correction: require the effective element's outer call to be
  `observedTask`, require its direct/sole task argument to be the single
  `cutover(<matching literal>, <classified task>)`, and reject reverse-order or
  decoy descendants. Add both mutations to the shadow test; keep the current
  runtime metric assertion.

### Round-2 validation

- GitHub CLI was used first. PR metadata, refreshed body, commits, files,
  threads, and checks were inspected at exact head
  `cc5bc2df0732455a9c3845045358ca99ffe1609d`.
- Fix delta `f9fef70..cc5bc2d` passes `git diff --check` and the changed-file
  Prettier check.
- Focused cutover/shadow run: pass, 2 files / 17 tests.
- Full server run: pass, 78 files passed and 1 skipped; 860 tests passed and 13
  skipped (873 total).
- Server typecheck and lint pass.
- GitHub gitleaks and CodeRabbit are green. Exact-head build-test remained in
  progress at the time of this round-2 review.
- `.ua/knowledge-graph.json` remains absent; impact analysis used exact-head
  diffs and `rg`. No overlay was written due the review-only edit boundary.

## Current verdict

Revise. Findings 001–005 are resolved at the current head, but findings 006 and
007 remain open. The current code path is improved; the remaining blockers are
the end-to-end dual-writer rollback boundary and the unpinned observability
composition.

## Round 3 at `7045db9`

### Disposition of findings 006–007

- `P3-T10-007`: resolved. `extractSchedulerRegistrations()` now requires each
  effective element to be exactly `observedTask(cutover(<literal>, <task>))`,
  classifies only the direct cutover task subtree, and rejects reverse-order,
  nested-wrapper, decoy, and non-literal mutations. The current 15-task source
  is accepted and the focused 17-test run passes.
- `P3-T10-006`: partially resolved. The config contract and runbook now state
  that KILL restores only the server-side legacy writer, require Temporal
  pause/shadow before KILL+restart, document the overlap hazard, and emit a
  startup warning when KILL is active. This is a valid coordinated rollback
  boundary. However, the requested claim narrowing is incomplete:
  `packages/server/src/index.ts:618` still calls the config decision
  `exactly-one-writer`; `packages/server/tests/temporalCutover.test.ts:70-76`
  still names the suite `exactly-one-writer`, claims `writer=Temporal`, and
  describes a one-env emergency rollback without the pause precondition; and
  the PR body still advertises exactly-one-writer enforcement and a one-env
  mechanically complete rollback. Those claims exceed what the code controls.
  Rename them to the server-side legacy-writer constraint/restoration and state
  the required Temporal-pause-first precondition.

### Reopened finding 005

- The PR body still declares head `cc5bc2d` while the exact head is `7045db9`,
  and its rollback claims remain stale. Refresh the body after the remaining
  claim-only correction with the exact head, final focused/full-suite counts,
  and exact-head check result.

### Round-3 validation

- GitHub CLI was used first. PR metadata, commits, files, comments, review
  threads, and checks were inspected at exact head
  `7045db90d34057865a82ede2ef1a64f748d77d8c`; no review threads exist.
- Delta `cc5bc2d..7045db9` passes `git diff --check` and the changed-file
  Prettier check.
- Focused cutover/shadow run: pass, 2 files / 17 tests. Server typecheck passes.
- A local `mise run ci` attempt stopped at `db:require` because this reviewer
  environment has no disposable PostgreSQL variables; it did not reach test
  execution. The writer reports a fresh-DB full CI pass. GitHub gitleaks and
  CodeRabbit are green; exact-head build-test remained in progress during this
  review.
- `.ua/knowledge-graph.json` remains absent; impact analysis used exact-head
  diffs and `rg`. No overlay was written due the review-only edit boundary.

## Round-3 verdict

Revise, claim-only. Finding 007 is fully resolved and there are no new
behavioral code findings. Finish finding 006 by removing the residual
end-to-end one-writer/single-env claims, refresh the PR body for the final exact
head (finding 005), and provide green exact-head build-test evidence.

## Round 4 at `aab7541`

### Final disposition

- `P3-T10-006`: resolved. The only code delta renames the index comment and
  cutover test descriptions to the server-side legacy-writer constraint,
  explicitly states that Temporal remains outside this flag's authority, and
  records the pause-before-KILL precondition. There is no behavioral change.
- `P3-T10-005`: resolved. The PR body identifies exact head `aab7541`, describes
  the coordinated rollback boundary without an end-to-end one-writer claim,
  and reports the final focused and server-suite counts.
- No new findings. Findings 001–007 are all resolved.

### Final validation

- GitHub CLI was used first. The final head is
  `aab75411b763ce5c44a164aca0c34d583436ad77`; the PR body matches that head and
  full PR contents. No review threads exist.
- Claim-only delta `7045db9..aab7541` changes 2 files (6 additions, 5
  deletions), passes `git diff --check`, and contains no runtime behavior change.
- Independent focused run: 2 files / 17 tests pass. Server typecheck and
  changed-file Prettier checks pass.
- Exact-head GitHub Actions run `31784891068` is green: build-test and gitleaks
  pass; CodeRabbit reports success.
- `.ua/knowledge-graph.json` is absent, so impact analysis used the exact delta
  and `rg`; no overlay was written due the review-only edit boundary.

## Final verdict

Approve unconditionally at exact head `aab7541`. All review findings are
resolved and all required exact-head checks are green.
