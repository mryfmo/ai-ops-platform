# P7-T10 Sandbox Record

- OpenSandbox was not required: the parser and React renderer are local, deterministic, and network-free.
- GitHub access was limited to read-only `gh` inspection of PR #260 and PR #261 plus fetching `origin/main`.
- Mandatory full CI used an already-running local PostgreSQL 16 service and new disposable task-named databases; the shared service was not stopped or changed outside those databases.
- No browser, Workbench tenant, external fetch, iframe, arbitrary code, credential, dependency download, deployment, message send, or irreversible external side effect was used.
