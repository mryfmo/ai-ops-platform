# A038 Validation

## Test-first evidence

Initial command:

```text
./node_modules/.bin/vitest run packages/server/tests/eventsRepoDeadLetter.test.ts
```

RED result: six tests failed. Five reported `TypeError: repo.requeueDead is not a function`; the metric assertion also showed that the SQL omitted `dead`.

## Focused checks

```text
./node_modules/.bin/vitest run packages/server/tests/eventsRepoDeadLetter.test.ts packages/server/tests/eventsRepo.test.ts packages/server/tests/metrics.test.ts packages/server/tests/eventsPollingTask.test.ts
```

Result: 4 files, 40 tests passed. Server TypeScript, ESLint, Prettier, and YAML parsing also passed. The YAML assertion verified alert name, `aiops_events_queue_depth{status="dead"} > 0`, and `for: 5m`.

## Revision test-first evidence

The revision tests were added before implementation. The focused run failed because invalid actors were accepted, a secret-bearing reason reached the audit writer and raised `E-AUD02`, and the requeue CLI did not exist.

After implementation:

```text
./node_modules/.bin/vitest run packages/server/tests/eventsRepoDeadLetter.test.ts packages/server/tests/auditActor.test.ts packages/server/tests/requeueDeadEventTool.test.ts
```

Result: 3 files, 18 tests passed. Server typecheck and lint also passed.

## Definition of Done

```text
env CI=true PGHOST=127.0.0.1 PGPORT=55439 AIOPS_TEST_DATABASE_NAME=aiops_test AIOPS_TEST_DATABASE_HOST=127.0.0.1 AIOPS_TEST_DATABASE_PORT=55439 AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55439/aiops_load_test AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load_test TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55439/aiops_p001 P001_ALLOW_DISPOSABLE_DB=1 mise run ci
```

Original result: exit 0 against disposable PostgreSQL 16. Server coverage ran 57 files / 635 tests; P001 PostgreSQL integration passed.

The same command was rerun after the revision against a fresh disposable PostgreSQL 16 cluster. Result: exit 0; server coverage ran 59 files / 647 tests and P001 PostgreSQL integration passed.

## Secret-scanner validation

- Official Gitleaks v8.30.1 full-history scan: 243 commits scanned, `no leaks found`.
- Negative control: an unrelated generic API credential added temporarily to the same test path was detected by `generic-api-key`, proving the allowlist is not path-wide.
- The allowlist condition is the conjunction of `targetRules`, the exact test path, and the exact historical fixture line.

## Publication checks

- Final local review: no findings.
- Final head: `f403fb0ca480619330eb6f1c277bac31665af244`.
- PR #142: final head `f403fb0ca480619330eb6f1c277bac31665af244`, merge state `CLEAN`, correct base/head, `ai-generated` label.
- GitHub Actions run `31173132673`: `build-test` pass (4m28s), `gitleaks` pass (7s), `CodeRabbit` pass.
