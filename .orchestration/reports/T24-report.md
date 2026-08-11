# T24 Report: G3 data health

## Summary

- A-11 fixed with a minimal in-repo SQL migration runner: `schema_migrations`, ordered `packages/devops/src/db/migrations/*.sql`, and `pnpm --filter @aiops/devops db:migrate`.
- Chose not to add `node-pg-migrate`: the repo already has `pg`, the needed behavior is ordered SQL + version recording, and avoiding another dependency keeps the data path smaller.
- Existing `schema.sql` now represents the latest fresh-database shape; existing-DB ALTERs moved to migration files with rollback comments.
- NOT VALID constraints have a dedicated validation migration with lock-impact notes.
- A-11b fixed by adding configurable pool max, connection timeout, statement timeout, and idle-in-transaction timeout.
- T23 carry-over nit fixed: claim transaction rollback/release paths are tested, and rollback failure releases the client with an error.
- T24 revise fixed: migrations now use one connected client for BEGIN/DDL/schema_migrations/COMMIT, take a transaction-scoped advisory lock, and release the client.
- T24 revise fixed: db-migration instructions no longer tell workers to add inline ALTERs to `schema.sql`.

## Finding Map

| Audit finding | Status | Evidence |
| --- | --- | --- |
| A-11 migration basis | fixed | `packages/devops/src/db/migrate.ts`, `packages/devops/src/db/migrations/*.sql`, `packages/devops/tests/migrate.test.ts`. |
| A-11 NOT VALID validation | fixed | `202607100006_validate_constraints.sql` validates migrated constraints and documents lock impact. |
| A-11b pool settings | fixed | `packages/server/src/config.ts`, `packages/server/src/db/pool.ts`, `packages/server/tests/pool.test.ts`, `packages/server/tests/config.test.ts`. |
| T23 rollback/release nit | fixed | `packages/server/tests/eventsRepo.test.ts` covers UPDATE failure rollback/release and rollback failure poison release. |
| T24-R1 pool.query transaction overclaim | fixed | `applyMigrations` now uses `pool.connect()` and runs all migration queries through that client; tests fail if `pool.query` is used. |
| T24-R2 stale schema instructions | fixed | `.claude/skills/db-migration/SKILL.md` and `AGENTS.md` direct future ALTERs to `migrations/*.sql`; `schema.sql` remains fresh-DB shape only. |
| T24-R3 concurrent migrate lock | fixed | `applyMigrations` takes `pg_advisory_xact_lock` before reading/appling versions. |
| T24-R4 packaging/comments | fixed | `tsx` is declared in `@aiops/devops` devDependencies; source-checkout migration premise is documented; 002/003 comments use the file date. |

## Notes

- No new package added. `tsx` was already in the workspace lockfile and is now declared by `@aiops/devops` because `db:migrate` runs the source script.
- No destructive migration is executed by default; rollback DDL is documented in SQL comments for reviewed manual use.
- Migration application is manual, not automatic at server startup.

## PR

- Branch: `agent/T24`
- Base: `agent/T23`
- Commits: `f92f1b8`, `257e58c`
- URL: https://github.com/mryfmo/ai-ops-platform/pull/19
