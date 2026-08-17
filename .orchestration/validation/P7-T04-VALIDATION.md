# P7-T04 Validation

## Test-First Evidence

- RED: `pnpm --filter @aiops/channel-teams test -- richResultComponents.test.ts` failed because `src/components/richResult.ts` did not exist; the package's existing 35 tests still passed.
- GREEN: `pnpm --filter @aiops/channel-teams exec vitest run -u tests/richResultComponents.test.ts` — 2 files / 53 tests, all pass; deterministic snapshot updated.
- `pnpm --filter @aiops/channel-teams lint` — PASS.
- `pnpm --filter @aiops/channel-teams typecheck` — PASS.
- `pnpm --filter @aiops/channel-teams test:coverage` — PASS: statements 94.22%, branches 88.94%, functions 100%, lines 99.00%.

## Negative and Boundary Matrix

- Rejects unknown result kinds, unknown keys, and arbitrary Adaptive Card JSON.
- Rejects HTML/script, Markdown link/emphasis, raw URI text, control characters, blank text, and oversized text.
- Rejects `javascript:`, `data:`, HTTP, credential-bearing, and fragment-bearing action URLs.
- Rejects `NaN`, positive infinity, and negative infinity in chart and table values.
- Rejects a runtime-cast result containing markup because rendering reparses the value.
- Rejects serialized cards over 28 KiB.
- Type assertion proves an arbitrary `{ type: "AdaptiveCard"; body: ... }` value is not assignable to `RichResult`.
- Snapshot covers status, table, positive/zero/negative bar points, line chart, incident, pull request, and source identity/version/link output.

## Full Gate

- Final validation used three new disposable PostgreSQL databases: `p7t04_r4_test`, `p7t04_r4_load`, and `p7t04_r4_p001`.
- `mise run ci` — PASS, exit 0, including governance, Rego, contracts, actionlint, lint, traceability, formatting, build, typecheck, all-package coverage, DB migration/integration, and P001.
- Final marker: `P001 PostgreSQL integration passed`.
- An earlier run stopped at `db:require` because current main requires explicit test/load/P001 database variables. Reruns supplied those variables against fresh databases; no product change or gate weakening was used.
- `git diff --check` — PASS.

## Review and Plan Quality

- The repository plan-quality validator/template/hook/subagent assets described by the skill are absent. The ignored plan was manually checked for the required headings, explicit scope, assumptions, security boundaries, positive/adversarial tests, and deferred gates.
- Final-candidate review caught a zero bar point rendered with one block. The shared bar-width calculation was corrected and the deterministic snapshot now renders zero as `0`.
- `make require-crit-review` is unavailable (`No rule to make target`), and `crit status --json` reports no review file or session. Per the repository prohibition on browser Crit, final review used the exact staged diff; no Crit receipt was fabricated.

## Deferred / Environment

- Real Teams tenant rendering and delivery are deferred until tenant access exists.
- PR #260 is open; package-root re-export is deferred until it merges.
- No tenant, credential, external message, production endpoint, or irreversible side effect was used.
