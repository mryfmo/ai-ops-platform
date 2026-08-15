# P5-T02 Validation

## Test-first Evidence

1. Added identity, provenance, retry, timeout, malformed-response, and read-only schema tests before implementation.
2. Ran the integrations test command.
3. RED: all nine initial cases failed because `WorkIqRestClient` did not exist.
4. Added the minimum client and iterated on partial-result and Promise-rejection boundary tests until green.

## Commands and Results

1. `pnpm --filter @aiops/integrations run test:coverage`
   - PASS: 6 files / 60 tests.
   - Package coverage: statements 83.91%, branches 78.99%, functions 97.61%, lines 89.85%.
   - `restClient.ts`: statements 79.85%, branches 78.02%, functions 100%, lines 83.60%.
2. `pnpm --filter @aiops/integrations run typecheck`
   - PASS (also covered by full CI).
3. `pnpm --filter @aiops/integrations run lint`
   - PASS (also covered by full CI).
4. Fresh PostgreSQL 16 databases `p5t02_test`, `p5t02_load_test`, and `p5t02_p001`, then one standalone `mise run ci` with required disposable-DB variables.
   - PASS: exit 0.
   - Governance, Rego, contracts, audit, actionlint, lint, traceability, format, build, typecheck, workspace coverage, and DB integration completed.
   - Final marker: `P001 PostgreSQL integration passed`.
   - All three disposable databases were dropped after the definitive pass.
5. The first full-CI attempt stopped only on a new test that still asserted a synchronous throw after `fetch()` became async. The assertion was corrected to a rejected Promise and all three databases were recreated before the next run.
6. Staged review found that default `jsonschema` could accept arbitrary text. A RED fixture was added; the parser now accepts text only when `format: "typescript"` is explicit. Package coverage and the definitive fresh-DB full CI were re-run after this fix.
7. `make require-crit-review`
   - Repository has no `require-crit-review` target; direct staged-diff review and `git diff --cached --check` were used.
   - The strict-schema finding above was resolved; the final staged review found no unresolved identity, retry, provenance, write-surface, or partial-result issue.
8. `/private/tmp/sec-reg-p4-gitleaks/gitleaks git --staged --no-banner --redact --verbose .`
   - PASS: scanned approximately 37.21 KB; no leaks found.

## Boundary Assertions

- Requests target only `https://workiq.svc.cloud.microsoft/mcp`, use JSON-RPC `tools/call`, and carry only the provider's delegated bearer token.
- Provider claims are reconstructed into the raw claim shape and passed through `validateWorkIqDelegatedClaims`; a type-cast invalid identity fails before `FetchLike` executes.
- `fetch`/`get_schema` get one finite retry for retryable responses; `ask` gets zero retries.
- Timeout, network, outer HTTP, tool error, malformed envelope/payload/provenance, incomplete result counts, and inner non-2xx statuses return fixed fail-closed codes without partial values.
- Work IQ `sourceReferences` and `permissionContext` are retained verbatim when present; omission is explicit and never fabricated.

## Deferred Conformance

- WIQ-002 live-tenant conformance must verify whether real Work IQ responses supply `sourceReferences` / `permissionContext` and record their observed placement and shape. This task used synthetic DI fixtures and did not contact Work IQ.
