# P10-T05 Learning Triage

Date: 2026-08-17

## Candidates

[memory:failure] A rollback implemented as a second protected-Environment job
can itself wait for approval after the failed production job. Keep automatic
rollback inside the already-approved production job; split it only when the
platform can guarantee approval-free emergency rollback with equivalent audit.

[memory:decision] ECS native linear deployment with a pre-production pause hook
provides the smallest platform-native 0/10/50/100 rollout skeleton. Treat local
structural proof separately from REL-003: real target groups, alarms, traffic,
AWS CLI/API support, and measured rollback remain environment evidence.

## Disposition

- Both candidates are encoded in the workflow validator and runbook.
- No skill mutation or promotion was authorized; this task artifact and the
  Codex learn index carry the reusable decision forward.
