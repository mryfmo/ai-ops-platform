# P5-T01 Work IQ Entra/OBO Contract

## Outcome

Defined a delegated-only Work IQ application contract and added a pure claim validator that rejects app-only tokens before any Work IQ dispatch.

## Delivered

- `docs/contracts/workiq-obo.md`: exact Control API and Work IQ audiences/scopes, six-stage fail-closed OBO flow, tenant admin consent, cache isolation/expiry/revocation, gateway conformance, ADR-only bypass, and OPA egress handoff.
- `packages/integrations/src/workiq/tokenClaims.ts`: exact `iss`, `tid`, `aud`, `sub`, and `scp` validation with fixed non-leaking errors.
- `packages/integrations/tests/workIqTokenClaims.test.ts`: synthetic valid delegated, roles-only/missing `scp`, audience, tenant, issuer, subject, excess-scope, and malformed-input fixtures.
- Root `@aiops/integrations` re-export under the approved scope amendment.

## Security Posture

- `scp` must be exactly `WorkIQAgent.Ask`; application `roles` cannot substitute for delegation.
- Audience is fixed to `api://workiq.svc.cloud.microsoft` and issuer to the configured tenant's v2 endpoint.
- No Graph implementation, dependency, deploy configuration, or `docs/security/**` change.
- No live credential, token, tenant ID, application ID, or secret was used or committed.

## Validation Summary

- Test-first RED: missing `src/workiq/tokenClaims.ts` module.
- Integrations: 5 files / 48 tests green; new validator 100% statements, branches, functions, and lines.
- Fresh-database `mise run ci`: exit 0, including governance, build, workspace coverage, and P001 PostgreSQL integration.
