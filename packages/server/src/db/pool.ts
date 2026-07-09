/**
 * packages/server/src/db/pool.ts
 *
 * 根拠: ADR-0005（常駐サーバはDevOps正本DB PostgreSQLを共有する）
 */
import pg from "pg";

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl });
}

export type { Pool } from "pg";
