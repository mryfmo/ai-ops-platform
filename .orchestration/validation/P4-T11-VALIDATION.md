# P4-T11 Validation

## Test-first Evidence

1. Added server tests before implementation; RED was a missing `mcpOpsRepo` module.
2. Added Web BFF/view tests before implementation; RED was a missing `McpOpsView` module.
3. Implemented the minimum SQL projection, request-time authorization, strict BFF schema, and dashboard view.
4. Governance initially rejected a computed fetch target. Reused the repository's uppercase same-origin path-constant pattern; governance then passed.

## Commands and Results

1. `pnpm --filter @aiops/server exec vitest run tests/mcpOps.test.ts`
   - PASS: 1 file / 6 tests.
2. `pnpm --filter @aiops/web exec vitest run tests/mcpOps.test.tsx`
   - PASS: 1 file / 5 tests.
3. `mise run governance`
   - PASS: architecture fitness including direct-egress checks.
4. `mise run typecheck`
   - PASS: all workspace packages.
5. `mise run test:coverage` with disposable PostgreSQL 16 databases
   - PASS: exit 0.
   - Server: 80 files / 879 tests; statements 83.29%, branches 76.76%, functions 78.61%, lines 85.20%.
   - Web: 41 files / 330 tests; statements 82.20%, branches 71.57%, functions 82.63%, lines 84.97%.
6. `mise run verify:db` against fresh `aiops_p001`
   - PASS: exit 0; final marker `P001 PostgreSQL integration passed`.
7. Real PostgreSQL query probe against a fresh schema with raw marker `never-return`
   - PASS: in-scope summary returned one invocation and 100% deny rate; invocation audit returned correlated metadata and did not contain the marker.
   - PASS: `PJ-999` out-of-scope summary returned zero and invocation audit returned null.
8. `pnpm --filter @aiops/web exec next build --webpack`
   - PASS: production build exit 0, including `/app/api/mcp-ops`, invocation lookup, and `/app/dashboard/mcp-ops` routes.
9. `mise run ci` with fresh DB environment, repeated with sandbox escalation
   - ENVIRONMENT BLOCKED at `next build`: Turbopack helper attempted a local port bind and the outer sandbox returned `Operation not permitted`.
   - Before the environment failure, governance, Rego, contracts, audit, actionlint, lint, traceability, format, and non-Web package builds were green.
   - Build was validated with the webpack backend and all phases after build were run separately green. Clean-runner CI is required for the exact composite exit-0 receipt.

## Boundary Assertions

- No tool input/result content or resource scope is selected by the new repository queries.
- Project authorization is part of each SQL `WHERE` predicate, not a display-layer mask.
- Active recipient assignment is fetched on every request; no recipient cache exists.
- No external network, live MCP server, gateway, or production database was used.
