# P7-T02 Identity / Thread / Workflow Mapping Report

## Outcome

Implemented the PostgreSQL mapping authority for channel address → conversation/thread/workflow. A mapping is immutable and bound to its initiating provider, tenant, and subject; lookup requires the full address and identity tuple and returns `null` for both mismatch and absence.

## Contract

- `channel_conversation_mappings` is the sole channel-address mapping authority and references an existing `workflow_runs.workflow_id`.
- Address uniqueness uses `UNIQUE NULLS NOT DISTINCT (source, platform_conversation_id, platform_thread_id)`, so root-thread `NULL` addresses also have one stable mapping.
- Registration is insert-once. An exact replay is reconciled read-only; a changed identity or workflow receives only a fixed conflict error.
- Public lookup has no workflow-ID-only method and predicates source, conversation, thread, provider, tenant, and subject in the SQL acquisition query.
- `ConversationMappingAuthority.lookup` now requires user identity, and the channel boundary rechecks the returned mapping identity before creating an AG-UI run request.
- Existing `channel_messages` remains the message authority. It gains `source` plus unique `(source,message_id)` dedupe; the existing Teams content-mirror role is not duplicated.
- `events` remains a retry-queue authority and `id_mappings` remains a SoR mapping authority.
- No runtime dependency, mutable channel state, workflow-direct API, or credential was added.

[memory:decision] Channel workflow resolution must be acquired by exact address+provider+tenant+subject predicates and return the same null for mismatch and absence. Source-message dedupe remains separate on the existing message authority. Apply to P7-T03/P7-T09 and future channel adapters.

## CompactionDB

The project memory CLI `.claude/hooks/contextdb_cli.py` is absent, so no project memory mutation was possible. The reusable decision is recorded in the learning artifact and Codex learn index instead.

## Handoff

- Branch: `agent/P7-T02-identity-thread-mapping`
- The orchestrator performs push and PR creation after `AGMSG-RESULT`.
