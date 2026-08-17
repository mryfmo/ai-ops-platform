# P7-T03 Mention / Subscribed-Thread Flow Report

## Outcome

Implemented a deterministic, stateless Teams conversation-flow contract inside `packages/channel-teams`. The pure decision consumes a normalized inbound message, the identity-scoped P7-T02 mapping result, and the configured bot platform ID; it returns only `start`, `follow_up`, `ignore`, or a fixed recoverable `error_report`.

## Decision Matrix

- Bot, application, and self-originated activities are ignored before mention or mapping evaluation.
- A human reply with an authoritative mapping is a `follow_up`; the existing `buildAgUiRunRequest` revalidates address plus provider/tenant/subject and reuses its conversation, thread, and workflow IDs.
- A human root or reply without a mapping is `start` only when exactly one structured mention targets the configured bot ID. No bot mention or duplicate bot targets are silent `ignore`.
- A root activity with an already-present mapping is the sole integrity anomaly and becomes fixed `E-CHANNEL-MAPPING-MISMATCH` `error_report`.
- A tenantless start or invalid normalized platform identifier becomes fixed `E-CHANNEL-INVALID-INPUT` `error_report`.

## Mention and Loop Boundary

- Teams mention entities are structurally parsed from `entities[].mentioned.id`; display name and message text are never authorities.
- Malformed/empty entity records are preserved as an invalid normalized mention marker. Machine/self senders are ignored before that marker is evaluated; human senders receive the existing non-reflective recoverable input error.
- One bot mention remains valid with additional human mentions. Two or more bot-target entities are ignored rather than starting twice.
- Human sender identity remains Entra `aadObjectId`; Bot Framework `bot`/`skill` and compatible `application` messages may normalize with their platform sender ID solely so the pure flow can ignore them, even when their mention entities are malformed. No mapping or AG-UI request is emitted for machine senders.

## State and Scope

- The start decision emits only an immutable mapping-registration request containing address, initiating identity, and source message reference. It does not allocate a workflow, persist state, or expose a lookup method.
- Source/message dedupe and identity-scoped mapping remain the existing P7-T02 authorities; no parallel state, dependency, schema, server wiring, or credential was added.
- PR #255/#256/#257 files were not touched.

[memory:decision] Teams flow must ignore bot/app/self first, use structured target IDs rather than display text, follow up only through the identity-scoped mapping, silently ignore unmentioned unmapped threads, and treat exactly one bot mention as an explicit start/subscription request.

## Deferred Gate

UX-001 real Teams sandbox mention/thread E2E remains deferred until tenant access exists, as required by the task. This task supplies deterministic unit/contract evidence only.

## CompactionDB

The project memory CLI `.claude/hooks/contextdb_cli.py` is absent. The reusable decision is recorded in the learning artifact and Codex learn index candidate flow instead; no project memory mutation was attempted.

## Handoff

- Branch: `agent/P7-T03-mention-thread-flow`
- Orchestrator owns push and non-draft PR creation after `AGMSG-RESULT`.
