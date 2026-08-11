# A043 validation evidence

## RED evidence

Before product implementation:

- Shared test failed because `reporting/internalTerms.ts` did not exist.
- Server gate test failed because `reportVerificationGate.ts` did not exist.
- Delivery tests proved metrics were absent and V-A, V-B, V-C, and V-D failures still reached the sender.

## Focused GREEN evidence

```text
env CI=true pnpm --filter @aiops/shared test -- internalTerms.test.ts
Test Files 19 passed (19)
Tests 345 passed (345)

env CI=true pnpm --filter @aiops/server test -- reportVerificationGate.test.ts reportDeliveryTask.test.ts
Test Files 61 passed (61)
Tests 673 passed (673)
```

Covered paths include deterministic measured/unavailable/empty metric rendering, V-A through V-D mapping, each failure blocking send with audit/warn/metric evidence, encoded forbidden terms, successful delivery, recipient isolation, and missing personal-name provider isolation.

## Definition of Done

The final post-review run used an isolated local PostgreSQL 16 cluster and passed:

```text
env CI=true \
  PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres \
  AIOPS_TEST_DATABASE_NAME=aiops_test \
  AIOPS_LOAD_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/aiops_load_test \
  AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load_test \
  TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/aiops_p001 \
  P001_ALLOW_DISPOSABLE_DB=1 \
  mise run ci

governance: pass
audit: pass (no high/critical vulnerability; existing 1 low, 2 moderate reported)
actionlint/lint/traceability/format/build/typecheck: pass
test:coverage: 2,046 tests passed across all packages
verify:db: P001 PostgreSQL integration passed
```

Traceability regenerated successfully with no missing root headers, invalid namespaces, or catalog/config inventory errors.

## Review and remote evidence

```text
make require-crit-review
make: No rule to make target `require-crit-review'.

codex review --uncommitted
Three findings: two fixed and tested; one metric-scope suggestion rejected because it conflicts with the explicit A043 renderer ruling.

PR #143 checks
build-test  pass  4m27s
gitleaks    pass  7s
CodeRabbit  pass
```

PR #143 is open and mergeable at commit `27546729355afbfb133e1b24a36f2dbda27bc432`; no merge was performed.
