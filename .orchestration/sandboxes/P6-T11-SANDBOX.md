# P6-T11 Sandbox Record

- Source/tests: repository workspace only; channel payloads, Graph messages, canonical writer, notification, and audit are synthetic/DI fixtures.
- Temporal: local ephemeral time-skipping test server only; no production namespace or worker was contacted.
- PostgreSQL: disposable local PostgreSQL 16 cluster at `127.0.0.1:55439` only for final real-DB validation; no shared or production database. The cluster is stopped after validation.
- Network: GitHub metadata was inspected with `gh`; no Graph, email, Teams, GitHub webhook, or canonical-data write endpoint was called.
- Secrets: no credential was read, injected, logged, or committed. Secret-shaped fixtures assert redaction/rejection.
- Runtime: no live flag, server composition, scheduled task, or production route was enabled.
