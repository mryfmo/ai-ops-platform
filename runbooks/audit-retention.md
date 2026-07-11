# Audit Retention

`audit_log` separates `prjops_5y` and `devops_1y` before monthly range partitioning. New records outside the prepared current/next month partitions go to the matching `_default` quarantine partition, so records are not silently lost.

## Monthly preparation

Run before each month starts; the function is idempotent:

```sql
SELECT ensure_audit_log_partition('prjops_5y', DATE '2026-08-01');
SELECT ensure_audit_log_partition('devops_1y', DATE '2026-08-01');
```

Partition bounds are always UTC midnight instants; the PostgreSQL session `TimeZone` does not change them.

If creation fails because the default partition contains rows in that month, PostgreSQL leaves the partition and quarantine rows unchanged. Confirm the rows remain in the matching `_default` partition, then review and move them in a separate approved transaction before retrying.

## Retention dry-run

This only lists eligible historical partitions; it never drops one:

```sql
SELECT * FROM audit_retention_candidates();
```

With no argument, the cutoff date is derived in UTC regardless of session `TimeZone`. Returned partition identifiers are schema-qualified; use the exact reviewed identifier rather than reconstructing it from a bare table name.

Confirm the class, month, backup/PITR checkpoint, and tested restore target. Current and future partitions are never candidates. A DBA may then execute a separately reviewed `DROP TABLE <exact_partition_name>` during the approved maintenance window. Never automate that DROP from application credentials.

The application role receives only parent-table `INSERT`/`SELECT` plus sequence usage. Verify after role or ownership changes:

```sql
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_role' AND table_name = 'audit_log';
```
