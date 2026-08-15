# P5-T01 Sandbox Record

- Source/tests: repository workspace only; token tests use plain synthetic claim objects and no bearer token.
- Database: three uniquely named disposable databases on the existing local PostgreSQL 16 container at `127.0.0.1:55432`; all three were dropped after `mise run ci`.
- External research: read-only Microsoft Learn/GitHub documentation was used to confirm the published Work IQ audience and delegated permission name.
- External systems: no Entra tenant, Work IQ endpoint, Graph endpoint, agentgateway, OPA service, production database, or cloud resource was contacted.
- Secrets: no credentials, real tenant/application IDs, access tokens, refresh tokens, or certificates were read or written.
- Repository isolation: `docs/security/**` and the open PR #236 work were untouched.
