# P5-T01 Validation

## Test-first Evidence

1. Added synthetic token-claim tests before implementation.
2. Ran `pnpm --filter @aiops/integrations test -- workIqTokenClaims.test.ts`.
3. RED: `Cannot find module '../src/workiq/tokenClaims.js'`; existing 37 tests remained green.
4. Added the minimum pure validator and re-ran the package tests green.

## Commands and Results

1. `pnpm --filter @aiops/integrations test:coverage`
   - PASS: 5 files / 48 tests.
   - Workspace package coverage: statements 85.54%, branches 79.59%, functions 96.22%, lines 92.46%.
   - `src/workiq/tokenClaims.ts`: 100% statements (21/21), branches (25/25), functions (2/2), and lines (18/18).
2. `pnpm --filter @aiops/integrations typecheck`
   - PASS.
3. `pnpm --filter @aiops/integrations lint`
   - PASS.
4. `pnpm exec prettier --write` on the task files, followed by the repository format gate in CI.
   - PASS.
5. Fresh PostgreSQL 16 databases `aiops_p5t01_test`, `aiops_p5t01_load`, and `aiops_p5t01_p001`, then `mise run ci` with all required disposable-DB variables.
   - PASS: exit 0.
   - Governance, Rego, contracts, audit, actionlint, lint, traceability, format, build, typecheck, workspace coverage, and DB integration all completed.
   - Final DB marker: `P001 PostgreSQL integration passed`.
   - The three task databases were dropped after validation.
6. `make require-crit-review`
   - Repository has no `require-crit-review` target; direct staged-diff review and `git diff --cached --check` were used instead.
   - Direct review found no unresolved correctness, delegated/app-only boundary, scope, or credential-leakage finding.
7. `/tmp/sec-reg-p4-gitleaks/gitleaks git --staged --no-banner --redact --verbose .`
   - PASS: scanned approximately 26.6 KB; no leaks found.

## Boundary Assertions

- The fixture tenant IDs are the nil UUID and all-`f` synthetic UUID; no real tenant data appears.
- The app-only fixtures omit `scp` and include `roles` only; all are rejected with `E-WIQ02`.
- Audience, tenant, issuer, subject, and excess-scope fixtures fail with fixed errors that do not echo claim values.
- No network, JWT decoding, Graph call, Work IQ call, or token acquisition exists in the validator.
