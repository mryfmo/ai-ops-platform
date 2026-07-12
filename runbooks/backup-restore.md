# PostgreSQL Backup and Restore Runbook

## Status and Preconditions

[ADR-0015](../docs/adr/0015-backup-and-restore.md) is Proposed. The backup technology is `TBD(HUMAN)`: managed automatic backup plus PITR or self-managed pgBackRest. Do not execute production backup or restore commands from this draft.

Before an exercise or incident restore, the approving human must record:

- selected technology and environment: `TBD(HUMAN)`;
- restore point, target environment, RPO, and RTO: `TBD(HUMAN)`;
- backup repository or provider recovery source: `TBD(HUMAN)`;
- encryption-key and credential owner: `TBD(HUMAN)`;
- restore approver and evidence location: `TBD(HUMAN)`.

Use an isolated recovery environment. Never overwrite the source database during an exercise.

## Restore Exercise Skeleton

1. Record the exercise ID, date, participants, source backup identifier, requested restore point, expected RPO/RTO, and change approval.
2. Confirm that the selected recovery source and required encryption keys are available without modifying production.
3. Provision an isolated target with the PostgreSQL version and extensions required by the application. The exact provisioning steps are `TBD(HUMAN)` after ADR-0015 is accepted.
4. Restore using the selected technology. Provider PITR or pgBackRest commands and credentials are `TBD(HUMAN)`.
5. Start the recovered database without application write traffic and capture restore start/end times and tool output.
6. Validate schema and migrations, application read access, append-only audit permissions, and the expected recovery timestamp.
7. Validate record counts and representative rows for operational tables and `audit_log`; reconcile them with pre-recorded evidence from the source.
8. Record achieved RPO/RTO, missing or inconsistent data, follow-up actions, and approver sign-off.
9. Destroy the isolated target and temporary credentials according to the approved data-handling policy. Exact destruction and evidence-retention steps are `TBD(HUMAN)`.

## Five-Year Audit Retention

PrjOps audit records must remain available for five years. Backup retention is not a substitute for queryable audit retention, and short-lived PITR windows must not silently shorten that obligation.

The accepted design must therefore document which live partitions or immutable archives cover the full five-year window, how backups protect them, and how expiry prevents premature deletion. If the selected backup service cannot retain recoverable evidence for five years, the separate immutable archive and its restore path are `TBD(HUMAN)`.

Every restore exercise must verify that all audit periods required at the restore date are present, readable, append-only for the application role, and traceable to retention evidence. Any retention gap blocks sign-off and requires incident handling before backup controls are considered effective.

## Incident Restore

Incident-specific cutover, write freeze, DNS or connection-string changes, application restart, and rollback are `TBD(HUMAN)` because they depend on the deployment platform and the accepted ADR. Require explicit change approval before any production mutation, and preserve all restore and validation evidence in the approved audit location.
