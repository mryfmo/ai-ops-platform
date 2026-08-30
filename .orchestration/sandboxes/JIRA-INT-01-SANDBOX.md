# JIRA-INT-01 Sandbox Record

- OpenSandbox: not used; no repository sandbox definition was available or required.
- Pack extraction: repository-external `mktemp -d` at `/var/folders/r2/_gkywj713g54lbxkc_hv7j400000gn/T/tmp.D8hxt6W5IO`.
- Database validation: disposable local PostgreSQL 16 cluster in that temp directory, bound to `127.0.0.1:55432`, with dedicated test databases only.
- Network side effect: Temporal test-server download/cache used by the repository test suite; no Jira, GitHub, LLM, or other external service was called or registered.
- Privilege fallback: full CI was run outside the filesystem sandbox because `tsx` IPC and Temporal test-server access are blocked inside it.
- Cleanup: CompactionDB installer-created hook/settings files and `.gitignore` changes were reverted after recording the required decision. The disposable PostgreSQL cluster is stopped at handoff.
- Push/PR/deploy: none.
