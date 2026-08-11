# T24 Sandbox

- No external API calls.
- No real PostgreSQL server used.
- Migration behavior validated with PgQueryable mocks.
- CI may need sandbox-external rerun if local `tsx` IPC fails with EPERM, matching prior T23/T22 evidence.
