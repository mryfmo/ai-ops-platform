# P5-T03 Control API Delegated M365 Endpoint

## Outcome

Implemented the fail-disabled `POST /m365/query` route with the fixed successful order identity envelope -> delegated Work IQ claims -> OPA -> `WorkIqRestClient`.

## Delivered

- `packages/server/src/http/routes/m365Delegated.ts`: signed identity envelope authentication, active-recipient lookup, strict request parsing, configured-tenant/subject/delegated-claim validation, OPA boundary, metadata-only denial responses/audit, and concrete `WorkIqRestClient.ask` dispatch.
- `packages/server/src/auth/workIqOboTokenProvider.ts`: injected OBO exchange contract and bounded in-memory token cache keyed by the structured subject/tenant/sorted-scope/resource tuple.
- `packages/server/tests/m365DelegatedRoutes.test.ts`: order, fail-disabled, invalid identity, wrong configured tenant, wrong OBO tenant/audience/subject, app-only, OPA deny/approval/failure, cache isolation, and TTL coverage using synthetic fixtures only.
- `packages/server/src/http/app.ts` / `packages/server/src/index.ts`: optional route registration and public exports. No real OBO composition or production configuration is enabled.
- `packages/server/package.json` / `pnpm-lock.yaml`: only the orchestrator-approved `workspace:*` links to `@aiops/integrations` and `@aiops/policy`.

## Security Posture

- An invalid identity never reaches recipient lookup, OBO, OPA, or Work IQ; a wrong configured tenant or any invalid delegated claim never reaches OPA or Work IQ.
- OBO output is passed to the canonical `validateWorkIqDelegatedClaims`; the validated `sub` must equal the signed identity subject. There is no application-token fallback.
- OPA `deny`, `require_approval`, transport exception, and fail-closed error result all stop before client dispatch.
- `projectId` and `allowedSourceTypes` are explicit declared-purpose context, not retrieval authorization fields. They are absent from OPA actor/resource enforcement fields and are never prompt-prefixed into the Work IQ question.
- Work IQ ask has no input-side project/source filter. Its isolation boundary is delegated M365 permission trimming; output-side OPA classification/minimization is owned by later P5 egress work.
- Authorization and policy audits contain fixed E-codes and decision metadata only; tokens, claims, reasons, questions, and Work IQ content are excluded.
- The route remains 503 fail-disabled until an approved environment supplies all dependencies and the identity secret.

## Validation Summary

- Test-first RED proved the route/auth modules did not exist.
- Targeted route/auth: 14 tests green, including declared-purpose versus authorization semantics; server package: 81 files / 893 tests green under coverage.
- Server typecheck, lint, build, and repository format/traceability gates are green.
- Fresh-database `mise run ci`: exit 0 through `P001 PostgreSQL integration passed`.
