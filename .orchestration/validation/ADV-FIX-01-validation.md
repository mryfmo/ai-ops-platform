# ADV-FIX-01 Validation

## RED evidence

- Shared focused run: exit 1; 6 new sanitizer pattern cases failed, 19 existing tests passed.
- DevOps focused run: exit 1; missing `agent_handoffs` grant and raw Sev1 card rationale failed, 15 existing tests passed. The initial static scanner also exposed `DO UPDATE SET` / `FOR UPDATE SKIP` false positives and was narrowed before GREEN.
- Server focused run: exit 1; Graph and GitHub returned 500 from E-AUD02, event polling threw E-AUD02, and proxy retained `content-encoding`; 41 existing tests passed.

## GREEN focused runs

```text
$ env CI=true pnpm --filter @aiops/shared exec vitest run tests/secretSanitizer.test.ts
Test Files  1 passed (1)
Tests       25 passed (25)
exit code: 0

$ env CI=true pnpm --filter @aiops/devops exec vitest run tests/databaseRoleProvisioning.test.ts tests/agtHumanReviewCards.test.ts
Test Files  2 passed (2)
Tests       17 passed (17)
exit code: 0

$ env CI=true pnpm --filter @aiops/server exec vitest run tests/app.test.ts tests/eventsPollingTask.test.ts
Test Files  2 passed (2)
Tests       45 passed (45)
exit code: 0
```

## Required package runs

```text
$ env CI=true pnpm --filter @aiops/shared run test
Test Files  29 passed (29)
Tests       510 passed (510)
exit code: 0

$ env CI=true pnpm --filter @aiops/devops run test
Test Files  22 passed (22)
Tests       212 passed | 6 skipped (218)
exit code: 0

$ env CI=true pnpm --filter @aiops/server run test
Test Files  87 passed | 4 skipped (91)
Tests       954 passed | 27 skipped (981)
exit code: 0
```

## Quality gates

```text
$ env CI=true mise run lint
First run: exit 1, two no-useless-escape findings in the new URL credentials regex.
After correction: all 10 package lint jobs completed; exit code 0.

$ env CI=true mise run typecheck
All 10 package typecheck jobs completed; exit code 0.

$ env CI=true mise run traceability
First run: exit 1, ambiguous bare SPEC-INT-070 in the new event test title.
After namespace correction: all traceability guards clear; exit code 0.

$ env CI=true mise run format
All matched files use Prettier code style; exit code 0.
```

## Full Definition of Done

`env CI=true mise run ci` ran against three fresh disposable PostgreSQL 16 databases and exited 0.

- shared coverage: 29 files / 510 tests; 87.96% statements, 81% branches, 89.46% functions, 90.26% lines
- devops coverage: 22 files / 218 tests; 87.23% statements, 80.38% branches, 87.2% functions, 87.17% lines
- server coverage: 91 files / 981 tests; 84.07% statements, 77.65% branches, 81.1% functions, 86.15% lines
- migrations: 22 applied on first pass, 22 skipped on idempotent rerun
- P001 PostgreSQL integration: passed

## Security and review

```text
$ /private/tmp/gitleaks git --staged --no-banner --redact --verbose .
0 commits scanned; scanned ~9161 bytes; no leaks found
exit code: 0

$ git diff --cached --check
exit code: 0

$ /private/tmp/gitleaks git --staged --no-banner --redact --verbose .  # evidence files
0 commits scanned; no leaks found
exit code: 0

$ make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
exit code: 2

$ AGENT_REVIEWED=1 REVIEW_EVIDENCE=.orchestration/reviews/ADV-FIX-01-review-receipt.md make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
exit code: 2
```

- Crit status had no pre-existing branch review file. Structured review evidence is `.orchestration/reviews/ADV-FIX-01-review-evidence.json`.
- `make require-crit-review` is unavailable in this repository. The local structured evidence has two resolved records and an approval receipt; no browser review was opened.
