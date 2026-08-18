# ADV-FIX-01 Report

- Status: ready for review
- PR: https://github.com/mryfmo/ai-ops-platform/pull/271
- Branch: `agent/ADV-FIX-01`
- Base: `9eb56aa8a80faa42bcf350dce26aebb7590f9641`
- Code commit: `9b03375c3565c6daad5c1496618e4e2a87f53946`
- cost: n/a

## Outcome

- C-2: removed stale `content-encoding`, `content-length`, and `transfer-encoding` from already-decoded WebUI upstream responses.
- H-1: granted UPDATE on `agent_handoffs` and added a static server-repo UPDATE-to-grant parity test.
- M-1: added GitHub fine-grained PAT, Slack, URL credentials, OpenAI, GCP, and Azure SAS patterns with positive and boundary-negative tests.
- M-2: sanitized attacker-controlled GitHub event headers, Graph subscription IDs, and event-dispatch error messages before audit append. Event errors use the same sanitized value for structured logging.
- M-3: the Sev1 Teams card now consumes the same `safeRationale` as the Issue path.

## Boundaries

- No dependencies, schema, migrations, gates, permission model, or out-of-scope product behavior changed.
- The orchestrator amended the relocated event task path to `packages/server/src/scheduler/tasks/eventsPollingTask.ts` before it was edited.
- PR #271 is non-draft, labeled `ai-generated`, and remains unmerged.

## CompactionDB

- Requested command: `python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project`
- Not executed: `.claude/hooks/contextdb_cli.py` is not present on this branch. The orchestrator explicitly waived worker execution and will consolidate the decision at acceptance; install/cherry-pick was forbidden.
- [memory:decision] Audit-bound attacker text must be sanitized before append so E-AUD02 cannot erase the attack record; production DB role grants must stay mechanically aligned with repository UPDATE statements.
