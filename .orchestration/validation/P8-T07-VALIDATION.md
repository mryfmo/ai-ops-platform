# P8-T07 Validation

## TDD and focused checks

- RED: control-plane state, repository, and workflow tests initially failed because the target modules did not exist.
- GREEN: state-machine tests cover the normal path, rework/resubmission, stale approval rejection, takeover, malformed SHA/version/actor/state, incomplete takeover fields, and implicit role changes.
- GREEN: repository tests cover first claim, conflicting and exact-repeat claims, snapshot/version CAS, exact-evidence retry recovery, divergent retry rejection, transaction audit, and mutation rejection.
- GREEN: Temporal tests cover signal ordering, invalid-command rejection, activity-only persistence, exact receipt enforcement, and fail-closed CAS mismatch.

## Final commands

- `env CI=true pnpm --filter @aiops/server exec vitest run tests/agentHandoffsRepo.test.ts`: 8 passed, 3 skipped without `TEST_DATABASE_URL`.
- Isolated PostgreSQL 16 focused run: 10 passed before the exact-evidence hardening; the final full CI reran the PostgreSQL suite after hardening.
- `env CI=true pnpm --filter @aiops/server run lint`: green.
- `env CI=true pnpm --filter @aiops/server run typecheck`: green.
- `env CI=true mise run ci` with three fresh PostgreSQL databases: exit 0.
  - governance/contracts/audit/actionlint/lint/traceability/format/build/typecheck: green
  - control-plane coverage: 37 files, 354 tests; statements 84.31%, branches 87.61%, functions 90.25%, lines 86.36%
  - server coverage with real-PG suites: 91 files, 977 tests; statements 84.04%, branches 77.55%, functions 81.07%, lines 86.11%
  - migrations: 22 applied on first pass, 22 skipped on idempotent rerun
  - P001 PostgreSQL integration: passed

## Review and hygiene

- `crit status --json`: no existing review data for this branch.
- Local structured review evidence: `.orchestration/reviews/P8-T07-review-evidence.json`.
- `make require-crit-review`: target absent; receipt retained at `.orchestration/reviews/P8-T07-review-receipt.md`.
- Staged gitleaks and `git diff --cached --check` are recorded after exact-path staging.

## Expected environmental observations

- A first non-CI `pnpm` retry attempted its dependency-status path and aborted because no TTY/network was available; all validation commands were rerun with `CI=true` and passed.
- The Temporal ephemeral server requires host shared-memory access. The final full CI run used the approved host execution path and passed.
- V8 does not credit all workflow-sandbox body execution to host coverage. Exported request/receipt trust-boundary checks were added instead of lowering thresholds or excluding the workflow.
