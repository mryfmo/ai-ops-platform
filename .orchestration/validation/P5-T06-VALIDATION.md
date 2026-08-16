# P5-T06 Validation

## Type Contract

- RED: Vitest and direct TypeScript compile failed while `src/graph/systemClient.ts` was absent; TypeScript also reported unused `@ts-expect-error` directives.
- `pnpm exec tsc --noEmit --strict --skipLibCheck --module ES2022 --moduleResolution Bundler --target ES2022 packages/integrations/tests/graphSystemClient.test.ts`: PASS.
- The compile fixture proves:
  1. delegated Work IQ providers/tokens cannot satisfy Graph app-only provider/token types;
  2. a Graph app-only token/provider cannot satisfy the Work IQ delegated token/provider;
  3. `WorkIqRestClient` cannot satisfy Graph formal-write operations;
  4. the existing `GraphClient` satisfies the marked `GraphSystemClient` capability surface;
  5. a delegated bearer-shaped provider cannot construct the concrete `GraphClient`;
  6. a raw delegated bearer cannot be assigned to the opaque app-only token.

## Targeted Regression

- `pnpm --filter @aiops/integrations exec vitest run tests/graphSystemClient.test.ts`: PASS, 1/1; runtime checks only the app-only client marker because token branding is intentionally unavailable outside the production provider.
- `pnpm --filter @aiops/shared exec vitest run tests/graphClient.test.ts tests/graphClientChannelMessages.test.ts`: PASS, 122/122.
- `pnpm --filter @aiops/integrations test`: PASS, 8 files / 74 tests.
- `pnpm --filter @aiops/server exec vitest run tests/graphTokenProvider.test.ts`: PASS, 12/12, including the RED-then-green embedded-whitespace token case on the production MSAL provider.
- shared + integrations typecheck and integrations lint: PASS.

## Full Gate

- First `mise run ci`: expected formatting-only failure on the new type fixture; Prettier applied and focused runtime/type checks remained green.
- Pre-review `mise run ci` with three fresh disposable PostgreSQL databases: PASS, exit 0; governance, 25/25 Rego, contracts, audit, actionlint, lint, traceability, format, build, typecheck, all-package coverage, 18 migration applications/reapply, and `P001 PostgreSQL integration passed`.
- Independent review P1 found the initial unused factory did not constrain production construction. The factory was removed and the brand moved onto the concrete shared/provider path.
- Re-review P1 found the exported raw-string branding helper could relabel delegated tokens. The helper/export was removed; only the validated production MSAL provider may assert the private brand.
- Final post-helper-removal `mise run ci` with a third independent fresh PostgreSQL set: PASS, exit 0, ending in `P001 PostgreSQL integration passed`.
- Final post-fix `mise run ci` with a second set of three fresh PostgreSQL databases: PASS, exit 0, ending in `P001 PostgreSQL integration passed`.
- gitleaks 8.30.1 staged scan: PASS, no leaks found.
- Final independent review after both P1 fixes: PASS, no actionable correctness regression.
- `make require-crit-review`: unavailable (`No rule to make target require-crit-review`).

## Environment Constraints

- No credentials, delegated user token, app-only tenant token, or network call was used.
- Plan-quality workflow/validator/Make target/hook/reviewer/CI entry are absent; the worklog plan was manually audited.
- CompactionDB CLI command attempted: `python3 .claude/hooks/contextdb_cli.py memory add --help`; unavailable because `.claude/hooks/contextdb_cli.py` does not exist.
- Orchestrator approved the narrow scope amendment for `packages/server/src/auth/graphTokenProvider.ts` and its existing test.
