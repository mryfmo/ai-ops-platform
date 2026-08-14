# P4-T11 Sandbox Record

- Source/tests: repository workspace only; Hono routes and Web BFF use injected repositories/fetch in focused tests.
- Database: disposable local PostgreSQL 16 cluster on `127.0.0.1:55441`; fresh test/load/P001/query-probe databases only.
- Network: no live MCP server, gateway, OPA, GitHub API, or production service used by P4-T11 validation.
- Secrets: synthetic identity secret and raw-content marker only; neither appears in returned evidence.
- Build: webpack production build passed. Turbopack could not bind its local helper port under the outer execution sandbox.
- Cleanup: the disposable PostgreSQL cluster is stopped after validation; no production resource is created or changed.
