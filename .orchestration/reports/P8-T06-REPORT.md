# P8-T06 Codex Independent Review Job Report

## Outcome

Implemented a read-only independent review workflow plus a versioned structured-findings contract. The workflow runs trusted review code from its own checkout, treats the coding-task head as data in a separate checkout, validates the P8-T01 manifest reviewer/profile, and uploads a schema-valid artifact without any real LLM or credential.

## Security Boundary

- Workflow and job permissions are exactly `contents: read`; no secret is referenced and both checkouts use `persist-credentials: false`.
- The review target is checked out under `review-target`; no step changes working directory there or executes a local action/script from it.
- The trusted collector accepts only full lowercase commit SHAs, disables external diff/text conversion, rejects unsafe repository paths, and reads the target manifest as untrusted JSON.
- Workflow tests fail closed on write scopes, persisted credentials, branch-mutation commands, target-code execution surfaces, reviewer/profile substitution, malformed artifacts, traversal, and abbreviated revisions.

## Artifact and Collection Contract

- Every finding contains `dimension`, `severity`, `file`, `line`, `evidence`, and `suggestion`.
- The artifact binds task ID, reviewer identity/profile, base/head SHAs, and all nine canonical review dimensions to the P8-T01 manifest.
- Mechanical collection records changed paths, referenced spec IDs, and security-sensitive paths.
- A changed forbidden path deterministically emits a critical security finding; a changed path outside `paths.allowed` emits a high spec-compliance finding. Other semantic review decisions remain for the later review engine.

## Scope

- Added one new workflow, one new stdlib collector script, `contracts/agent-review/**`, one contracts test-command entry, and required evidence files.
- Added no dependency, lockfile change, credential, LLM call, branch-push step, server wiring, or production configuration.
- Did not change any PR #251 file or the root `package.json`.

## Parallel PR Isolation

GitHub was inspected first. This task has no path overlap with open [PR #251](https://github.com/mryfmo/ai-ops-platform/pull/251) or [PR #252](https://github.com/mryfmo/ai-ops-platform/pull/252); [PR #250](https://github.com/mryfmo/ai-ops-platform/pull/250) was already merged before implementation.

## Callback

- Commands and results: `.orchestration/validation/P8-T06-VALIDATION.md`
- Branch: `agent/P8-T06-codex-review-job`
- Pull request: orchestrator-owned after AGMSG result; non-draft, no auto-merge
- Dependency changes: none
- Security findings: none remaining after local review
- Unresolved decisions: real Codex/LLM invocation and writer-reviewer lifecycle handoff remain explicitly outside P8-T06
- [memory:decision] Keep PR code data-only: execute the collector/validators from a trusted checkout and place the review target in a separate checkout with no credentials or working-directory execution.
- CompactionDB recording is unavailable because `.claude/hooks/contextdb_cli.py` is absent in this checkout; the decision is retained above.
