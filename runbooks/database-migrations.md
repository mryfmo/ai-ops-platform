# Database Migrations

## Purpose

Use `schema_migrations` plus ordered SQL files under `packages/devops/src/db/migrations/` to upgrade existing PostgreSQL databases without rewriting audit history or dropping data.

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

## Constraint Validation

`202607100006_validate_constraints.sql` validates previously `NOT VALID` constraints. Run it during a low-traffic window because PostgreSQL may take locks while checking existing rows.

## Rollback

Rollback DDL is documented in each migration file. Do not run rollback statements blindly in production; take a backup/PITR checkpoint first and review data-loss impact.
