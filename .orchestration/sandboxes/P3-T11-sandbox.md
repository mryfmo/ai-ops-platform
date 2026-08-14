# P3-T11 Sandbox Record

- Isolation: Temporal in-process time-skipping test server and injected activity functions.
- External services: none.
- Persistent writes: only the deterministic JSON evidence file in `verification/chaos/`.
- Workflow identity: unique chaos workflow IDs; duplicate-start probes reuse an ID only within their isolated test environment.
- Cleanup: every environment is torn down; terminal failures are awaited with bounded observation.
- Fixture policy: existing merged histories are replayed in place and never regenerated.
