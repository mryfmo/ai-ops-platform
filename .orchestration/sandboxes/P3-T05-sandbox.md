# P3-T05 sandbox record

- Microsoft Graph sandbox: not used; tenant/resource credentials were unavailable and the task explicitly requires DI mocks instead.
- Temporal: local ephemeral time-skipping test server only; no production namespace or external workflow was touched.
- PostgreSQL: existing disposable local instance at `127.0.0.1:55432`; only `aiops_test`, `aiops_load_test`, and `aiops_p001` were recreated for CI.
- Network: no Graph API request; activity effects were in-memory fixtures.
