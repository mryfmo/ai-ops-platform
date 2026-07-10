/**
 * packages/devops/src/db/migrate.ts
 *
 * 根拠: A-11。schema_migrationsで順序適用済みDDLを記録する最小マイグレーション基盤。
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import type { PgQueryable } from "@aiops/shared";

export interface SqlMigration {
  version: string;
  name: string;
  sql: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export function loadSqlMigrations(dir = new URL("./migrations", import.meta.url).pathname): SqlMigration[] {
  return readdirSync(dir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort()
    .map((file) => {
      const version = file.slice(0, file.indexOf("_"));
      return { version, name: basename(file), sql: readFileSync(join(dir, file), "utf8") };
    });
}

export async function applyMigrations(db: PgQueryable, migrations: SqlMigration[]): Promise<MigrationResult> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    TEXT PRIMARY KEY,
       name       TEXT NOT NULL,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const appliedRows = await db.query("SELECT version FROM schema_migrations");
  const appliedVersions = new Set(appliedRows.rows.map((row) => String(row.version)));
  const result: MigrationResult = { applied: [], skipped: [] };

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      result.skipped.push(migration.version);
      continue;
    }
    await db.query("BEGIN");
    try {
      await db.query(migration.sql);
      await db.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [
        migration.version,
        migration.name,
      ]);
      await db.query("COMMIT");
      result.applied.push(migration.version);
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await applyMigrations(pool, loadSqlMigrations());
    console.log(`migrations applied=${result.applied.length} skipped=${result.skipped.length}`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
