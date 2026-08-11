# A037 validation

## Test-first evidence

Before implementation:

```text
./node_modules/.bin/vitest run packages/server/tests/calendarCoverage.test.ts
Test Files 1 failed (1)
Error: Cannot find module '../src/lib/calendarCoverage.js'
```

After implementation:

```text
./node_modules/.bin/vitest run packages/server/tests/calendarCoverage.test.ts
Test Files 1 passed (1)
Tests 6 passed (6)
```

The tests cover the warning threshold exactly, one day below, one day above, an expired calendar, an empty calendar, and Prometheus gauge output including the empty-data sentinel.

## Full Definition of Done

A disposable PostgreSQL 16 cluster on port 55438 with `aiops_test`, `aiops_load_test`, and `aiops_p001` databases was used.

```text
env CI=true PATH=<mise-tools-first> \
  PGHOST=127.0.0.1 PGPORT=55438 \
  AIOPS_TEST_DATABASE_NAME=aiops_test \
  AIOPS_TEST_DATABASE_HOST=127.0.0.1 \
  AIOPS_TEST_DATABASE_PORT=55438 \
  AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55438/aiops_load_test \
  AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load_test \
  TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55438/aiops_p001 \
  P001_ALLOW_DISPOSABLE_DB=1 \
  mise run ci

PASS: governance, audit, actionlint, lint, traceability, format, build,
typecheck, coverage tests, and PostgreSQL integration.
Server: 57 files passed, 635 tests passed.
P001 PostgreSQL integration passed.
```

The disposable PostgreSQL server was stopped after validation.

## Review evidence

```text
make require-crit-review
make: *** No rule to make target 'require-crit-review'. Stop.

codex review --uncommitted
No findings. Calendar calculation, startup wiring, gauge, and boundary tests satisfy the task.
```

`git diff --check`, focused typecheck, lint, and tests passed. The review independently ran all 635 server tests.

## GitHub validation

```text
PR: https://github.com/mryfmo/ai-ops-platform/pull/141
base: main
head: agent/a037-calendar-coverage
label: ai-generated
mergeable: MERGEABLE
build-test  pass  4m17s
gitleaks    pass  7s
CodeRabbit  pass
```

GitHub was inspected with plain `gh` first. Web fallback was not used. Network-only GitHub commands required escalated execution because the Codex sandbox denied API egress.

## Revision validation

```text
# RED
./node_modules/.bin/vitest run packages/server/tests/calendarCoverage.test.ts
Test Files 1 failed (1); Tests 9 failed | 1 passed (10)

# GREEN
./node_modules/.bin/vitest run packages/server/tests/calendarCoverage.test.ts
Test Files 1 passed (1); Tests 11 passed (11)
```

RED reproduced `foo` yielding `NaN` without warning, `2027-99-99` normalizing 3,444 days ahead, mixed malformed maximum selection, and missing metric refresh. Direct TypeScript, ESLint, Prettier, and diff checks passed.

Full `mise run ci` passed against disposable PostgreSQL 16 on port 55439, including P001 integration. `codex review --uncommitted` found no actionable defects and independently passed 57 server files / 640 tests.

```text
revision head: 2552b714bd1e669f31469ddfa97682900bd239db
build-test  pass  4m21s
gitleaks    pass  7s
CodeRabbit  pass (review rate limited)
```
