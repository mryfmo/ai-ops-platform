/**
 * packages/devops/src/db/migrate.ts
 *
 * 根拠: DevOps:SPEC-INT-050（events/deployments/incidents/grants 等のテーブル定義）/ ADR-0003
 *   （DevOps は常駐サービスとして稼働し、状態はすべて PostgreSQL に置く）。
 *   schema.sql は fresh-DB 用の最新形、既存DBへの差分適用は migrations/NNN_*.sql を版順に適用する
 *   （AGENTS.md「schema.sql 変更手順」）。本ファイルは適用済み版を schema_migrations に記録し、
 *   advisory lock ＋ 単一トランザクションで順序適用する最小マイグレーション基盤。
 *
 * 変更前の根拠は `A-11` のみだった。`A-NN` はリポジトリ内で作業項目ラベルとして 8 箇所ほど
 * 一貫して使われているが、その定義はどこにも無い（docs/ runbooks/ verification/ に記述なし）。
 * 読み手が指示対象を解決できないため、根拠としては仕様IDを併記する。ラベル自体は履歴として残す
 * （`A-11`: schema_migrations の導入時タスク）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import type { PgQueryable } from "@aiops/shared";

const { Pool } = pg;

export interface SqlMigration {
  version: string;
  name: string;
  sql: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

interface PgMigrationClient extends PgQueryable {
  release(err?: Error): void;
}

interface PgMigrationPool {
  connect(): Promise<PgMigrationClient>;
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function applyMigrations(pool: PgMigrationPool, migrations: SqlMigration[]): Promise<MigrationResult> {
  const client = await pool.connect();
  let released = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [240024]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version    TEXT PRIMARY KEY,
         name       TEXT NOT NULL,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    const appliedRows = await client.query("SELECT version FROM schema_migrations");
    const appliedVersions = new Set(appliedRows.rows.map((row) => String(row.version)));
    const result: MigrationResult = { applied: [], skipped: [] };

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        result.skipped.push(migration.version);
        continue;
      }
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [
        migration.version,
        migration.name,
      ]);
      result.applied.push(migration.version);
    }

    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      const releaseError = toError(rollbackError);
      client.release(releaseError);
      released = true;
      throw releaseError;
    }
    throw error;
  } finally {
    if (!released) client.release();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await applyMigrations(pool, loadSqlMigrations());
    process.stdout.write(`migrations applied=${result.applied.length} skipped=${result.skipped.length}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
