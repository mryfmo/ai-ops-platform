# A036 validation

## Test-first evidence

```text
env CI=true pnpm --filter @aiops/server run test -- graphNotificationsBodyLimit.test.ts
FAIL: expected 413, received 202
Test Files 1 failed | 49 passed
Tests 1 failed | 529 passed
```

The first invocation without `CI=true` stopped before tests because pnpm required non-TTY module-store confirmation; no dependency files changed.

## Targeted validation

```text
env CI=true pnpm --filter @aiops/server exec vitest run tests/graphNotificationsBodyLimit.test.ts
Test Files 1 passed (1)
Tests 2 passed (2)

env CI=true pnpm --filter @aiops/server run typecheck
PASS

env CI=true pnpm --filter @aiops/server run lint
PASS
```

The over-limit test omits `Content-Length`, validating Hono's streaming body-size path rather than only its header fast path.

## Full Definition of Done

A disposable PostgreSQL 16 cluster was initialized under `/private/tmp`, with `aiops_test`, `aiops_load_test`, and `aiops_p001` databases. The first `mise run ci` attempt exposed an unrelated local Homebrew Node 26 loader failure (`libada.3.dylib` missing). Pinning PATH to the repository's `.mise.toml` Node 22.23.1 and pnpm 11.13.0 resolved the toolchain mismatch.

```text
env CI=true PATH=<mise-node-22-and-pnpm-11-first> \
  PGHOST=127.0.0.1 PGPORT=55436 \
  AIOPS_TEST_DATABASE_NAME=aiops_test \
  AIOPS_TEST_DATABASE_HOST=127.0.0.1 \
  AIOPS_TEST_DATABASE_PORT=55436 \
  AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55436/aiops_load_test \
  AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load_test \
  TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55436/aiops_p001 \
  P001_ALLOW_DISPOSABLE_DB=1 \
  mise run ci

PASS: governance, audit threshold, actionlint, lint, traceability, format,
build, typecheck, test coverage, and PostgreSQL integration.
Server: 50 files passed, 530 tests passed.
P001 PostgreSQL integration passed.
```

The disposable PostgreSQL server was stopped after validation.

## Review evidence

```text
make require-crit-review
make: No rule to make target `require-crit-review'.

crit status --json
review_file_exists: false

codex review --uncommitted
No findings: "The Graph webhook now enforces the intended 1 MiB body limit without changing valid notification behavior."
```

`git diff --check` passed.

## GitHub validation

```text
gh pr checks 140 --watch --interval 10
CodeRabbit  pass
build-test  pass  4m12s
gitleaks    pass  9s
```

PR: https://github.com/mryfmo/ai-ops-platform/pull/140
