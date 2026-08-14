# P3-T06 sandbox

- Temporal: local time-skipping environment with injected in-memory activities; no external API calls or provider credentials
- histories: three local recorded fixtures covering JIT lost response, old-path-first shadow reconciliation, and health activation
- PostgreSQL: existing disposable local cluster on `127.0.0.1:55432`; only task-specific `p3t06_*` databases were created, used, and then dropped
- an attempted task-owned cluster could not bind because the disposable port was already occupied; its never-started data directory, socket directory, and log were removed
- no production configuration, system service, or legacy scheduler path was changed
