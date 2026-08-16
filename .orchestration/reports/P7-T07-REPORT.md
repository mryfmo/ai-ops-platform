# P7-T07 Workbench Read Model Report

## Outcome

Implemented the Workbench workspace/source/run/action read model as references over existing authorities. PostgreSQL stores workspace metadata plus source, workflow, action, and approval identifiers; current workflow/action/approval state is resolved from the existing authority/read-model tables at read time.

## Contract

- `workbench_workspaces` stores workspace kind, project scope, owner, and creation time.
- `workbench_workspace_sources` stores only external system/type/ID/HTTPS URL references; it has no content, payload, or summary column.
- `workbench_workspace_runs` stores only a workspace-to-`workflow_runs.workflow_id` link.
- `workbench_pending_actions` stores only matching `action_ledger` operation and `approvals` identifiers; it cannot become an execution or approval authority.
- Run, action, and approval status are live-joined from their authority tables.
- The server resolves the active recipient on every request and applies project/global scope in the repository SQL before rows are returned.
- The Web BFF signs the session subject and strictly parses the reference-only response; unexpected fields fail closed.
- No UI body or action mutation endpoint was added; those remain later-task concerns.

[memory:decision] Workbench persistence holds links only: workflow/action/approval state remains live in workflow_runs, action_ledger, and approvals, while source records hold external metadata references without source content. Apply this rule to P7-T08/T10 UI and future Workbench extensions.

## CompactionDB

The project instruction command was attempted, but the repository CLI is absent:

`python3 .claude/hooks/contextdb_cli.py memory add --help`

Result: `[Errno 2] .claude/hooks/contextdb_cli.py: No such file or directory`. No project memory mutation was possible.

## Handoff

- Branch: `agent/P7-T07-workbench-data-model`
- Orchestrator performs push and PR creation after `AGMSG-RESULT`.

## R01 Parallel Coverage Isolation

Reviewer coverage exposed a cross-file fixture race: Workbench used the shared `public` schema while `p1LedgerPg.test.ts` deletes all `workflow_runs` and `action_ledger` rows between its tests. Unique fixture IDs cannot protect rows from an unscoped delete.

`workbenchPg.test.ts` now creates a UUID-named schema per process, runs the complete schema and migration there through a pool-scoped `search_path`, asserts that the suite is not using `public`, and drops only that exact schema after closing the suite pool. No worker-count limit or retry masks the race.

[memory:failure] Real-PostgreSQL test files that share one database cannot rely on unique row IDs when a sibling suite performs unscoped cleanup; isolate the suite schema (and assert current_schema) or make every sibling cleanup row-scoped. Apply this to future parallel coverage PG suites.
