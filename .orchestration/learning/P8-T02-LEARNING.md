# P8-T02 Learning

## Reusable Findings

1. A post-run boundary guard must union tracked, untracked, and ignored paths. Trusting the post-run ignore rules lets an agent change `.gitignore` and hide a forbidden addition.
2. Rename detection does not need rename heuristics for authorization: comparing pre/post path-keyed snapshots turns a rename into a deleted source plus added destination, so both boundaries are checked.
3. File content alone is insufficient at a coding trust boundary. Mode, symlink target, unresolved target, repository containment, and Git metadata need independent snapshot records.
4. Unconditional governance and credential paths must be fixed in the guard and evaluated before manifest allowlists; a manifest is task authority, not authority to rewrite the authority mechanism.
5. Git commands that may refresh the index belong outside the guarded agent interval or need `GIT_OPTIONAL_LOCKS=0`; `.git/**` integrity intentionally treats index mutation as a rejection.
6. An external snapshot is not automatically trusted when the agent shares the runner account. Authenticate it with an ephemeral key scoped only to trusted pre/post steps, and hard-forbid the guard sources themselves.
7. A governance test that imports an independent workspace can pass locally only because that workspace's dependencies persist. Keep the governance-time import chain dependency-free, simulate the missing workspace `node_modules`, and reject unsupported schema keywords so the fallback does not silently widen acceptance.

## Apply To

- P8-T04/P8-T05 runner wiring and sandbox E2E, P8-T09 budget/kill-switch execution, and any future pre/post repository mutation gate.

No rule or skill was promoted by this worker.
