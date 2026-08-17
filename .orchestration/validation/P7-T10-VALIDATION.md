# P7-T10 Validation

## Test-First Evidence

- RED: `pnpm --filter @aiops/web exec vitest run tests/gadgetViewSpec.test.tsx` failed before implementation because `src/components/workbench/GadgetView.js` did not exist; no new test executed.
- GREEN: web test run — 43 files passed, 353 tests passed under the final CI environment.
- `pnpm --filter @aiops/web typecheck` — PASS, including four `@ts-expect-error` negative type contracts.
- `pnpm --filter @aiops/web lint` — PASS.
- `pnpm --filter @aiops/web test:coverage` — PASS: statements 82.56%, branches 72.07%, functions 83.13%, lines 85.17%.
- `GadgetView.tsx` coverage: statements 100%, branches 86.48%, functions 100%, lines 100%.

## Acceptance Matrix

- Exact approved catalog: workflow timeline, source panel, pending actions, decision summary.
- Deterministic static-markup snapshot and duplicate-render equality cover all four components, Japanese text, mobile table overflow, provenance link, pending state, and decision metadata.
- Parser rejects unknown component, code, HTML/script, handler, expression, external URL/fetch field, URL-shaped resource reference, script-like workflow reference, and nested extra key.
- Typecheck rejects arbitrary code, URL, handler, and unapproved component fields on `GadgetViewSpec` object literals.
- Render rejects wrong workspace, wrong grant resource, and workflow/source references absent from the grant-shaped projection with fixed `E-GADGET-SCOPE`.
- A fetch spy proves all four renders perform zero network calls.
- React escaping fixture proves reference text cannot become raw script markup.
- Inventory gate scans package/root configuration and all `src` files and confirms Cloudflare/wrangler dependency, import, filename, and configuration surfaces are absent.

## Full Gate

- Final stable run used new disposable databases `p7t10_r3_test`, `p7t10_r3_load`, and `p7t10_r3_p001`.
- `mise run ci` — PASS, exit 0, including governance, Rego, contracts, audit, actionlint, lint, traceability, formatting, build, typecheck, all-package coverage, DB migration/integration, and P001.
- Final marker: `P001 PostgreSQL integration passed`.
- `git diff --check` — PASS.

## Review and Plan Quality

- Repository plan-quality validator/template/hook/subagent/CI assets are absent. The ignored plan was manually checked for required headings, measured current boundaries, explicit scope, positive/adversarial commands, done conditions, safety invariants, and STOP conditions.
- `make require-crit-review` is unavailable (`No rule to make target`), and `crit status --json` reports no review file or session. Per the repository prohibition on browser Crit, exact staged-diff review is used and no receipt is fabricated.
- Exact staged diff review confirms only four web implementation/test files plus required P7-T10 evidence are committed; open PR #260/#261 paths remain untouched.

## Deferred / Environment

- No real Workbench tenant/browser, external API fetch, credential, production endpoint, message, or irreversible side effect was used.
- `.claude/hooks/contextdb_cli.py` is absent, so no CompactionDB command was available; the durable decision is recorded in the report and learning artifact.
