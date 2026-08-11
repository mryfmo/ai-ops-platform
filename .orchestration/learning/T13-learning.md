# T13 Learning

## Findings

- Next.js app uses basePath `/app`; real HTTP smoke must hit `/app/login`, `/app/api/health`, `/app/dashboard`, and `/app/api/...`.
- Auth.js v5 rejects localhost in this runtime unless `AUTH_TRUST_HOST=true` is set.
- This workstation has libpq clients but no PostgreSQL server binary: `initdb` exists, `postgres` does not.
- `tsx` may need outside-sandbox execution because it opens a local IPC pipe.
- `agent/T12` does not include T08 Excel import implementation, so stack-level integration verification cannot assume Excel code exists.

## Apply To

- `runbooks/e2e-real-environment.md`: include `AUTH_TRUST_HOST=true`, basePath `/app`, and PostgreSQL server requirement.
- Future T13-like validation: distinguish `verified-integration` from `requires-real-env`; do not call app.request/mock/dev bypass E2E.
