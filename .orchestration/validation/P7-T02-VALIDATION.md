# P7-T02 Validation

## Test-First Evidence

- RED channel test: a mapping owned by another subject produced an AG-UI run request instead of the fixed mapping-mismatch result.
- RED server tests: the mapping repository module did not exist and `channel_messages` did not write a source identity.
- GREEN focused unit: channel-teams 10/10; server mapping/message tests 7/7.
- GREEN real PostgreSQL: 3/3 security/concurrency tests with the migration applied twice.

## Acceptance Checks

- Correct address+identity resolves the authoritative mapping.
- Wrong user, wrong thread, cross-tenant, and nonexistent address all return the same `null` result.
- Missing tenant identity returns `null` before a database query.
- Two concurrent exact registrations produce one `created` and one `replayed`; `xmin` and `created_at` prove replay does not update the authority row.
- A conflicting registration returns a fixed error and does not expose the existing workflow.
- Two concurrent source-message writes converge to one row; reusing that source/message ID from another channel is rejected.
- The repository exposes no workflow-ID-only lookup.

## Coverage and Full Gate

- `env -u TEST_DATABASE_URL CI=true pnpm --filter @aiops/server test:coverage`: PASS; 85 files passed, 4 PG files skipped, 918 tests passed and 22 skipped; coverage thresholds green.
- Fresh PostgreSQL `mise run ci`: PASS, exit 0. All 251 package test files / 2,861 tests passed, including server 940/940 and channel-teams 10/10; migrations applied 21 then skipped 21 on replay; final output `P001 PostgreSQL integration passed`.
- The first full gate reached all package coverage green but the harness rejected the disposable database name because it lacked the literal `test`; the final run used a fresh `aiops_p7t02_test` database and passed.
- `git diff --check`, repository Prettier, lint, build, typecheck, traceability, governance, contracts, Rego 25/25, actionlint, and DB verification: PASS.
- No dependency or lockfile change.

## Review Gate

- `make require-crit-review`: unavailable (`No rule to make target require-crit-review`).
- `crit status --json`: review file absent; browser Crit was not opened per repository policy.
- Codex reviewed the complete scoped diff and recorded resolved findings in `.orchestration/reviews/P7-T02-review-evidence.json`.

## Plan Quality

- Repository plan-quality workflow/template/validator entry points are absent.
- The ignored plan was manually audited for Goal, Scope, Assumptions, Design, Tests, Open Questions, executable security gates, and schema STOP/amendment handling.
