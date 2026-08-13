# P3-T05 validation

- test-first red:
  - missing state/workflow modules: focused suite failed before implementation
  - missing recorded histories: replay suite failed with `ENOENT` before record generation
- focused: `pnpm --filter @aiops/control-plane exec vitest run tests/graphSubscriptionState.test.ts tests/graphSubscriptionSchedules.test.ts tests/graphSubscriptionWorkflow.test.ts tests/graphSubscriptionReplay.test.ts tests/workflow-activity-separation.test.ts --reporter=dot` → 5 files / 37 tests green
- package: `pnpm --filter @aiops/control-plane exec vitest run --maxWorkers=1` → 16 files / 117 tests green; one worker avoids the local sandbox's concurrent ephemeral-server bind ceiling
- package build/typecheck/lint: green
- recorded history: `pnpm --filter @aiops/control-plane run record:replay-history` → four P3-T05 fixtures recorded; all replay green
- TMP-003:
  - lost response: `renewGraphSubscription` scheduled exactly once; authoritative read scheduled before and after the lost response; one object recovered
  - old scheduler first: only `findGraphSubscriptionRenewal` scheduled; `renewGraphSubscription` absent
  - concurrent shadow: workflow write activities are structurally suppressed even when the legacy path races after preflight
- existing history stability: all tracked P3-T02..T04 approval/coding-task/replay-probe fixtures have zero diff from `origin/main`
- full CI: disposable PostgreSQL on `127.0.0.1:55432`; `aiops_test`, `aiops_load_test`, and `aiops_p001` dropped/recreated immediately before same-shell `mise run ci` → exit 0
- control-plane coverage: statements 85.04%, branches 91.82%, functions 85.24%, lines 85.32%
- Graph sandbox: unavailable/explicitly out of scope; no real Graph API call was made
- final CI red/green: the first post-review run rejected four generated JSON histories on formatting; Prettier normalized those fixtures, replay remained green, the databases were recreated, and the second full CI run exited 0
- repository review gate: `make require-crit-review` → unavailable (`No rule to make target`); independent Codex review was used instead

During time-skipping validation, a direct `RangeError` for malformed activity output caused workflow-task retries. It was corrected to a non-retryable `E-CP-CONTRACT` application failure and the regression test is green.

Codex `/review` found three issues and all were resolved: renewal timing now subtracts deterministic Temporal logical time from the absolute deadline; shadow execution structurally suppresses writes instead of relying on a racy preflight; accepted subscription IDs are bounded to the complete workflow business-key limit. A fourth adjacent guard terminates unresolved external writes as non-retryable `E-CP-EXTERNAL-UNRESOLVED` rather than wedging a workflow task.

The next `/review` round found three additional contract gaps and all were resolved: recurring fires now derive fresh renewal identity/target timestamps, the renewal activity timeout covers the Graph subscription lifetime instead of 60 seconds, and every activity input/output is a validated `VersionedPayload` envelope.

The final independent re-review found two timeout-policy gaps. Renewal and delta now retain a 72-hour Graph wait budget while enforcing a one-minute heartbeat timeout; their activity contracts require injected Graph retry waits/page traversal to heartbeat more frequently, so worker loss is detected promptly without truncating valid throttling waits.

A subsequent clean re-review found three cutover gaps and all were resolved: an injected registrar now creates the three recurring Temporal Schedules, unresolved renewal writes preserve the legacy polling/backfill availability transition, and the renewal activity contract no longer carries a stale original expiry on later Schedule fires. Runtime registration remains in P3-T09's explicit shadow-wiring scope.

The last review found four schedule-boundary gaps and all were resolved: interval offsets now anchor recurring fires to the computed first start, renewal catch-up retains the six-hour safety margin, shadow reconcile still performs its read-only authority check, and ScheduleClient I/O moved out of `src/lib` into the orchestration layer. The shadow-reconcile VM branch has a narrow V8 ignore because Temporal executes it in an isolated bundle; the time-skipping test covers that exact path.

## P2 bot finding revision

- test-first red: the two new regressions failed before implementation—malformed renewal output incorrectly entered polling fallback, and `ScheduleAlreadyRunning` rejected registration
- renewal boundary: `runExternalSideEffect` now receives raw execute/reconcile results and the selected result is validated afterward; malformed output fails non-retryably as `E-CP-CONTRACT` and does not invoke polling fallback
- idempotent registration: each create absorbs only Temporal's `ScheduleAlreadyRunning`; unrelated errors still propagate
- focused: `pnpm --filter @aiops/control-plane exec vitest run tests/graphSubscriptionState.test.ts tests/graphSubscriptionSchedules.test.ts tests/graphSubscriptionWorkflow.test.ts tests/graphSubscriptionReplay.test.ts tests/workflow-activity-separation.test.ts --maxWorkers=1 --reporter=dot` → 5 files / 40 tests green
- package: `pnpm --filter @aiops/control-plane exec vitest run --maxWorkers=1 --reporter=dot` → 16 files / 120 tests green
- package build/typecheck/lint and repository format: green
- recorded history: all four P3-T05 fixtures replayed in the focused suite and `git diff --exit-code HEAD -- packages/control-plane/tests/fixtures` → exit 0; fixtures remain byte-identical
- dependency surface: no package manifest or lockfile diff; no new dependency
- fresh-DB full CI: `aiops_test`, `aiops_load_test`, and `aiops_p001` dropped/recreated immediately before same-shell `VITEST_MAX_WORKERS=1 mise run ci` → exit 0
- control-plane coverage: statements 85.17%, branches 91.87%, functions 85.24%, lines 85.71%
- repository review gate: `make require-crit-review` remains unavailable (`No rule to make target`); the two bot findings were independently adjudicated valid before this revision
