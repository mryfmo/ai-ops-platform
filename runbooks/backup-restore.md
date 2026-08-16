<!-- 根拠: FinalArch:PRD-010 / FinalArch:FR-OBS-005 / ADR-0029 / REL-001 / P10-T04 -->

# RDS PostgreSQL backup and restore

## Status and boundary

Terraform defines the controls and this runbook defines the rehearsal. P10-T04 validates both locally and with a loopback Floci plan only. A real AWS restore, measured RPO/RTO, and production cutover are **deferred** until an approved environment gate supplies the account, identifiers, operator role, maintenance window, and evidence destination. Do not claim `REL-001` or restore acceptance from `terraform validate`, Floci, or the disposable PostgreSQL test.

The accepted AWS baseline is:

- RDS automated backups retained for 35 days for same-region PITR;
- production RDS snapshots and transaction logs replicated continuously to
  `ap-northeast-3` with 35-day retention for regional recovery;
- a daily AWS Backup recovery point and production copy retained for 35 days;
- production copy action to a reviewed `ap-northeast-3` backup vault;
- `rds.force_ssl=1`, private subnets, no public endpoint, and encrypted RDS storage;
- same-region targets of RPO ≤ 5 minutes and RTO ≤ 60 minutes.

Whole-instance backups contain shorter-retention Plane data and therefore expire
after 35 days. Five-year audit/report retention must use the governed long-term
archive rather than full RDS snapshots. Audit partitions remain governed by
[audit-retention.md](audit-retention.md).

## Preconditions and STOP conditions

Record the incident/change ID, source DB identifier, restore point UTC, expected audit counts, source commit, operator, validator, and start time. Use an AWS operator role approved for RDS/Backup restore; never use an application database credential.

Stop before any AWS command if:

- the approved account/region is not independently confirmed;
- the target identifier already exists or equals the source identifier;
- the subnet group, security groups, parameter group, or encryption key is not the reviewed environment value;
- the selected recovery point is outside the required time or has an incomplete copy job;
- an instruction would update, delete, reboot, or replace the source instance.

All examples use placeholders. Keep `AWS_REGION=ap-northeast-1`, disable pagers, and capture command output in the approved evidence store without credentials, secret values, connection strings, or row content.

## Backup verification

1. Confirm Terraform state shows `backup_retention_period = 35`, the P10-T04 parameter group, AWS Backup plan, vault, selection, and—production only—the Osaka copy action.
2. Confirm the RDS instance has a non-null latest restorable time and that it advances.
3. For production, resolve the emitted Osaka replicated-backup ARN, confirm its
   status is `active`, its latest restorable time is within 60 minutes, and its
   KMS key is enabled.
4. Confirm the latest AWS Backup job and production copy job for the exact source
   RDS ARN completed successfully.
5. Confirm the chosen recovery point is `AVAILABLE`, encrypted, and expires no later than 35 days after creation.
6. Record timestamps and identifiers only; do not export database content.

```bash
export AWS_REGION=ap-northeast-1
export AWS_PAGER=""

aws rds describe-db-instances \
  --db-instance-identifier REPLACE_SOURCE_DB \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Earliest:EarliestRestorableTime,Latest:LatestRestorableTime,Encrypted:StorageEncrypted,Public:PubliclyAccessible,Retention:BackupRetentionPeriod}'

aws backup list-backup-jobs \
  --by-resource-arn REPLACE_SOURCE_DB_ARN \
  --by-state COMPLETED \
  --max-results 20

aws backup list-copy-jobs \
  --by-resource-arn REPLACE_SOURCE_DB_ARN \
  --by-destination-vault-arn REPLACE_OSAKA_BACKUP_VAULT_ARN \
  --by-state COMPLETED \
  --max-results 20

aws rds describe-db-instance-automated-backups \
  --region ap-northeast-3 \
  --db-instance-automated-backups-arn REPLACE_EMITTED_REPLICATED_BACKUP_ARN \
  --query 'DBInstanceAutomatedBackups[0].{Status:Status,Latest:RestoreWindow.LatestTime,Encrypted:Encrypted}'
```

## Same-region snapshot or AWS Backup restore

Select either a native RDS snapshot or the AWS Backup recovery point required by the approved exercise. Every restore creates a new isolated DB instance; the source is never restored in place.

For an RDS snapshot:

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier REPLACE_ISOLATED_TARGET \
  --db-snapshot-identifier REPLACE_SNAPSHOT_IDENTIFIER \
  --db-subnet-group-name REPLACE_PRIVATE_SUBNET_GROUP \
  --vpc-security-group-ids REPLACE_RESTORE_VALIDATOR_SECURITY_GROUP \
  --db-parameter-group-name REPLACE_P10_T04_PARAMETER_GROUP \
  --no-publicly-accessible \
  --enable-iam-database-authentication \
  --deletion-protection
```

For an AWS Backup recovery point, obtain the service-generated metadata and review it before starting the job. Set a new DB identifier and the same private network/parameter constraints in the reviewed metadata; do not reuse metadata that names the source as a target.

```bash
aws backup get-recovery-point-restore-metadata \
  --backup-vault-name REPLACE_SOURCE_VAULT \
  --recovery-point-arn REPLACE_RECOVERY_POINT_ARN

aws backup start-restore-job \
  --recovery-point-arn REPLACE_RECOVERY_POINT_ARN \
  --iam-role-arn REPLACE_APPROVED_RESTORE_ROLE_ARN \
  --metadata file://REPLACE_REVIEWED_RESTORE_METADATA_JSON \
  --idempotency-token REPLACE_CHANGE_ID
```

Wait for `available`/`COMPLETED`, record elapsed time, then confirm the target remains private and attached only to the validator security group.

## Same-region PITR

Choose a UTC restore time after the earliest and no later than the latest restorable time reported above. Do not use `--use-latest-restorable-time` for an incident exercise unless the approved objective explicitly calls for it.

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier REPLACE_SOURCE_DB \
  --target-db-instance-identifier REPLACE_ISOLATED_TARGET \
  --restore-time REPLACE_UTC_TIMESTAMP \
  --db-subnet-group-name REPLACE_PRIVATE_SUBNET_GROUP \
  --vpc-security-group-ids REPLACE_RESTORE_VALIDATOR_SECURITY_GROUP \
  --db-parameter-group-name REPLACE_P10_T04_PARAMETER_GROUP \
  --no-publicly-accessible \
  --enable-iam-database-authentication \
  --deletion-protection
```

## Validate the isolated target

Connect only through the approved private validator path. The validator is separate from the restore operator.

1. Confirm PostgreSQL version, SSL, database names (`aiops`, `litellm`, `temporal`, `temporal_visibility`), schemas, and the expected non-owner runtime roles.
2. Compare pre-recorded row counts and latest timestamps for workflow state, deployment state, receipts, and every audit retention class. Never include row content in evidence.
3. Run application migration status/readiness in read-only validation mode.
4. Prove `app_role` has no `UPDATE`, `DELETE`, or `TRUNCATE` privilege on any `audit_log` partition and that a real UPDATE statement is rejected. Run the failed mutation in its own session; do not grant temporary write privilege to make the check pass.
5. Validate Temporal workflow histories and LiteLLM metadata against their service-specific smoke criteria without sending production traffic.
6. Record `recovery point → target available → validation complete` timestamps and calculate observed RPO/RTO.

Representative privilege query:

```sql
SELECT c.oid::regclass AS relation,
       has_table_privilege('app_role', c.oid, 'UPDATE') AS can_update,
       has_table_privilege('app_role', c.oid, 'DELETE') AS can_delete,
       has_table_privilege('app_role', c.oid, 'TRUNCATE') AS can_truncate
FROM pg_partition_tree('app.audit_log') AS p
JOIN pg_class AS c ON c.oid = p.relid
ORDER BY relation::text;
```

The exercise fails if any mutation privilege is true, the actual UPDATE succeeds,
counts/timestamps violate the approved recovery point, the endpoint is public,
the Osaka replicated latest-restorable time is more than 60 minutes old, or an
RPO/RTO target is missed without an Owner exception.

## Cutover, rollback, and cleanup

Cut over only after Security/Ops approval of the evidence. Freeze writes before
switching the database connection. Adopt the restored instance into the reviewed
Terraform state/configuration (or repoint the existing backup resources explicitly)
and require a reviewed plan with no unintended source or target destruction. Before
resuming writes, prove the restored ARN has 35-day PITR, is selected by the AWS
Backup plan, and is the source of the healthy Osaka automated-backup replication.
Then populate a **new** version of the environment's connection secret, deploy one
immutable application revision against the restored target, and run bounded smoke
checks. Unfreeze writes only when the restored target is accepted as the new source
of truth and all three backup controls protect it.

Rollback to the prior source is permitted only while writes remain frozen and no
post-cutover write exists. After writes resume, stop and use a separately reviewed,
tested reconciliation plan; never silently discard or copy rows backward ad hoc.
For an exercise that never cut over, after its observation window and explicit
deletion approval, remove deletion protection and delete the exact disposable
target **without** a final snapshot. Never delete a promoted target through exercise
cleanup. Decommission the old source only through a separate approved change after
the promoted target's backups, replication, and observation window are accepted.
Preserve the restore job, validation result, RPO/RTO, approvals, and cleanup
evidence for P10-T08/REL-006.
