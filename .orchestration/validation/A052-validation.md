<!-- 根拠: DevOps:REQ-003 / DevOps:REQ-010 / DevOps:REQ-012 / TH-001 / TH-003 / AC-010a -->

# A052 validation

## RED evidence

- Shared client tests initially failed because bounded workflow artifact reading and workflow-existence APIs did not exist: 3 failures, 17 existing passes.
- Server suites initially failed at module resolution/API boundaries for the deploy handler, approved-deploy task, deployments writer, monitor task, and three capability flags.
- The review reachability check found that a future successful `deploy-prod.yml` run left its row in `prod_deploying`; a regression test was added before the success-event CAS writer.
- GitHub review produced four RED regressions: failed production workflow completion did not terminate state, approval consumption was not crash-recoverable, successful CI was not routed to AGT_DEP, and rollback could repeat every 60 seconds.

## GREEN evidence

- Final review-targeted suites: 5 files, 46 tests passed.
- Final server suite: 780 tests passed, 4 existing environment-gated skips.
- Final full package test run after review fixes: 2,219 tests passed (shared 442, traceability 122, devops 210, prjops 355, server 780, web 310); environment-gated existing skips remain.
- Pre-review full package test run: 2,213 tests passed (shared 442, traceability 122, devops 210, prjops 355, server 774, web 310); environment-gated existing skips remain.
- Real-PostgreSQL coverage run before the final reachability regression: 2,217 tests passed, including all 216 DevOps tests and 771 server tests.
- Real PostgreSQL approval claim probe: `mappingCount=2`, second claim `null`, atomic audit action `approval_dispatch_claim`.
- Final real PostgreSQL recovery probe: the first claim atomically returned a deployment ID and persisted one `(PJ-052, acme/widget, commit_sha, approved)` work item; the second claim returned `null`.
- `verification/run_db_integration.sh`: `P001 PostgreSQL integration passed`; migration apply 16/skip 16 proves idempotency.
- `mise run typecheck`: green.
- `mise run lint`: green.
- `mise run format`: green.
- `mise run traceability`: green; no catalog/header/namespace/disposition/config guard errors.
- `actionlint`: green for the pinned upload-artifact workflow addition.
- Coverage evidence aggregation probe: deterministic commit-bound JSON, aggregate line coverage 87.68% across devops/prjops/server/shared/web.
- Production web build using `next build --webpack`: green. Local standard Turbopack reaches CSS processing but macOS Seatbelt rejects its localhost bind; GitHub's unrestricted build-test runner remains the canonical standard-build check.
- `git diff --check`: green.

## Boundary evidence

- TH-001 exactly at 80% with Critical=0 reaches the existing deterministic evaluator; missing Critical evidence and commit-mismatched coverage do not call promotion.
- Workflow absence and workflow-observation failure both produce `dispatch_failed` rows without calling execute.
- Missing SHA, missing mapping, and two mappings consume once, audit, and never dispatch.
- Missing metrics never invokes TH-003 evaluation with invented zeros.
- Missing stable history or rollback workflow invokes evaluation with an empty candidate list, preventing rollback dispatch.
- Successful deploy workflow events update only one oldest matching `prod_deploying` row by CAS.
- Unsuccessful deploy workflow events update only one oldest matching `prod_deploying` row to `dispatch_failed`.
- A stopped worker's durable `approved` work item is recovered before a new approval is consumed; only one poller can CAS it to `prod_deploying`.
- Successful canonical CI events route to AGT_DEP while failed CI remains AGT_BLD and unrelated successful workflows remain ignored.
- Rollback claims `monitoring -> rolling_back` before execution and ends `rolled_back`, excluding it from subsequent 60-second monitoring polls.

## Review evidence

- `make require-crit-review`: unavailable (`No rule to make target`).
- Review-profile investigation finding: production success had no state writer into `monitoring`; fixed with tests.
- GitHub review findings: four actionable threads; fixes are covered by the final targeted/full/real-PostgreSQL evidence above and will be resolved only after the pushed diff is verified.
- Ponytail impact: reused existing AGT_DEP decision/orchestration functions, scheduler, audit, PostgreSQL, Node zlib, and GitHub client patterns; no dependency was added.

## GitHub evidence

- PR: https://github.com/mryfmo/ai-ops-platform/pull/149
- Implementation commit: `b94b266`.
- Final check/thread evidence is verified on the evidence-update head before AGMSG-RESULT.
