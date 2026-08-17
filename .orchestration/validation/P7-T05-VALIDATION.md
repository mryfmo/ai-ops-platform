# P7-T05 Validation

## Test-First Evidence

- RED, channel: `pnpm --filter @aiops/channel-teams test -- approvalCard.test.ts` failed 5/5 because the builder did not exist.
- RED, server: the new route/repository tests failed on missing version/expiry errors and absent decision behavior.
- GREEN, focused DB-less: approval route/repository suites passed 37 tests with 4 PostgreSQL cases skipped; approval card suite passed 5 tests.
- GREEN, focused PostgreSQL: approval route/repository suites passed 41/41 tests after correcting fixture parameter casts.
- `pnpm --filter @aiops/channel-teams test:coverage`: 2 files / 40 tests passed; 94.17% statements, 90.67% branches, 100% functions, 98.83% lines.
- DB-less server coverage: 86 files / 941 passed / 23 skipped; 83.66% statements, 77.02% branches, 79.94% functions, 85.67% lines.
- Focused lint and typecheck: PASS.

## Acceptance Matrix

- Authorized approve: CAS precedes one exact signal.
- Authorized reject: sanitized reason reaches the signal.
- Unauthorized project/profile or wrong signed correlation identity: 403, audited, no CAS/signal.
- Self approval: 403, audited, no CAS/signal.
- Stale version and expired approval: rejected and audited, no signal.
- Replay/double click: only the first pending CAS can win; the loser emits no signal.
- Repository authority ID/version/status mismatch: fail closed, no signal.
- Missing signal port: 503 before CAS.
- Signal failure: 503 after the authoritative CAS and an `approval_signal_failed` audit event.
- PostgreSQL concurrency: exactly one competing decision wins.
- PostgreSQL audit failure: the decision transaction rolls back.

## Full Gate

- Final fresh-database command: `PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres TEST_DATABASE_URL=...p7t05_r3_test LOAD_TEST_DATABASE_URL=...p7t05_r3_load_test P001_TEST_DATABASE_URL=...p7t05_r3_p001_test mise run ci`.
- Result: PASS, exit 0.
- Final marker: `P001 PostgreSQL integration passed`.
- The gate covered governance, Rego, contracts, actionlint, lint, traceability, Prettier, build, typecheck, package coverage, migration apply/reapply, DB integration, and P001 checks.
- Earlier full-gate attempts exposed and corrected: sandbox denial of the contracts `tsx` socket, formatting in three changed files, an implicit local PostgreSQL role, and a test-only bigint/text CASE inference error. The final run used an escalated contracts execution, explicit `PGUSER=postgres`, fresh databases, and explicit fixture casts.

## Review and Plan Quality

- The repository plan-quality validator/template/hook assets referenced by the skill are absent. The ignored working plan was manually checked for required headings, scope boundaries, security ordering, adversarial tests, and stop conditions.
- `make require-crit-review` is unavailable (`No rule to make target`). `crit status --json` found no review file/session. Repository policy forbids opening browser Crit, so the complete candidate diff was reviewed locally against the task contract; no additional finding remained.
- Scoped Prettier check and `git diff --check`: PASS.

## Deferred / Environment

- Real Teams tenant card-submit and Temporal worker E2E are deferred.
- No real credential, tenant, external message, workflow signal, or production endpoint was used.
