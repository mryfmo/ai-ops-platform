/** 根拠: FinalArch:CON-003 / DevOps:SPEC-EXT-010（PG 統合テスト基盤の直列化） */
// vitest はテストファイルを並列実行するため、複数ファイルの beforeAll が同一 DB へ
// schema.sql を同時適用すると CREATE TABLE IF NOT EXISTS が catalog レース
// （pg_type_typname_nsp_index duplicate）で失敗し得る。advisory lock で直列化する。

import { readFile } from "node:fs/promises";

import type { Pool } from "pg";

const SCHEMA_APPLY_LOCK = 202608110;

export async function applySchemaSerialized(pool: Pool, sqlFiles: URL[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [SCHEMA_APPLY_LOCK]);
    for (const file of sqlFiles) {
      await client.query(await readFile(file, "utf8"));
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [SCHEMA_APPLY_LOCK]);
    } finally {
      client.release();
    }
  }
}
