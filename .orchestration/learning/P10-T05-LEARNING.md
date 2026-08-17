# P10-T05 Learning Triage

Date: 2026-08-17

## Candidates

[memory:failure] A rollback implemented as a second protected-Environment job
can itself wait for approval after the failed production job. Keep automatic
rollback inside the already-approved production job; split it only when the
platform can guarantee approval-free emergency rollback with equivalent audit.

[memory:failure] ECS `PRE_PRODUCTION_TRAFFIC_SHIFT` PAUSE runs once, not at every
LINEAR increment. Continue it once, then observe the platform's automatic baked
increments; use a different deployment mechanism if every gate must be manually
held.

[memory:decision] Treat local structural proof separately from REL-003: real
target groups, alarms, traffic, AWS CLI/API support, and measured terminal
rollback remain environment evidence.

## Disposition

- Both candidates are encoded in the workflow validator and runbook.
- No skill mutation or promotion was authorized; this task artifact and the
  Codex learn index carry the reusable decision forward.
