# JIRA-INT-02 Sandbox Record

- OpenSandbox: not used; the task used the repository workspace and Temporal's local test environment.
- Fixture generation: actual output of `packages/control-plane/scripts/record-replay-history.mjs`; existing tracked histories rewritten by the all-fixture recorder were restored, leaving only 18 new Jira histories.
- Database validation: disposable local PostgreSQL 16 cluster at `/tmp/jira-int-02-pg.JKTdfM`, bound to `127.0.0.1:55432`, with dedicated test databases only.
- Network side effect: Temporal test-server download/cache used by the repository recorder/test suite; no Jira, GitHub, LLM, or other external service was called or registered.
- Privilege fallback: fixture recording, focused replay, and full CI ran outside the filesystem sandbox because Temporal and PostgreSQL shared-memory access are blocked inside it.
- Cleanup: CompactionDB installer-created hook/settings files and `.gitignore` changes were reverted after recording the required decision. The disposable PostgreSQL cluster is stopped at handoff.
- Push/PR/deploy: none.
