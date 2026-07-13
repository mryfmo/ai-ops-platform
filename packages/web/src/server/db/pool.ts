/**
 * packages/web/src/server/db/pool.ts
 *
 * 根拠: ADR-0013 / REQ-041 / SPEC-INT-068 / AUD-REL-001。Next.js の HMR を
 * またいで PostgreSQL pool をプロセス単位で再利用し、route ごとの接続プール増殖を防ぐ。
 */
import pg from "pg";

interface GlobalPoolSlot {
  pool: pg.Pool;
  connectionString: string;
}

const globalForPool = globalThis as typeof globalThis & { __aiopsPgPool?: GlobalPoolSlot };

export function getPool(connectionString: string): pg.Pool {
  const current = globalForPool.__aiopsPgPool;
  if (current) {
    if (current.connectionString !== connectionString) {
      throw new Error("E-CFG05: web database configuration changed after pool initialization");
    }
    return current.pool;
  }

  const pool = new pg.Pool({ connectionString });
  globalForPool.__aiopsPgPool = { pool, connectionString };
  return pool;
}
