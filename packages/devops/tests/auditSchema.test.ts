/**
 * packages/devops/tests/auditSchema.test.ts
 *
 * 根拠: DevOps REQ-028 / SPEC-INT-056。監査ログの追記専用・保持区分・partition migrationを検証する。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../src/db/migrations/202607110000_audit_log_partitions.sql", import.meta.url),
  "utf8",
);
const mutationMigration = readFileSync(
  new URL("../src/db/migrations/202607110001_audit_log_block_mutation.sql", import.meta.url),
  "utf8",
);
const integrationScript = readFileSync(new URL("../../../verification/run_db_integration.sh", import.meta.url), "utf8");

describe("audit schema [REQ-028] [SPEC-INT-056]", () => {
  it("partition keyを含む主キーと保持区分CHECKを持つ", () => {
    expect(schema).toContain("PRIMARY KEY (retention_class, at, log_id)");
    expect(schema).toContain("retention_class IN ('prjops_5y', 'devops_1y')");
    expect(schema).toContain("PARTITION BY LIST (retention_class)");
  });

  it("current/next/default partitionと冪等な作成関数を持つ", () => {
    expect(schema).toContain("CREATE OR REPLACE FUNCTION ensure_audit_log_partition");
    expect(schema).toContain("date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')");
    expect(schema).toContain("audit_log_prjops_5y_default");
    expect(schema).toContain("audit_log_devops_1y_default");
  });

  it("partition境界とcurrent monthをsession TimeZoneではなくUTCで算出する", () => {
    for (const sql of [schema, migration]) {
      expect(sql).toContain("T00:00:00Z");
      expect(sql).toContain("CURRENT_TIMESTAMP AT TIME ZONE 'UTC'");
    }
  });

  it("retention dry-runは保持区分を分離しcurrent/futureを除外する", () => {
    expect(schema).toContain("CREATE OR REPLACE FUNCTION audit_retention_candidates");
    expect(schema).toContain("INTERVAL '5 years'");
    expect(schema).toContain("INTERVAL '1 year'");
    expect(schema).toContain("month_start < date_trunc('month', p_as_of)::date");
    expect(schema).not.toMatch(/DROP TABLE.*audit_log_.+_\d{4}_\d{2}/);
  });

  it("retention defaultをUTC日付に固定しcatalogを対象schemaへ限定する", () => {
    for (const sql of [schema, migration]) {
      expect(sql).toContain("DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date");
      expect(sql).toContain("SET search_path FROM CURRENT");
      expect(sql).toContain("root.oid = 'audit_log'::regclass");
      expect(sql).toContain("format('%I.%I', root_schema.nspname, child.relname)");
    }
  });

  it("upgradeはcopy内容を照合してから旧表を削除する", () => {
    const validation = migration.indexOf("EXCEPT ALL");
    const drop = migration.indexOf("DROP TABLE audit_log_legacy_20260711");
    expect(validation).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(validation);
    expect(migration).toContain("audit_log copy validation failed");
  });

  it("非空の未分類legacy監査行を暗黙にDevOpsへ短縮しない", () => {
    expect(migration).toContain("non-empty legacy audit_log requires reviewed retention classification");
    expect(migration).not.toContain("SELECT log_id, 'devops_1y'");
  });

  it("classified legacy copy前に履歴月partitionを作成する", () => {
    const createHistorical = migration.indexOf("PERFORM ensure_audit_log_partition");
    const copy = migration.indexOf("INSERT INTO audit_log (log_id, retention_class");
    expect(createHistorical).toBeGreaterThan(-1);
    expect(createHistorical).toBeLessThan(copy);
    expect(migration).toContain("date_trunc('month', at AT TIME ZONE 'UTC')::date");
  });

  it("historical migration fixtureを明示UTC instantで投入する", () => {
    for (const month of ["01", "02", "03"]) {
      expect(integrationScript).toContain(`2024-${month}-01T00:00:00Z`);
    }
  });

  it("app_roleへINSERT/SELECTだけを付与する", () => {
    expect(schema).toContain("REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_role");
    expect(schema).toContain("GRANT INSERT, SELECT ON audit_log TO app_role");
    expect(schema).not.toContain("GRANT UPDATE");
    expect(schema).not.toContain("GRANT DELETE");
  });

  it("所有者を含むUPDATE/DELETEとTRUNCATEを0行でもstatement triggerで拒否する [REQ-028]", () => {
    for (const sql of [schema, mutationMigration]) {
      expect(sql).toContain("CREATE OR REPLACE FUNCTION audit_log_block_mutation");
      expect(sql).toContain("RAISE EXCEPTION 'E-AUD03: audit_log is append-only'");
      expect(sql).toContain("CREATE OR REPLACE TRIGGER audit_log_block_update_delete BEFORE UPDATE OR DELETE");
      expect(sql).toContain("FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation()");
      expect(sql).toContain("CREATE OR REPLACE TRIGGER audit_log_block_truncate BEFORE TRUNCATE");
    }
  });
});
