# P8-T01 Agent Task Manifest Report

## Outcome

Implemented a versioned JSON Schema, validator, and pairwise One-Writer gate for coding-agent task manifests. The existing `build-test` contract step runs the new gate through `contracts/package.json`; no extra workflow or server wiring was needed.

## Contract

- Fixes distinct writer and reviewer identities while treating execution profiles as syntax-validated labels only.
- Requires ephemeral clean-checkout runners, pinned CLI versions, a scoped LiteLLM virtual-key reference, agentgateway endpoint/profile references, and no master key, provider key, or direct production network access.
- Requires allowed/forbidden path scopes, blocking gates, positive runtime/cost/token/tool-call limits, task-owned `agent/*` delivery, human-only merge, and the complete callback/review field sets.
- Accepts repository-relative literal paths or a final `/**` subtree only; traversal, absolute paths, backslashes, and mid-pattern wildcards fail closed.
- Rejects writer/reviewer identity reuse, assignment-slot role mismatch, allowed/forbidden overlap, branch/task mismatch, and concurrent task/branch/path claims.

## Scope

- Added only `contracts/agent-task/**`, the one contract-test entry in `contracts/package.json`, and required orchestration evidence.
- Did not add a redundant workflow: `.github/workflows/ci.yml` already runs `mise run contracts` as the `build-test` contract gate.
- Did not touch server source or wire `app.ts`/`index.ts`; any runtime API integration remains a post-#246 task.
- Did not add role-reassignment history. The P8-T01 manifest is an immutable assignment contract; runtime reassignment and commit-range recording require a separate stateful lifecycle task.

## Parallel PR Isolation

GitHub was inspected first. The final task paths do not overlap open [PR #244](https://github.com/mryfmo/ai-ops-platform/pull/244), [PR #245](https://github.com/mryfmo/ai-ops-platform/pull/245), or [PR #246](https://github.com/mryfmo/ai-ops-platform/pull/246).

## Callback

- Commands executed and test results: `.orchestration/validation/P8-T01-VALIDATION.md`
- Changed paths: contract/schema/test files plus this task's evidence files only
- Branch: `agent/P8-T01-agent-task-manifest`
- Pull request: orchestrator-owned after AGMSG result; non-draft, no auto-merge
- Dependency changes: none
- Security findings: none; trust-boundary validation is fail-closed
- Unresolved decisions: runtime reassignment history and server wiring are explicitly deferred
- [memory:decision] Reused the existing `mise run contracts` required-check path instead of adding a duplicate GitHub workflow; kept profile values as opaque labels and path matching deliberately limited to literal/final-subtree scopes.
- CompactionDB recording was unavailable because `.claude/hooks/contextdb_cli.py` is absent in this checkout; the decision is retained above.
