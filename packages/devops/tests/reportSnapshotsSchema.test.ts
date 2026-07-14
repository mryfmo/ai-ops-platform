/**
 * packages/devops/tests/reportSnapshotsSchema.test.ts
 *
 * 根拠: DevOps:REQ-031 / SPEC-INT-055 / SPEC-INT-081。
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../src/db/migrations/202607140000_report_snapshots_identity.sql", import.meta.url),
  "utf8",
);
const testDatabaseName = process.env["AIOPS_TEST_DATABASE_NAME"];
const postgresDescribe = testDatabaseName ? describe : describe.skip;

async function withIsolatedSchema(run: (client: InstanceType<typeof pg.Client>) => Promise<void>): Promise<void> {
  if (!testDatabaseName) throw new Error("AIOPS_TEST_DATABASE_NAME is required");
  const client = new pg.Client({
    database: testDatabaseName,
    host: process.env["AIOPS_TEST_DATABASE_HOST"] ?? "127.0.0.1",
    port: Number(process.env["AIOPS_TEST_DATABASE_PORT"] ?? "5432"),
  });
  const namespace = `t08_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${namespace}"`);
    await client.query(`SET search_path TO "${namespace}"`);
    await run(client);
  } finally {
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await client.end();
  }
}

describe("report_snapshots schema [DevOps:REQ-031 / SPEC-INT-055 / SPEC-INT-081]", () => {
  it("fresh schemaはexact project/scope/source identityとlookup indexを持つ", () => {
    const table = schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS report_snapshots"));
    expect(table).toMatch(/scope\s+TEXT NOT NULL CHECK \(scope IN \('user', 'project', 'global'\)\)/);
    expect(table).toMatch(/project_id\s+TEXT/);
    expect(table).toMatch(/source\s+TEXT NOT NULL/);
    expect(table).toContain("idx_report_snapshots_metric_lookup");
  });

  it("upgrade migrationは既存行を保持してsourceを明示backfillする", () => {
    const addSource = migration.indexOf("ADD COLUMN IF NOT EXISTS source TEXT");
    const backfill = migration.indexOf("SET source = 'legacy:unknown'");
    const notNull = migration.indexOf("ALTER COLUMN source SET NOT NULL");
    expect(addSource).toBeGreaterThanOrEqual(0);
    expect(backfill).toBeGreaterThan(addSource);
    expect(notNull).toBeGreaterThan(backfill);
    expect(migration).not.toMatch(/DROP TABLE|DELETE FROM report_snapshots|TRUNCATE/i);
  });

  it("upgrade migrationは再適用可能なcolumn/index DDLを使う", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS project_id TEXT");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source TEXT");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS idx_report_snapshots_metric_lookup");
  });
});

postgresDescribe("report_snapshots PostgreSQL migration [SPEC-INT-055 / SPEC-INT-081]", () => {
  it("実PostgreSQL fresh schemaでidentity列とindexを作成する", async () => {
    await withIsolatedSchema(async (client) => {
      await client.query(schema);
      const columns = await client.query(
        `SELECT column_name, is_nullable
         FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'report_snapshots'`,
      );
      expect(columns.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ column_name: "project_id", is_nullable: "YES" }),
          expect.objectContaining({ column_name: "source", is_nullable: "NO" }),
        ]),
      );
      const indexes = await client.query(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = current_schema() AND tablename = 'report_snapshots'`,
      );
      expect(indexes.rows).toEqual(
        expect.arrayContaining([expect.objectContaining({ indexname: "idx_report_snapshots_metric_lookup" })]),
      );
    });
  });

  it("実PostgreSQL legacy upgradeで行を保持しmigrationを再適用できる", async () => {
    await withIsolatedSchema(async (client) => {
      await client.query(`
        CREATE TABLE report_snapshots (
          snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          period_start TIMESTAMPTZ NOT NULL,
          period_end TIMESTAMPTZ NOT NULL,
          scope TEXT NOT NULL CHECK (scope IN ('user', 'project', 'global')),
          metrics JSONB NOT NULL,
          generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await client.query(
        `INSERT INTO report_snapshots (period_start, period_end, scope, metrics, generated_at)
         VALUES ($1, $2, 'global', $3::jsonb, $4)`,
        [
          "2026-06-29T00:00:00+09:00",
          "2026-07-06T00:00:00+09:00",
          JSON.stringify({ deployment_frequency_per_week: 8 }),
          "2026-07-05T23:00:00+09:00",
        ],
      );
      await client.query(migration);
      await client.query(migration);
      const rows = await client.query(
        "SELECT scope, project_id, source, metrics->>'deployment_frequency_per_week' AS value FROM report_snapshots",
      );
      expect(rows.rows).toEqual([{ scope: "global", project_id: null, source: "legacy:unknown", value: "8" }]);
    });
  });
});
