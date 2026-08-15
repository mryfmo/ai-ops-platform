# P5-T03 Validation

## Test-first Evidence

1. Added route-order, four required claim denial, OPA denial/failure, and cache-isolation tests before implementation.
2. RED: Vitest could not resolve the absent `workIqOboTokenProvider` module.
3. Added the minimum route/auth implementation and the two approved workspace links.
4. The first implementation run exposed a fixture boundary error: the canonical validator requires raw Entra claim keys, not the post-validation claim shape. The fixtures were corrected and the route/auth suite became green.
5. Added wrong configured-tenant, fail-disabled, and cache TTL regression cases during the security reread.
6. Independent review found that project/source declarations were presented as though Work IQ could enforce them at retrieval. A RED regression test pinned the honest contract, then the route removed those fields from OPA actor/resource authorization inputs and retained them only as explicitly named declared-purpose context.

## Commands and Results

1. `env CI=true pnpm --filter @aiops/server exec vitest run tests/m365DelegatedRoutes.test.ts`
   - PASS: 1 file / 14 tests after the P1 correction.
2. `env CI=true pnpm --filter @aiops/server run test`
   - PASS before final additions: 80 files passed, 1 skipped; 877 tests passed, 13 skipped.
3. `env CI=true pnpm --filter @aiops/server run typecheck`
   - PASS.
4. `env CI=true pnpm --filter @aiops/server run lint`
   - PASS.
5. `env CI=true pnpm --filter @aiops/server run build`
   - PASS.
6. Fresh PostgreSQL 16 databases `p5t03_test`, `p5t03_load_test`, and `p5t03_p001`, then standalone `mise run ci` with explicit `PGHOST=127.0.0.1`, `PGPORT=55432`, and `PGUSER=postgres` plus the required disposable-DB variables.
   - PASS: exit 0.
   - Server coverage: 81 files / 893 tests, including `m365Delegated.ts` and `workIqOboTokenProvider.ts`.
   - Governance, Rego, contracts, audit, actionlint, lint, traceability, format, build, typecheck, workspace coverage, and DB integration completed.
   - Final marker: `P001 PostgreSQL integration passed`.
   - All three disposable databases were dropped afterward.
7. An earlier full-CI attempt reached workspace coverage but its PostgreSQL fixtures selected the nonexistent OS role `mryfmo` because libpq `PGUSER` was omitted. No code assertion failed; all disposable DBs were recreated before the definitive run.

## Boundary Assertions

- Successful observable call order is exactly active signed identity -> OBO claim validation -> OPA -> Work IQ network dispatch.
- Wrong configured tenant, OBO issuer/tenant/audience/subject, missing delegated `scp`/roles-only app token, and expired OBO result are terminal before policy/client execution.
- Policy input binds `work-iq.m365-intelligence.ask` at L1. Request `projectId` and `allowedSourceTypes` appear only in the JSON-encoded declared-purpose context; actor `projectIds`, resource `projectId`, and resource source labels are absent.
- Work IQ receives the original question without a prompt prefix. The upstream ask contract has no enforceable project/source filter, so retrieval isolation is delegated M365 permission trimming; output-side OPA classification/minimization belongs to later P5 egress controls.
- OPA deny, approval, exception, and client-layer errors return only fixed metadata. Authorization/policy audits never contain the assertion, downstream token, raw claims, question, answer, or policy reasons.
- Cache keys are JSON-structured `(subject, tenant, canonical sorted scope set, resource audience)` values. Effective cache expiry is `min(exp - 120s, now + 5m)`.

## Deferred Environment Work

- The real Entra assertion verifier/OBO exchange, tenant/application configuration, consent, and gateway conformance remain environment-gated follow-up work. This task intentionally leaves the route fail-disabled without injected dependencies.
- WIQ-002 real-tenant conformance must run the same ask as two delegated users with different M365 permissions and prove that inaccessible content/source references are absent for the less-privileged user. It must also verify output-side classification/minimization before any external egress. Declared project/source context is not accepted as retrieval-filter evidence.
