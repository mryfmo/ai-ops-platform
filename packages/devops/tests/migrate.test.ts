/**
 * packages/devops/tests/migrate.test.ts
 *
 * 根拠: A-11。schema_migrationsでDDL適用順序と冪等性を担保する。
 */
import { describe, expect, it } from "vitest";
import { applyMigrations, type SqlMigration } from "../src/db/migrate.js";

interface Call {
  text: string;
  params: unknown[] | undefined;
}

function fakeDb(appliedVersions: string[] = [], failSql?: string, failRollback = false) {
  const clientCalls: Call[] = [];
  const poolCalls: Call[] = [];
  let released = false;
  let releaseError: Error | undefined;
  const client = {
    query: async (text: string, params?: unknown[]) => {
      clientCalls.push({ text, params });
      if (failRollback && text === "ROLLBACK") throw new Error("rollback failed");
      if (failSql && text === failSql) throw new Error("migration failed");
      if (text === "SELECT version FROM schema_migrations") {
        return { rows: appliedVersions.map((version) => ({ version })) };
      }
      return { rows: [] };
    },
    release: (err?: Error) => {
      releaseError = err;
      released = true;
    },
  };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      poolCalls.push({ text, params });
      throw new Error("pool.query must not be used for migrations");
    },
    connect: async () => client,
  };
  return { pool, clientCalls, poolCalls, wasReleased: () => released, releaseError: () => releaseError };
}

const migrations: SqlMigration[] = [
  { version: "202607100001", name: "202607100001_one.sql", sql: "ALTER TABLE one;" },
  { version: "202607100002", name: "202607100002_two.sql", sql: "ALTER TABLE two;" },
];

describe("applyMigrations (A-11)", () => {
  it("未適用migrationを順序通りtransactionで適用して記録する", async () => {
    const { pool, clientCalls, poolCalls, wasReleased } = fakeDb();

    await expect(applyMigrations(pool, migrations)).resolves.toEqual({
      applied: ["202607100001", "202607100002"],
      skipped: [],
    });

    expect(poolCalls).toEqual([]);
    expect(clientCalls.map((call) => call.text)).toEqual([
      "BEGIN",
      "SELECT pg_advisory_xact_lock($1)",
      expect.stringContaining("CREATE TABLE IF NOT EXISTS schema_migrations"),
      "SELECT version FROM schema_migrations",
      "ALTER TABLE one;",
      "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
      "ALTER TABLE two;",
      "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
      "COMMIT",
    ]);
    expect(clientCalls[1]?.params).toEqual([240024]);
    expect(wasReleased()).toBe(true);
  });

  it("適用済みversionはskipする", async () => {
    const { pool, clientCalls } = fakeDb(["202607100001"]);

    await expect(applyMigrations(pool, migrations)).resolves.toEqual({
      applied: ["202607100002"],
      skipped: ["202607100001"],
    });

    expect(clientCalls.some((call) => call.text === "ALTER TABLE one;")).toBe(false);
    expect(clientCalls.some((call) => call.text === "ALTER TABLE two;")).toBe(true);
  });

  it("migration失敗時はROLLBACKして失敗を返す", async () => {
    const { pool, clientCalls, wasReleased } = fakeDb([], "ALTER TABLE one;");

    await expect(applyMigrations(pool, migrations)).rejects.toThrow("migration failed");

    expect(clientCalls.at(-1)?.text).toBe("ROLLBACK");
    expect(wasReleased()).toBe(true);
  });

  it("ROLLBACK失敗時はpoison接続としてrelease(err)する", async () => {
    const { pool, releaseError } = fakeDb([], "ALTER TABLE one;", true);

    await expect(applyMigrations(pool, migrations)).rejects.toThrow("rollback failed");

    expect(releaseError()?.message).toBe("rollback failed");
  });
});
