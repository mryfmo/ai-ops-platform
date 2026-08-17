# P7-T08 Validation

## Test-First Evidence

- RED server: 8 failures proved the target formatter, JIT namespace separation, SQL grant projection, route OPA call, versioned response, and deny/revoke behavior were absent.
- RED policy: 2 failures proved the bundle had no Workbench capability decision.
- GREEN focused server: `pnpm --filter @aiops/server exec vitest run tests/grantsRepo.test.ts tests/workbench.test.ts` — 2 files / 14 tests.
- GREEN Web BFF: `pnpm --filter @aiops/web exec vitest run tests/workbench.test.ts` — 1 file / 4 tests.
- GREEN Rego: `mise run policy:rego` — 29/29.

## Security and Database Checks

- `env -u TEST_DATABASE_URL pnpm --filter @aiops/server run test:coverage` — 86 files / 926 tests, thresholds green.
- `pnpm --filter @aiops/web run test:coverage` — 41 files / 333 tests, thresholds green.
- Policy package tests — 2 files / 13 tests.
- Server/policy/web typecheck and lint — PASS.
- Disposable PostgreSQL 16 focused suite — 4/4 PASS. The suite uses a UUID-named schema and drops only that schema.
- Real-DB assertions cover: no grant = null; project grant = full references; revoke = next read null; repository grant = matching source only; space grant = full workspace references; cross-project grant + wrong recipient scope = null.
- SQL uses active-window, internal subject, pull level, exact subject, exact namespaced target, recipient scope, and source-system predicates before projection.

## Full Gate

- After the final non-reflective denial fix, a separate fresh PostgreSQL set (`p7t08_ci5_test`, `p7t08_ci5_load`, `p7t08_ci5_p001`) ran `mise run ci`: PASS, exit 0.
- Gate included governance, 29/29 Rego, contracts, audit, actionlint, lint, traceability, Prettier, build, typecheck, all-package coverage, migration apply/reapply, and DB integration.
- Final marker: `P001 PostgreSQL integration passed`.
- `git diff --check`: PASS.
- No schema, migration, dependency, lockfile, PR #255 file, or PR #256 file was changed.

## Plan Quality and Review Surface

- Repository plan-quality workflow/template/validator/hook targets are absent. The ignored worklog plan was manually checked for the required Goal/Scope/Assumptions/Design/Tests/Open Questions sections, explicit acceptance negatives, allowed paths, and STOP conditions.
- `make require-crit-review` is invoked after staging. Browser Crit is not used; exact-commit Codex review is the review surface.

## Exact-Commit Review Revision

- Review of initial commit `d4169ff` found one High issue: `index.ts` omitted OPA dependency/environment composition, so every production Workbench request returned fail-closed 404 even with a valid grant.
- Scope amendment approved `packages/server/src/index.ts`, `config.ts`, and composition/config tests.
- A second scope amendment approved the matching `.env.example` placeholders and `docs/reference/configuration.md` inventory entries required by the traceability gate.
- Regression RED: 5 failures across config and route composition proved missing required config validation, unsafe URL rejection, and missing OPA factory.
- GREEN: config + Workbench tests 2 files / 81 tests; server typecheck/lint PASS. The composition test constructs the real `OpaDecisionClient`, reaches the fixed OPA decision path, and returns 200 for a valid grant/allow decision.
- Final full CI confirms both new OPA keys are represented in the configuration inventory and the production composition remains buildable and covered.
- Re-review of amended commit `04ad6d1` found one High issue: inactive-recipient and invalid-recipient-scope denials returned reflective 403 while all other acquisition/policy denials returned 404.
- Regression RED: 2 route failures proved both authorization-denial paths were distinguishable. GREEN: the shared authorization-denial response now returns the same `{ "error": "workspace not found" }` 404; config + Workbench tests remain 81/81.

## Environment

- No real identity, grant, OPA endpoint, external service, or production network was used.
- All identities/decisions were synthetic and all database validation used local disposable PostgreSQL.
