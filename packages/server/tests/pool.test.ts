/**
 * packages/server/tests/pool.test.ts
 *
 * 根拠: A-11b。Poolの上限とtimeoutをconfig経由で実効設定する。
 */
import { describe, expect, it } from "vitest";
import { buildPoolConfig } from "../src/db/pool.js";

describe("buildPoolConfig (A-11b)", () => {
  it("connection poolとtimeout設定をpg PoolConfigへ渡す", () => {
    expect(
      buildPoolConfig("postgres://user:pass@localhost:5432/aiops", {
        max: 20,
        connectionTimeoutMillis: 7000,
        statementTimeoutMs: 45000,
        idleInTransactionSessionTimeoutMs: 15000,
      }),
    ).toMatchObject({
      connectionString: "postgres://user:pass@localhost:5432/aiops",
      max: 20,
      connectionTimeoutMillis: 7000,
      statement_timeout: 45000,
      idle_in_transaction_session_timeout: 15000,
    });
  });
});
