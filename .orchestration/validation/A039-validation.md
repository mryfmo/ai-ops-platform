# A039 validation

## Test-first evidence

```text
deriveCapabilityState tests:
FAIL TypeError: deriveCapabilityState is not a function

exception-path readiness test:
expected { ready: false, degraded: [...] }
received { ready: false }

successful readiness refresh test:
expected degraded: []
received degraded: ["graph_subscriptions"]
```

All failures were observed before the corresponding implementation changes.

## Targeted validation

```text
env CI=true pnpm --filter @aiops/server exec vitest run \
  tests/degradedCapabilities.test.ts tests/health.test.ts tests/app.test.ts

Test Files 3 passed (3)
Tests 48 passed (48)

env CI=true pnpm --filter @aiops/server run typecheck
PASS

env CI=true pnpm --filter @aiops/server run lint
PASS

pnpm exec prettier --check <changed server files>
PASS
```

## Full Definition of Done

A disposable PostgreSQL 16 cluster was initialized under `/private/tmp`, bound to loopback port 55439, and populated with `aiops_test`, `aiops_load_test`, and `aiops_p001` databases. The repository-pinned Node 22.23.1 and pnpm 11.13.0 were placed first on PATH.

```text
mise run ci
PASS: governance, audit threshold, actionlint, lint, traceability, format,
build, typecheck, test coverage, and PostgreSQL integration.
Server: 51 files passed, 549 tests passed.
P001 PostgreSQL integration passed.
```

The disposable PostgreSQL server was stopped after validation.

## Review evidence

```yaml
review_surface: codex-review
reviewer: codex
review_source: codex review --uncommitted
review_outcome: approved-after-fixes
```

Resolved records:

1. Restored `refreshSubscriptionPresence()` to readiness after review found that removing it could hide subscription-table permission/schema failures.
2. Recomputed degraded state after a successful `isReady()` refresh and added a regression test.
3. Replaced new tests' unrelated audit-log requirement reference with `DevOps:REQ-029` / `DevOps:SPEC-INT-040`.
4. Final review found no actionable defect; all 51 server test files, direct typecheck, lint, formatting, and diff checks passed.

```text
make require-crit-review
make: No rule to make target `require-crit-review'.

crit status --json
review_file_exists: false

final codex review --uncommitted
No actionable defect was found.
```

`git diff --check` passed.

## GitHub validation

```text
gh pr checks 139 --watch --interval 10
CodeRabbit  pass (review rate limited)
build-test  pass  4m6s
gitleaks    pass  8s
```

PR: https://github.com/mryfmo/ai-ops-platform/pull/139
Commit: `3587ae03d432918cc608ed357a6c03eb265a9866`
