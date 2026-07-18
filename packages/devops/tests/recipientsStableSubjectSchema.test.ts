/**
 * packages/devops/tests/recipientsStableSubjectSchema.test.ts
 *
 * 根拠: P010-F02-T03 / DEC-SPEC-002。
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../src/db/migrations/202607180000_recipients_stable_subject.sql", import.meta.url),
  "utf8",
);
const rollback = `
  DROP INDEX IF EXISTS idx_recipients_stable_subject;
  ALTER TABLE recipients
    DROP CONSTRAINT IF EXISTS recipients_active_mapping_check,
    DROP CONSTRAINT IF EXISTS recipients_stable_subject_state_check,
    DROP CONSTRAINT IF EXISTS recipients_backfill_state_check,
    DROP CONSTRAINT IF EXISTS recipients_backfill_disposition_check,
    DROP CONSTRAINT IF EXISTS recipients_scope_mode_check,
    DROP COLUMN IF EXISTS backfill_state,
    DROP COLUMN IF EXISTS backfill_disposition,
    DROP COLUMN IF EXISTS scope_mode,
    DROP COLUMN IF EXISTS entra_object_id,
    DROP COLUMN IF EXISTS entra_tenant_id;
`;
const testDatabaseName = process.env["AIOPS_TEST_DATABASE_NAME"];
const postgresDescribe = testDatabaseName ? describe : describe.skip;

async function withIsolatedSchema(run: (client: InstanceType<typeof pg.Client>) => Promise<void>): Promise<void> {
  if (!testDatabaseName) throw new Error("AIOPS_TEST_DATABASE_NAME is required");
  const client = new pg.Client({
    database: testDatabaseName,
    host: process.env["AIOPS_TEST_DATABASE_HOST"] ?? "127.0.0.1",
    port: Number(process.env["AIOPS_TEST_DATABASE_PORT"] ?? "55432"),
  });
  const namespace = `t03_${randomUUID().replaceAll("-", "")}`;
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

describe("recipients stable subject schema [P010-F02-T03 / DEC-SPEC-002]", () => {
  it("fresh schemaはUUID subject、scope、backfill state、部分unique keyを持つ", () => {
    const table = schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS recipients"));
    expect(table).toMatch(/entra_tenant_id UUID/);
    expect(table).toMatch(/entra_object_id UUID/);
    expect(table).toContain("scope_mode IN ('project', 'global')");
    expect(table).toContain("backfill_state IN ('pending', 'applied')");
    expect(table).toContain("'migrate_active', 'deactivate', 'erase_after_retention'");
    expect(table).toContain("idx_recipients_stable_subject");
  });

  it("upgradeはlegacy行をinactive pendingへ隔離し偽subjectを補わない", () => {
    expect(migration).toContain("SET active = false");
    expect(migration).toContain("backfill_state = 'pending'");
    expect(migration).toContain("entra_tenant_id IS NULL");
    expect(migration).not.toMatch(/SET entra_(tenant|object)_id\s*=/);
    expect(migration).not.toMatch(/UNIQUE\s*\(\s*email\s*\)/i);
  });

  it("migrationはaudit権限を変更せずrollback DDLを持つ", () => {
    expect(migration).not.toMatch(/audit_log|GRANT\s+(UPDATE|DELETE)/i);
    expect(migration).toContain("-- rollback: DROP INDEX IF EXISTS idx_recipients_stable_subject");
  });
});

postgresDescribe("recipients stable subject PostgreSQL [P010-F02-T03 / DEC-SPEC-002]", () => {
  it("fresh schemaでduplicate、active NULL subject、invalid stateを拒否する", async () => {
    await withIsolatedSchema(async (client) => {
      await client.query(schema);
      const columns = await client.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'recipients'
           AND column_name IN ('entra_tenant_id', 'entra_object_id', 'scope_mode', 'backfill_state')`,
      );
      expect(columns.rows).toEqual(
        expect.arrayContaining([
          { column_name: "entra_tenant_id", data_type: "uuid", is_nullable: "YES" },
          { column_name: "entra_object_id", data_type: "uuid", is_nullable: "YES" },
          { column_name: "scope_mode", data_type: "text", is_nullable: "NO" },
          { column_name: "backfill_state", data_type: "text", is_nullable: "NO" },
        ]),
      );
      const constraints = await client.query(
        `SELECT conname
         FROM pg_constraint
         WHERE conrelid = 'recipients'::regclass`,
      );
      expect(constraints.rows).toEqual(
        expect.arrayContaining([
          { conname: "recipients_stable_subject_state_check" },
          { conname: "recipients_active_mapping_check" },
        ]),
      );
      const indexes = await client.query(
        `SELECT indexname, indexdef
         FROM pg_indexes
         WHERE schemaname = current_schema() AND tablename = 'recipients'`,
      );
      expect(indexes.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            indexname: "idx_recipients_stable_subject",
            indexdef: expect.stringContaining("UNIQUE"),
          }),
        ]),
      );
      const insert = `
        INSERT INTO recipients (
          user_id, profile, persona, email, projects, language, active,
          entra_tenant_id, entra_object_id, scope_mode, backfill_disposition, backfill_state
        ) VALUES ($1, 'PRF-02', 'manager', $2, ARRAY['PJ-001'], 'ja', true, $3, $4, 'project',
                  'migrate_active', 'applied')
      `;
      await client.query(insert, [
        "ST-001",
        "first@example.com",
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ]);
      await expect(
        client.query(insert, [
          "ST-002",
          "second@example.com",
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ]),
      ).rejects.toMatchObject({ code: "23505" });
      await expect(
        client.query(
          `INSERT INTO recipients (
             user_id, profile, email, active, scope_mode, backfill_disposition, backfill_state
           ) VALUES ('ST-003', 'PRF-02', 'third@example.com', true, 'project', 'migrate_active', 'applied')`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        client.query(
          `INSERT INTO recipients (
             user_id, profile, email, active, scope_mode, backfill_state
           ) VALUES ('ST-004', 'PRF-02', 'fourth@example.com', false, 'invalid', 'pending')`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
  });

  it("legacy upgradeは行を保持しmigrationを再適用できる", async () => {
    await withIsolatedSchema(async (client) => {
      await client.query(`
        CREATE TABLE recipients (
          user_id TEXT PRIMARY KEY,
          profile TEXT NOT NULL,
          persona TEXT,
          email TEXT NOT NULL,
          projects TEXT[] NOT NULL DEFAULT '{}',
          language TEXT NOT NULL DEFAULT 'ja',
          active BOOLEAN NOT NULL DEFAULT true,
          teams_team_id TEXT,
          teams_channel_id TEXT
        )
      `);
      await client.query(
        `INSERT INTO recipients (user_id, profile, email, projects, active) VALUES
         ('ST-001', 'PRF-02', 'one@example.com', ARRAY['PJ-001'], true),
         ('ST-002', 'PRF-G', 'two@example.com', '{}', false),
         ('ST-003', 'PRF-04', 'three@example.com', ARRAY['PJ-001'], true)`,
      );
      await client.query(migration);
      await client.query(migration);
      const rows = await client.query(
        `SELECT user_id, active, entra_tenant_id, entra_object_id, scope_mode,
                backfill_disposition, backfill_state
         FROM recipients ORDER BY user_id`,
      );
      expect(rows.rows).toEqual([
        {
          user_id: "ST-001",
          active: false,
          entra_tenant_id: null,
          entra_object_id: null,
          scope_mode: "project",
          backfill_disposition: null,
          backfill_state: "pending",
        },
        {
          user_id: "ST-002",
          active: false,
          entra_tenant_id: null,
          entra_object_id: null,
          scope_mode: "global",
          backfill_disposition: null,
          backfill_state: "pending",
        },
        {
          user_id: "ST-003",
          active: false,
          entra_tenant_id: null,
          entra_object_id: null,
          scope_mode: "project",
          backfill_disposition: null,
          backfill_state: "pending",
        },
      ]);
    });
  });

  it("rollback DDLはstable subject列だけを戻しrecipient行とaudit tableを保持する", async () => {
    await withIsolatedSchema(async (client) => {
      await client.query(schema);
      await client.query(
        `INSERT INTO recipients (
           user_id, profile, email, active, scope_mode, backfill_state
         ) VALUES ('ST-001', 'PRF-02', 'legacy@example.com', false, 'project', 'pending')`,
      );
      await client.query(rollback);
      const retained = await client.query("SELECT user_id, active FROM recipients");
      expect(retained.rows).toEqual([{ user_id: "ST-001", active: false }]);
      const removed = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'recipients'
           AND column_name IN ('entra_tenant_id', 'entra_object_id', 'scope_mode', 'backfill_state')`,
      );
      expect(removed.rows).toEqual([]);
      await expect(client.query("SELECT count(*) FROM audit_log")).resolves.toMatchObject({
        rows: [{ count: "0" }],
      });
    });
  });
});
