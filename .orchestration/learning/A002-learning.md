# A002 Learning

## Candidate reusable learning

When an uncommitted reviewed plan revision is lost, an agent-side Crit snapshot can preserve a complete intermediate document even when the expected content SHA is absent from all Git refs and unreachable objects. Recovery still requires semantic reconstruction from worklog records, a new content SHA, and a fresh full structural review; the recovered snapshot digest must not be presented as the missing historical target digest.

For large plan resynchronization, validate the task heading set and dependency-table set as equal collections before testing graph properties. Then check required fields, unknown references, duplicate nodes/rows, cycles, and shared Allowed-file ownership order. A count-only check would have missed several dependency-edge errors corrected during A002.

## Application

- Reuse the disposable `.orchestration/validation/A002-validate-plan.mjs` pattern for future plan recovery tasks.
- Record the source snapshot SHA, final SHA, and explicit mismatch declaration in validation reports.
- Separate task-scoped formatting from repository baseline formatting so a blocked global gate is reported without silently editing files outside the task contract.

This is orchestration learning only. A002 forbids updating `.agents/worklog/codex/learn`.
