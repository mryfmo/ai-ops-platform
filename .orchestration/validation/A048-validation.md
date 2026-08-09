<!-- 根拠: ADR-0016 / DevOps:SPEC-INT-010 / AUD-OPS-002 -->

# A048 validation

## RED evidence

- HTTP RED tests initially failed because the metrics registry had no HTTP recorder and `buildApp` had no middleware wiring: 3 failed with 743 existing server tests passing.
- Rolling delivery metrics suites initially failed with module-not-found for the repo and scheduler task.
- No-data negative controls then failed when empty windows were represented as healthy zero; the contract was corrected to `null` internally and `-1` at export.
- GitHub's stale-sample control failed after a successful value followed by a provider rejection: the prior `0.01/0.02` remained exported. The task now invalidates both gauges to `-1` and rethrows so scheduler failure telemetry remains loud.

## GREEN evidence

- Final targeted monitoring suite after review fixes: 4 files, 10 tests passed.
- Final real-PostgreSQL coverage run: 2,198 tests passed across shared 439, traceability 122, devops 216, prjops 355, server 755, and web 311.
- `mise run typecheck`: green.
- `mise run lint`: green.
- `mise run format`: green.
- `mise run traceability`: green; no catalog/header/namespace/disposition/config guard errors.
- Canonical ZIP mirror verification: green for DevOps 6 and PrjOps 8 mirrors.
- `docs/spec/**` Datadog search: zero matches.
- PostgreSQL migration/partition/permission/idempotency integration: `P001 PostgreSQL integration passed`.
- Production web build using `next build --webpack`: green. The local standard Turbopack build reaches the build phase but macOS Seatbelt rejects its localhost bind; the same command is left to the GitHub `build-test` check in an unrestricted runner.
- `git diff --check`: green.

## Alert parity

- Six source alerts map one-to-one to six scheduled-query definitions.
- Preserved thresholds: queue age 300 seconds, dead depth greater than zero, delivery ratio 1%, task failure ratio 0.5%, fast burn 6%, slow burn 1%.
- Preserved hold durations: 10m, 5m, 30m, 0m, 0m, 0m respectively.
- 3d/7d definitions read only the last minute of precomputed rolling gauges, avoiding the documented two-day alert-query limit.

## Review evidence

- Independent review output: `/private/tmp/A048-independent-review.txt`.
- Scope finding disposition: explicit AGMSG grants cover `docs/DevOps.zip`, `packages/server/src/index.ts`, the repo/task, and their two tests.
- KQL-example finding: fixed in `packages/server/src/observability/httpMetrics.ts`; targeted format/lint/typecheck/tests are green afterward.
- GitHub review findings: stale-gauge invalidation, namespaced specification IDs in repo/task test titles, and basis headers on all five A048 artifacts are fixed and revalidated.
- `make require-crit-review`: unavailable in this repository (`No rule to make target`).

## GitHub evidence

- PR: https://github.com/mryfmo/ai-ops-platform/pull/148
- Implementation commit: `02a8d3484fe7809432ec151e582b0695e764737d`.
- First `gh pr checks 148 --watch`: build-test pass (4m34s), gitleaks pass (9s), CodeRabbit pass.
- The initial GraphQL gate was empty; a later review wave added three actionable threads. All are fixed and explicitly resolved before the final gate.
- PR metadata: `isDraft=false`, `ai-generated` label present, full-scope body includes D-04 and local Turbopack sandbox boundaries.
- The final review-fix commit is pushed and all checks/thread gates are revalidated before AGMSG-RESULT.
