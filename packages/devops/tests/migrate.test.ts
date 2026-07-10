/**
 * packages/devops/tests/migrate.test.ts
 *
 * 根拠: A-11。schema_migrationsでDDL適用順序と冪等性を担保する。
 */
import { describe, expect, it } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { applyMigrations, type SqlMigration } from "../src/db/migrate.js";

interface Call {
  text: string;
  params: unknown[] | undefined;
}

function fakeDb(appliedVersions: string[] = [], failSql?: string) {
  const calls: Call[] = [];
  const db: PgQueryable = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      if (failSql && text === failSql) throw new Error("migration failed");
      if (text === "SELECT version FROM schema_migrations") {
        return { rows: appliedVersions.map((version) => ({ version })) };
      }
      return { rows: [] };
    },
  };
  return { db, calls };
}

const migrations: SqlMigration[] = [
  { version: "202607100001", name: "202607100001_one.sql", sql: "ALTER TABLE one;" },
  { version: "202607100002", name: "202607100002_two.sql", sql: "ALTER TABLE two;" },
];

describe("applyMigrations (A-11)", () => {
  it("未適用migrationを順序通りtransactionで適用して記録する", async () => {
    const { db, calls } = fakeDb();

    await expect(applyMigrations(db, migrations)).resolves.toEqual({
      applied: ["202607100001", "202607100002"],
      skipped: [],
    });

    expect(calls.map((call) => call.text)).toEqual([
      expect.stringContaining("CREATE TABLE IF NOT EXISTS schema_migrations"),
      "SELECT version FROM schema_migrations",
      "BEGIN",
      "ALTER TABLE one;",
      "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
      "COMMIT",
      "BEGIN",
      "ALTER TABLE two;",
      "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
      "COMMIT",
    ]);
  });

  it("適用済みversionはskipする", async () => {
    const { db, calls } = fakeDb(["202607100001"]);

    await expect(applyMigrations(db, migrations)).resolves.toEqual({
      applied: ["202607100002"],
      skipped: ["202607100001"],
    });

    expect(calls.some((call) => call.text === "ALTER TABLE one;")).toBe(false);
    expect(calls.some((call) => call.text === "ALTER TABLE two;")).toBe(true);
  });

  it("migration失敗時はROLLBACKして失敗を返す", async () => {
    const { db, calls } = fakeDb([], "ALTER TABLE one;");

    await expect(applyMigrations(db, migrations)).rejects.toThrow("migration failed");

    expect(calls.at(-1)?.text).toBe("ROLLBACK");
  });
});
