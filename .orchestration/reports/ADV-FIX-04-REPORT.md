# ADV-FIX-04 Report

## Outcome

Implemented the production manifest authority path from coding-task creation through immutable persistence, workflow dispatch, coding-agent pre/post enforcement, and independent-review digest verification.

- Authority is the exact UTF-8 `coding_tasks.manifest` text plus `sha256(raw UTF-8 bytes)` in `manifest_sha256`.
- Server creation uses a closed, conservative production template; repository insertion persists both values atomically.
- Confirmation revalidates bytes, digest, task ID, agent, and the complete fixed profile before claiming or dispatching the task.
- Coding workflow receives base64-encoded exact bytes plus digest, restores them under `RUNNER_TEMP`, validates the real contract, fixes a masked random HMAC key, and runs the path guard before credentials and after the agent.
- Commit, GitHub credential issue, push, and PR creation remain downstream of successful post-guard verification.
- Independent review requires `manifest_digest`; missing/mismatched authority writes a critical machine finding, exits nonzero, and still uploads the artifact.

## Decisions

[memory:decision] The server runtime image cannot import the repository-root `contracts/` workspace. The issuer therefore uses a server-local validator that accepts only the reviewed fixed template, while `codingTaskManifest.test.ts` parses the exact emitted bytes and runs the real `contracts/agent-task` `validateAgentTaskManifest()` against them. This dual-validator parity test prevents contract drift without adding a runtime dependency.

[memory:decision] Workflow dispatch carries manifest bytes as base64 plus raw-byte SHA-256. The generated manifest is well below the GitHub workflow-dispatch input limit, so a ledger fetch endpoint was not added. Base64 preserves the issuer bytes without canonicalization or newline loss.

[memory:decision] Existing pre-authority rows are migrated to the exact sentinel bytes `{}\n` and their valid raw digest. The production validator rejects the sentinel, so historical tasks fail closed rather than receiving fabricated authority.

[memory:decision] The coding workflow checks out `github.sha` and permits only the current production `base_ref=main` path. A trusted guard/validator bundle is copied before agent execution and its aggregate digest is rechecked immediately before post-guard execution.

## Database

- Added `manifest TEXT NOT NULL` and `manifest_sha256 TEXT NOT NULL` with lowercase hex-64 CHECK.
- Added a BEFORE UPDATE trigger that rejects changes to either authority column while allowing normal lifecycle updates.
- Migration is safe for old rows, fresh-schema application, direct repeat application, and migration-runner replay.

## Contract evolution

- Agent-task and review-artifact `task_id` accept the existing symbolic task IDs or the owner-ruled exact lowercase UUID shape.
- Review workflow contract adds only the required `manifest_digest` string and pins its flow to the trusted collector environment.
- No existing validator, permission, checkout isolation, or branch-mutation check was relaxed.

## Validation summary

- Disposable PostgreSQL fresh schema and `origin/main` schema plus migration produced the same non-null columns and trigger.
- Real PostgreSQL repository test passed; lifecycle update succeeded and both manifest update attempts were rejected.
- Server package: 93 files / 983 tests passed with real PostgreSQL.
- Contracts: 88 tests passed.
- Path guard: 17 positive/adversarial tests passed.
- Final `mise run ci`: exit 0, including coverage and database integration.

## Residual operational evidence

The workflow structure and local trust-boundary behavior are verified. A live GitHub Actions dispatch with the real credential issuer remains a go-live environment conformance check; no production credential or external write was used here.

cost: local-only validation; no paid model/API call or production infrastructure mutation.

CompactionDB: standard worker waiver; acceptance-time consolidation is delegated to the orchestrator.
