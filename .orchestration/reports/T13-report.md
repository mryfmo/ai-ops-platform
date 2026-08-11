# T13 Report

## Status

ready_for_review with explicit limitations.

I did not label mock/dev bypass/app.request checks as E2E. Items requiring PostgreSQL server, real Entra ID sessions, GitHub App/org webhooks, Teams tenant, or `ANTHROPIC_API_KEY` are recorded as `requires-real-env`.

## Changes

- Added `runbooks/e2e-real-environment.md` with real-environment prerequisites, env vars, steps, and checklist.
- Updated `verification/VERIFICATION_REPORT.md` with a Phase V T13 section using:
  - `verified-integration`
  - `requires-real-env`
- Updated `README.md` with the T13 Web startup observation and the real-environment E2E runbook link.

## Key Findings

- Web can build and start with `next start`.
- The app is served under basePath `/app`; bare `/dashboard` and `/api/health` are 404.
- Localhost Auth.js startup needs `AUTH_TRUST_HOST=true`; without it, `UntrustedHost` is logged.
- `/app/login` and `/app/api/health` return 200.
- Unauthenticated `/app/dashboard` redirects to login; unauthenticated data/chat APIs return 401.
- This local environment has no PostgreSQL server, no Docker, and no `ANTHROPIC_API_KEY`.
- Current `agent/T12` ancestry does not contain the T08 Excel import implementation, so Excel import E2E cannot be performed from this stack tip.

## Validation

See `.orchestration/validation/T13-validation.txt`.

## Not Done Locally

- Authenticated dashboard 200 and authenticated JSON structures for `/app/api/data/*`.
- Real server startup with schema-applied PostgreSQL and `/readyz` 200.
- Real LLM `/app/api/chat` smoke with reasoning parts/tool calls.
- GitHub App/org webhook and Teams Graph notification E2E.
- Excel import E2E, because implementation is absent from current stack tip.
