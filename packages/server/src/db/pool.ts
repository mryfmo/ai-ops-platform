/**
 * packages/server/src/db/pool.ts
 *
 * 根拠: ADR-0005（常駐サーバはDevOps正本DB PostgreSQLを共有する）
 */
import pg from "pg";

export interface DbPoolOptions {
  max: number;
  connectionTimeoutMillis: number;
  statementTimeoutMs: number;
  idleInTransactionSessionTimeoutMs: number;
}

type PoolConfigWithTimeouts = pg.PoolConfig & {
  statement_timeout: number;
  idle_in_transaction_session_timeout: number;
};

export function buildPoolConfig(databaseUrl: string, options: DbPoolOptions): PoolConfigWithTimeouts {
  return {
    connectionString: databaseUrl,
    max: options.max,
    connectionTimeoutMillis: options.connectionTimeoutMillis,
    statement_timeout: options.statementTimeoutMs,
    idle_in_transaction_session_timeout: options.idleInTransactionSessionTimeoutMs,
  };
}

export function createPool(databaseUrl: string, options: DbPoolOptions): pg.Pool {
  return new pg.Pool(buildPoolConfig(databaseUrl, options));
}

export type { Pool } from "pg";
