# P4-T02 Validation

## Test-first evidence

1. Before implementation, the focused Vitest run failed because
   `../src/mcp/registryGenerator.js` did not exist (expected RED, zero tests).
2. An initial I/O-bearing implementation under the integrations contract
   surface failed the existing no-vendor/import boundary test. The I/O wrapper
   was moved to `contracts/tools/`; the boundary test was not weakened.

## Focused checks

- `env CI=true mise run contracts` — PASS; 46 tests across 6 suites, including
  4 P4-T02 contract tests.
- `pnpm --filter @aiops/integrations run build` — PASS.
- `pnpm --filter @aiops/integrations run typecheck` — PASS.
- `pnpm --filter @aiops/integrations run lint` — PASS.
- `pnpm --filter @aiops/integrations run test` — PASS; 3 files, 16 tests.
- `pnpm exec tsx contracts/tools/generate-agentgateway.mjs --check` — PASS;
  `REGISTRY CONFIG PASS: enabled=0`.
- scoped Prettier check and `git diff --check` — PASS.
- high-precision staged-path credential/private-key pattern scan — no matches.

## Contract evidence

- Normalized schema SHA-256:
  `b63383c46b107bb48522f0dafb6d435de2413b0c9dd98596430839a4aea37f31`.
- Canonical all-disabled generation is byte-identical to
  `deploy/agentgateway/config.yaml`.
- Enabled-mixed fixture is byte-identical to its golden output.
- Negative fixtures reject schema drift, an enabled entry without endpoint,
  an invalid endpoint on a disabled entry, hand-edited generated config, and a
  forbidden high-risk operation even when the ledger misclassifies it.
- The pre-existing P4-T01 Agentgateway contract suite remains green unchanged.

The CEL bindings were checked against the official Agentgateway authorization
documentation for `jwt.sub`, `mcp.tool.target`, and `mcp.tool.name`:

- <https://agentgateway.dev/docs/standalone/latest/tutorials/authorization/>
- <https://agentgateway.dev/docs/standalone/1.2.x/configuration/security/mcp-authz/>

## Fresh-DB Definition of Done

Created fresh local PostgreSQL databases `aiops_test`, `aiops_load_test`, and
`aiops_p001` on `127.0.0.1:55432`, then ran `mise run ci` with the repository's
explicit disposable-DB environment. Result: exit 0; governance, Rego,
contracts, audit, actionlint, lint, traceability, format, build, typecheck,
coverage, and DB integration all passed. Expected negative-test PostgreSQL
ERROR messages were followed by `P001 PostgreSQL integration passed`.

The traceability command changed only its generated timestamp; that incidental
tracked diff was restored after the green run.

## Review gate

- `make require-crit-review` was attempted and returned
  `No rule to make target 'require-crit-review'`.
- Per the repository prohibition, no browser Crit review was opened. The staged
  implementation and artifact diff was inspected locally; independent
  adversarial review remains the assigned orchestrator's next gate.
