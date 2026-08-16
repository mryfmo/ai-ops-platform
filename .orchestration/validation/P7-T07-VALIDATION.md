# P7-T07 Validation

## Test-First Evidence

- RED server: focused tests failed because `workbenchRepo.js` did not exist.
- RED web: focused tests failed because `workbenchClient.js` did not exist.
- GREEN server: `pnpm --filter @aiops/server exec vitest run tests/workbench.test.ts tests/workbenchPg.test.ts` passed with a real PostgreSQL 16 instance, 2 files / 8 tests.
- GREEN web: `pnpm --filter @aiops/web exec vitest run tests/workbench.test.ts` passed, 1 file / 3 tests.
- Server/web lint and typecheck passed.

## Acceptance Checks

- Real PostgreSQL checks assert the exact allowlist of columns on all four Workbench tables.
- Applying the new migration twice succeeds.
- Same-project workflow/action links succeed; cross-project links fail.
- Updating the existing workflow/approval authority/read-model rows changes the next Workbench read without updating a Workbench table.
- Non-HTTPS source references and secret-shaped source metadata fail before usable persistence.
- API tests verify request-time active-recipient resolution, identity-envelope authentication, data-acquisition scope, and indistinguishable 404 for absent/out-of-scope workspaces.
- Web tests verify signed identity forwarding, strict extra-field rejection, and fixed non-reflective error bodies.

## Full Gate

- `mise run ci` with three disposable PostgreSQL databases: PASS, exit 0. This includes governance, 25/25 Rego, contracts, audit, actionlint, lint, traceability, format, build, typecheck, all-package coverage, migration apply/reapply, and `P001 PostgreSQL integration passed`.
- `pnpm install --frozen-lockfile`: PASS; lockfile was current and unchanged.
- `git diff --check`: PASS.
- gitleaks 8.30.1 staged scan: PASS, no leaks found.
- No dependency or lockfile change.
- PR #244 and PR #245 file lists were obtained with `gh`; the P7-T07 staged scope has no intersection with either PR.
- `make require-crit-review`: unavailable (`No rule to make target require-crit-review`). The complete diff was manually reviewed for authority duplication, trust-boundary validation, data-acquisition scoping, migration safety, and forbidden-file overlap; no actionable finding remained.

## Plan Quality

- Repository plan-quality workflow, template, validator, Make target, hook, reviewer, and CI entry points are absent.
- The ignored worklog plan was manually audited against the required Goal/Scope/Assumptions/Design/Tests/Open Questions structure and explicit STOP conditions.

## Environment Constraints

- No credentials or external service calls were used.
- Tests used injected synthetic identities and local disposable PostgreSQL databases only.
- CompactionDB CLI is absent; the attempted command and failure are recorded in the report.
