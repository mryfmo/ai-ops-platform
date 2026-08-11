# P1-T04 validation

Validated at `2026-08-11T10:58:47Z` from a dedicated worktree based on `d8a049f`.

| Gate | Result |
| --- | --- |
| `node contracts/check-contracts.mjs` | PASS — 5 contracts valid and compatible |
| `pnpm --dir contracts run check` | PASS — Spectral lint and 10/10 tests after review fixes |
| `SCARF_ANALYTICS=false pnpm --dir contracts install --frozen-lockfile` | PASS — one pinned linter dependency |
| `pnpm --dir contracts run lint` | PASS — Spectral OpenAPI/AsyncAPI validation |
| `env CI=true pnpm exec prettier --check contracts` | PASS |
| `env CI=true pnpm run governance:check` | PASS |
| `env CI=true pnpm run traceability` | PASS |
| fresh-DB `mise run ci` | PASS — exit 0 |
| PR #175 exact-head checks | PASS — `build-test`, `gitleaks`, `CodeRabbit` at `baed71a` |

The successful CI run used task-specific empty PostgreSQL databases on `127.0.0.1:55432`. It completed governance, production audit (no high/critical findings; 1 low and 2 moderate reported), actionlint, lint, traceability, format, build, typecheck, coverage, and DB integration. The databases were dropped after validation.

Three completed native diff review rounds found and resolved seventeen issues. The last five covered composed `WorkflowStatus` validity, operation security additions/removals, API base-path preservation in the generated-client smoke, schema-valued `additionalProperties`, and object-valued `const`. Each compatibility false-negative now has a focused mutation test.
