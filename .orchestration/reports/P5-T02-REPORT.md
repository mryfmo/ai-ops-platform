# P5-T02 Work IQ Delegated MCP Client

## Outcome

Implemented the delegated-only Work IQ `fetch`, `ask`, and read-only `get_schema` client over HTTP JSON-RPC `tools/call` at the canonical `/mcp` endpoint.

## Delivered

- `packages/integrations/src/workiq/restClient.ts`: injected `FetchLike` and delegated token provider, mandatory claim revalidation, canonical endpoint/path guards, bounded timeout/retry, strict JSON/SSE response parsing, and fail-closed E-code results.
- `packages/integrations/tests/workIqRestClient.test.ts`: synthetic identity/provenance, retry, timeout, network, HTTP, malformed, partial-result, non-2xx entity, SSE, and unsafe-path coverage.
- `packages/integrations/src/index.ts`: public client and contract re-exports only.

## Security Posture

- Every request gets one access-token/claims pair from the caller-scoped provider and re-runs `validateWorkIqDelegatedClaims` before dispatch.
- No app-only provider, write tool, custom endpoint, identity override, token persistence, or response-body error leakage exists.
- `fetch` and `get_schema` retry at most once; `ask` is never retried.
- Missing provenance is not invented: typed results return `sourceReferences: []`, `permissionContext: null`, and `provenanceComplete: false`.
- A fetch response with missing entities or any non-2xx item fails closed without exposing partial data.

## Validation Summary

- Test-first RED confirmed the client/export did not exist.
- Integrations: 6 files / 60 tests green; package typecheck, lint, format, and coverage green.
- Fresh-database `mise run ci`: exit 0, including governance, build, workspace coverage, and P001 PostgreSQL integration.
