# Database Migrations

## Purpose

Use `schema_migrations` plus ordered SQL files under `packages/devops/src/db/migrations/` to upgrade existing PostgreSQL databases without rewriting audit history or dropping data.

The migration command is source-checkout oriented: it runs `tsx src/db/migrate.ts` inside `@aiops/devops` and reads SQL from `packages/devops/src/db/migrations/`. It is not run automatically from the compiled server.

## New Database

1. Set `DATABASE_URL`.
2. Apply the latest base schema:

```sh
psql "$DATABASE_URL" -f packages/devops/src/db/schema.sql
```

3. Mark and apply ordered migrations:

```sh
pnpm --filter @aiops/devops db:migrate
```

## Existing Database

Run only the migration command:

```sh
pnpm --filter @aiops/devops db:migrate
```

Each migration runs in a transaction and records its version in `schema_migrations`. Re-running skips already applied versions.
Because a migration run is one transaction, do not use transaction-incompatible DDL such as `CREATE INDEX CONCURRENTLY`; use a separate reviewed operation when that is required.

Before `202607110000_audit_log_partitions.sql`, take a backup/PITR checkpoint and record a tested restore target. The migration requires every existing row to have a reviewed `prjops_5y` or `devops_1y` classification, compares row counts and content in both directions, and only then removes the old table. Any missing/invalid classification or copy mismatch aborts the transaction without renaming or changing the original table.

For a non-empty legacy table without `retention_class`, stop and preclassify it. Do not infer retention from actor, action, age, or source system. After an owner reviews a complete `(at, log_id, retention_class)` mapping, apply it during the approved maintenance transaction:

```sql
ALTER TABLE audit_log ADD COLUMN retention_class TEXT;
-- Load the approved mapping into reviewed_audit_retention(at, log_id, retention_class), then:
UPDATE audit_log a
SET retention_class = r.retention_class
FROM reviewed_audit_retention r
WHERE (a.at, a.log_id) = (r.at, r.log_id);
ALTER TABLE audit_log ALTER COLUMN retention_class SET NOT NULL;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_retention_class_check
  CHECK (retention_class IN ('prjops_5y', 'devops_1y'));
```

Before migration, verify the reviewed mapping and `audit_log` have identical row counts and that a left join in both directions returns zero rows. Preserve the review approval and mapping with the migration evidence.

The migration creates each classified legacy row's UTC monthly partition before copying. Historical rows therefore remain eligible for the class-specific retention dry-run instead of accumulating in a DEFAULT partition.

## Constraint Validation

`202607100006_validate_constraints.sql` validates previously `NOT VALID` constraints. Run it during a low-traffic window because PostgreSQL may take locks while checking existing rows.

## Rollback

Rollback DDL is documented in each migration file. Do not run rollback statements blindly in production; take a backup/PITR checkpoint first and review data-loss impact.

After this audit migration has committed, rollback means restoring the checkpoint into a separate database and verifying audit counts/content before cutover. Do not merge retention classes back into an unpartitioned production table in place.
