# A040 validation

## Pino wildcard experiment

Executed Pino directly with four payload depths before changing the implementation:

```text
authorization: depth0=redacted depth1=visible depth2=visible depth3=visible
*.authorization: depth0=visible depth1=redacted depth2=visible depth3=visible
*.*.authorization: depth0=visible depth1=visible depth2=redacted depth3=visible
*.*.*.authorization: depth0=visible depth1=visible depth2=visible depth3=redacted
```

Conclusion: each `*` consumes one object level, and consecutive wildcards work through at least the required depth 3. The implementation generates the four exact path shapes instead of installing a recursive formatter.

The first attempted experiment through `pnpm exec` stopped before execution because the non-TTY wrapper requested a module-store rebuild. No dependency file changed. The successful experiment invoked the repository's Node 22 runtime from `packages/server` and exercised Pino itself.

## Logger call-site evidence

```text
rg -n '(?:logger|[A-Za-z]+\.logger)\.(trace|debug|info|warn|error|fatal)\(' packages/*/src --glob '*.ts' --glob '!**/dist/**'
```

Excluding two matches in `logger.ts` comments, this found seven production call sites. Every structured payload is flat; the other calls pass only a message string.

## Test-first evidence

Before implementation:

```text
./node_modules/.bin/vitest run packages/server/tests/logger.test.ts
Test Files 1 failed (1)
Tests 4 failed (4)
```

All four depth-2/depth-3 cases exposed `A040_SENTINEL`, demonstrating the intended failure.

After implementation:

```text
./node_modules/.bin/vitest run packages/server/tests/logger.test.ts packages/server/tests/loggerRedaction.test.ts
Test Files 2 passed (2)
Tests 50 passed (50)
```

## Full Definition of Done

A disposable PostgreSQL 16 cluster with `aiops_test`, `aiops_load_test`, and `aiops_p001` databases was used.

The first `mise run ci` attempt correctly stopped at `db:require` because the database variables were absent. Two immediate retries stopped because the fixed PATH omitted `mise`; no test ran in those attempts. With repository-pinned Node 22.23.1, pnpm 11.13.0, `mise`, and the disposable database variables present:

```text
env CI=true PATH=<mise-tools-first> \
  PGHOST=127.0.0.1 PGPORT=55437 \
  AIOPS_TEST_DATABASE_NAME=aiops_test \
  AIOPS_TEST_DATABASE_HOST=127.0.0.1 \
  AIOPS_TEST_DATABASE_PORT=55437 \
  AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55437/aiops_load_test \
  AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load_test \
  TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55437/aiops_p001 \
  P001_ALLOW_DISPOSABLE_DB=1 \
  mise run ci

PASS: governance, audit, actionlint, lint, traceability, format, build,
typecheck, coverage tests, and PostgreSQL integration.
Server: 53 files passed, 606 tests passed.
P001 PostgreSQL integration passed.
```

The disposable PostgreSQL server was stopped after validation.

## Review evidence

```text
make require-crit-review
make: No rule to make target `require-crit-review'.

codex review --uncommitted
No findings. Server tests, typecheck, lint, formatting, and diff checks passed.
```

The review also ran all 606 server tests. `git diff --check` passed.

## GitHub validation

```text
PR head: 17bb8e1709cbdcc04f9b3a053e79be1a4cb1178c
build-test  pass  4m15s
gitleaks    pass  8s
CodeRabbit  pass
```

PR: https://github.com/mryfmo/ai-ops-platform/pull/138

The PR description was read back after update and reflects the full PR. No review-thread mutation was performed.

## Final repository state

```text
git switch main
git status --short --branch
## main...origin/main
```
