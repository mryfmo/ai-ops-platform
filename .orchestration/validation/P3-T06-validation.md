# P3-T06 validation

- test-first red:
  - contract/schedule/workflow suites initially failed because the P3-T06 modules did not exist
  - replay suite initially failed with `ENOENT` before the three histories were recorded
  - health persistence regression initially failed when an active `none` decision skipped the state update; active evaluation now applies every observation
  - first independent Codex review found that an inconsistent unhealthy receipt (`consecutiveFailures >= 3`, `decision: none`) could suppress failsafe application; three parser cases and one workflow assertion failed before the shared parser boundary was hardened
  - fix-commit re-review found that rejecting that receipt still exited before the required safety write; the corrected parser/workflow assertions failed twice before the boundary normalized three-or-more failures to `activate_failsafe`
  - safety-normalization re-review found that reusing normalization for the write receipt could falsely confirm an unapplied failsafe; parser and workflow assertions failed twice before evaluation normalization and strict application confirmation were separated
- focused state/schedule/workflow tests: 3 files / 32 tests green
- review-fix state/workflow tests: 2 files / 29 tests green after red runs of four, two, and two tests
- recorded-history replay: 1 file / 6 tests green
- complete control-plane package: 20 files / 158 tests green
- reused DevOps authority: `agtSec.test.ts` and `agtOrch.test.ts`, 2 files / 19 tests green
- control-plane coverage: statements 85.74%, branches 90.82%, functions 87.01%, lines 86.16%; all configured thresholds passed
- TMP-003:
  - lost-response history schedules `revokeExpiredGrant` once and `findJitRevocation` before and after the lost response
  - revoke activity retry policy has `maximumAttempts=1`
  - unresolved execute plus absent reconcile is non-retryable and never reported as success
- shadow boundary:
  - JIT shadow history schedules candidate and reconcile reads only; revoke is absent
  - health shadow time-skipping test evaluates the decision and schedules no apply write
- history stability: all pre-existing P3-T02..T05 fixtures have zero diff from `origin/main`
- standalone gates: control-plane build, typecheck, lint, format, replay, package tests, and coverage green
- fresh DB full CI: uniquely named disposable databases `p3t06_test`, `p3t06_load_test`, and `p3t06_p001` were recreated on `127.0.0.1:55432`; the required environment and `mise run ci` ran in the same shell and exited 0
- full CI included governance, contracts, production dependency audit, actionlint, lint, traceability, format, build, typecheck, all workspace coverage suites, and DB integration
- production dependency audit reported the repository baseline of 1 low and 2 moderate vulnerabilities; no high/critical issue and no dependency diff

The plan-quality validator, hook, reviewer definition, Make target, and CI entrypoint documented by the skill are absent from this repository, so that optional gate could not run. The repository Definition of Done passed independently.
