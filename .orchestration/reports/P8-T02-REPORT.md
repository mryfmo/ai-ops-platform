# P8-T02 Path Boundary Guard Report

## Outcome

Implemented a fail-closed pre/post guard for coding-agent worktrees. The guard validates the P8-T01 task manifest, snapshots tracked, untracked, ignored, symlink, mode, and Git-metadata state, then rejects every changed path outside the manifest allowlist or inside a manifest/hard forbidden boundary.

R01 removed the guard's hidden dependency on the independently installed contracts workspace. Manifest validation now reads the same P8-T01 JSON Schema through a dependency-free schema-subset evaluator under `contracts/agent-task/`; unsupported future schema keywords fail closed instead of being ignored.

## Enforcement

- Reuses `validateAgentTaskManifest` and `pathScopesOverlap` from `contracts/agent-task/manifest-validator.mjs`; overlap semantics are not reimplemented. The validator import chain contains only Node.js standard-library modules and the checked-in JSON schema.
- Requires a clean checkout and an external, create-once snapshot path before agent execution.
- Authenticates the snapshot with a caller-held ephemeral HMAC key that is passed only to trusted pre/post steps.
- Detects content, add, delete, rename-as-delete/add, file mode, symlink target, ignored-file, `.git` marker, hook, index, config, and other Git-metadata changes.
- Rejects manifest-forbidden and outside-allowed changes.
- Rejects `.github/workflows/**`, `.github/actions/**`, all supported CODEOWNERS locations, branch-protection/settings paths, and `contracts/agent-task/**` regardless of manifest allowance.
- Rejects modification of the guard CLI/test themselves regardless of manifest allowance.
- Rejects `.env*`, `*.pem`, `.aws` path segments, and common credential files regardless of ignore state.
- Rejects unresolved symlinks and symlinks resolving outside the repository, into forbidden paths, or outside allowed paths.
- Rejects invalid UTF-8, absolute, backslash, empty-segment, dot, and traversal paths.

## Delivery

- Added the Node.js standard-library CLI under `scripts/` and a separate composite action under `.github/actions/run-coding-agent/path-boundary/`.
- The composite action exposes explicit `pre` and `post` phases; P8-T04/T05 remains responsible for placing them around the runner and keeping the snapshot under runner temp.
- Added the malicious fixture suite to the existing required `governance:check` command under the approved Q01 option-a scope amendment.
- Added no dependency, did not change the P8-T01 schema, and changed only its validator import plus the colocated dependency-free evaluator required by R01.

## Scope Isolation

GitHub was inspected first. Open [PR #250](https://github.com/mryfmo/ai-ops-platform/pull/250) changes orchestration task/review/handoff artifacts only; no PR #250 file is included in this task commit. [PR #251](https://github.com/mryfmo/ai-ops-platform/pull/251) checks and the failed build-test log were inspected for R01. Existing workspace changes and untracked local stores/references remain unstaged.

## Callback

- Commands and results: `.orchestration/validation/P8-T02-VALIDATION.md`
- Changed paths: guard/action/test, one `package.json` test-list entry, the P8-T01 validator import/test plus dependency-free evaluator, and P8-T02 evidence only
- Branch: `agent/P8-T02-path-boundary-guard`
- Pull request: orchestrator-owned after AGMSG result; non-draft, no auto-merge
- Dependency changes: none
- Security findings: ignore-rule evasion and snapshot-tampering/self-modification paths were found during self-review and closed by hashing ignored paths, HMAC-authenticating the snapshot, and hard-forbidding guard sources
- Unresolved decisions: live runner wiring and OS sandbox enforcement remain P8-T04/T05 scope
- [memory:decision] Treat ignored paths as worktree state, not as trusted exclusions: otherwise an agent can change `.gitignore` and hide an outside/forbidden write from the post guard.
- [memory:failure] Root governance runs before the independent contracts install. Any manifest-validation code reachable from governance must use only checked-in files and the Node.js standard library; local `contracts/node_modules` can mask this clean-runner failure.
- CompactionDB recording was unavailable because `.claude/hooks/contextdb_cli.py` is absent in this checkout; the decision is retained above.
