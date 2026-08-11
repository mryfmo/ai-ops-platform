# A044 validation evidence

## Identity investigation and ruling

Inspection of Auth.js claims, `authGuard`, the WebUI/Hono proxy topology, and existing operation-specific HMACs found no trusted generic Entra subject propagation contract. The operator authorized a dedicated HMAC envelope:

```text
v1|method|path|sha256(body)|tenant|object|issuedAt
```

Both ends validate canonical method/path/UUID/timestamp fields; Hono recomputes the body digest, verifies HMAC with constant-time comparison, and rejects envelopes outside 90 seconds. Tests cover wrong method/path/body/subject/secret, malformed values, future/stale timestamps, and missing configuration.

## RED/GREEN evidence

- Identity-envelope tamper/TTL tests were written before implementation.
- Real-PG repository/route tests covered create, idempotent pending target reuse, delivery visibility, decision CAS, decided-row 409, atomic audit rollback, and unsupported role/type denial.
- AGT_CHG tests covered server-created decision links, non-HTTPS rejection, no `markDelivered` on Graph failure, and delivery completion ordering.
- Web BFF/UI tests covered session subject provenance, same-origin decisions, rejection reason, upstream sanitization, and disabled configuration.
- Final review reproduced JSON `null` as a RED `TypeError`; the object-shape guard changed it to 400 and the six focused tests passed.

## Focused validation

```text
CI=true pnpm --filter @aiops/web exec vitest run tests/approvals.test.tsx
Test Files 1 passed; Tests 6 passed

CI=true pnpm --filter @aiops/web run typecheck
exit 0

Real-PG server approvalsRepo/routes/recipients suite
Test Files 3 passed; Tests 28 passed

DevOps AGT focused suite
Tests 15 passed
```

## Final Definition of Done

```text
env CI=true \
  PGHOST=127.0.0.1 PGPORT=55433 PGUSER=mryfmo \
  AIOPS_TEST_DATABASE_NAME=aiops_test \
  AIOPS_TEST_DATABASE_HOST=127.0.0.1 \
  AIOPS_TEST_DATABASE_PORT=55433 \
  AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55433/aiops_load_test \
  AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load_test \
  TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55433/a044_approvals_test3 \
  P001_ALLOW_DISPOSABLE_DB=1 mise run ci

exit 0
```

Passed stages: database preflight, governance, dependency audit (no high/critical findings; existing 1 low/2 moderate reported), actionlint, lint, traceability, format, build, typecheck, all coverage suites, and real PostgreSQL integration/migrations. Final totals include shared 349, traceability 122, DevOps 216, PrjOps 387, web 311, and server 709 passing tests.

## Review findings

- Resolved: atomic state/audit transaction; request bounds; delivered-only visibility; pending-target deduplication; decided-row conflict; tenant-qualified actor; JSON-null 400.
- Operator disposition: project membership enforcement is A051; A044 uses the explicit PRF-L/PRF-G role gate and records `project_id` now.
- Operator disposition: A044 uses a 90-second signed request envelope plus CAS without a card nonce/jti.
- `make require-crit-review`: unavailable (`No rule to make target`); Codex review evidence is recorded in `A044-review-receipt.md`.

## GitHub validation

PR #144 at commit `884d54d6a98a1d58eda64bf9ec3700a614724779` is open with merge state `CLEAN`.

```text
build-test  pass  4m27s
gitleaks    pass  9s
CodeRabbit  pass
```

The sole automated inline finding duplicated the operator-deferred A051 project-scope issue. The exact ruling was recorded in the thread, which was then resolved; unresolved thread count is zero.
