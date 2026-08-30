# JIRA-INT-01 Report

- status: ready_for_review
- branch: `agent/JIRA-INT-01`
- commit: `d199b16fc092e122f2e91734e9091b8f09b64e69`
- cost: n/a
- push/PR: not performed

## Result

Imported the task-listed Jira × GitHub governed integration pack onto `agent/ADV-FIX-04`, retained the ADV-FIX-04 manifest columns and immutable-manifest trigger, and added only `jira` to the fresh-schema `events.source` constraint. The commit contains 36 allowed files, no dependency/lock/workflow-governance changes, and no tracked deletions.

Repository compatibility fixes kept the diff bounded: native Web Crypto replaces the forbidden `node:crypto` import, Jira webhook normalization awaits the async hash, traceability headers identify ADR-0030, the canonical Temporal queue expectation includes internal queues, and direct Jira parser tests restore coverage without lowering thresholds.

## Durable facts

- [memory:decision] Jira remains the operational Work Item authority; GitHub remains the development and formal-record authority; ai-ops-platform remains the authorization, approval, idempotency, audit, and reconcile authority.
- [memory:decision] `jiraSync.ts` is an internal Temporal workflow and is excluded from V8 coverage like the repository's other sandbox-only workflows. Contract and state parsers are directly tested.
- [memory:failure] The source pack omitted the Temporal coverage exclusion and recorded-history replay for `jiraSync.ts`. The exclusion was authorized by AGMSG-ANSWER; a Jira recorded-history replay test remains a follow-up candidate.

## Validation

- `mise run ci`: green, including coverage and PostgreSQL schema/migration verification.
- `pnpm run jira-mapping:validate`: 6/6 tests green; 2 mappings validated.
- `pnpm run governance:check`: 40/40 governance tests green plus Plane/Jira mapping validation.
- control-plane coverage: 362/362 tests green; statements 84.12%, branches 87.21%, functions 91.24%, lines 85.82%.
- `git diff --cached --check`: clean before commit.
- `make require-crit-review`: unavailable (`No rule to make target`). `crit status --json` reported no review file/session, so no browser review was opened.

Full command output is in `.orchestration/validation/JIRA-INT-01-validation.md`.

## CompactionDB

Project-local CLI recovery command:

```text
compactiondb-install . --skip-instructions
```

Required decision command:

```text
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content "JIRA-INT-01 imported the governed Jira x GitHub integration on agent/JIRA-INT-01 at d199b16; Jira remains operational work authority, GitHub development/formal-record authority, and ai-ops-platform authorization, approval, idempotency, audit, and reconcile authority. Temporal jiraSync.ts is excluded from V8 coverage as sandbox-only; a recorded-history replay test remains a follow-up candidate."
```

Result: `6800c8cb-5647-4540-b83c-c1fc23573f9e`.

The installer-created task-external `.gitignore`, hook, and settings files were restored/removed after the decision write; the pre-existing project context database containing the decision was retained.
