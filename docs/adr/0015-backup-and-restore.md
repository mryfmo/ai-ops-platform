# ADR-0015: PostgreSQL Backup and Restore

## Status

Proposed

## Context

The PostgreSQL database contains operational state and append-only audit records. The audit policy requires PrjOps records to remain available for five years, but the repository does not yet define a backup technology, recovery objectives, or a tested restore procedure. The deployment platform is also undecided.

## Options

### Managed database automatic backups and PITR

- Uses the database provider's automated snapshots, continuous log archive, encryption, monitoring, and point-in-time recovery controls.
- Reduces maintenance of backup infrastructure and commonly provides a provider-supported restore workflow.
- Couples recovery capabilities, retention limits, regions, export options, and cost to the selected provider and service tier.
- Still requires independent restore exercises and evidence that five-year audit retention survives backup expiry, service migration, and account loss.

### Self-managed pgBackRest

- Provides full, differential, and incremental PostgreSQL backups plus WAL archiving and point-in-time recovery across supported object stores.
- Gives operators direct control over schedules, repositories, encryption, retention, and restore commands.
- Adds responsibility for repository hardening, credentials, capacity, monitoring, upgrades, retention correctness, and regular restore testing.
- Requires an independently operated backup destination so a database-host failure cannot remove both the database and its backups.

## Decision

`TBD(HUMAN)`: choose managed automatic backup plus PITR or self-managed pgBackRest after the deployment platform, recovery objectives, compliance retention, regional redundancy, and operating ownership are agreed.

The following values also remain `TBD(HUMAN)`: RPO, RTO, backup and WAL retention, archive retention for five-year audit evidence, encryption and key ownership, backup region/account, restore-exercise frequency, and the approving owner.

## Consequences

No production backup or restore configuration is authorized by this Proposed ADR. After the human decision, this ADR and `runbooks/backup-restore.md` must be updated together, and the selected controls must be validated with a recorded restore exercise.
