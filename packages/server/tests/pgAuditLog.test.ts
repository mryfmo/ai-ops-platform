/**
 * packages/server/tests/pgAuditLog.test.ts
 *
 * 根拠: DevOps:REQ-028 / SPEC-INT-056。PostgreSQL監査ログの保持区分と追記専用契約を検証する。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PgAuditLog } from "../src/db/pgAuditLog.js";

const compositionRoot = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

const record = {
  trace_id: "00000000-0000-0000-0000-000000000001",
  actor: "AGT-INC",
  action: "incident_detected",
  basis: "REQ-028",
  detail: { severity: "sev2" },
  at: "2026-07-11T00:00:00.000Z",
};

describe("PgAuditLog [REQ-028] [SPEC-INT-056]", () => {
  it("PrjOps/DevOps writerが異なるretention_classを監査INSERTへ保存する", async () => {
    const calls: Array<{ text: string; params?: unknown[] }> = [];
    const db = {
      query: async (text: string, params?: unknown[]) => {
        calls.push({ text, params });
        return { rows: [{ log_id: "7" }] };
      },
    };

    await new PgAuditLog(db, "prjops_5y").append(record);
    await new PgAuditLog(db, "devops_1y").append(record);

    expect(calls[0]?.text).toContain("retention_class");
    expect(calls.map((call) => call.params?.[0])).toEqual(["prjops_5y", "devops_1y"]);
  });

  it("retention class省略をruntime境界でも拒否する", () => {
    const db = { query: async () => ({ rows: [] }) };
    expect(() => Reflect.construct(PgAuditLog, [db])).toThrow("invalid audit retention class");
  });

  it("PrjOps workflowへ5年writerを明示配線する", () => {
    expect(compositionRoot).toContain('new PgAuditLog(pool, "prjops_5y")');
    for (const workflow of [
      "new TeamsConversationAgent",
      "createPmSnapshotReconcileTask",
      "createSevenKeysMonthlySnapshotTask",
      "createReportDeliveryTask",
      "xlsxImport:",
      "reports:",
    ]) {
      const start = compositionRoot.indexOf(workflow.endsWith(":") ? workflow : `${workflow}({`);
      expect(start).toBeGreaterThan(-1);
      expect(compositionRoot.slice(start, start + 1_200)).toMatch(/auditLog: prjopsAuditLog/);
    }
  });

  it("不正な保持区分をconstructor境界で拒否する", () => {
    expect(() => new PgAuditLog({ query: async () => ({ rows: [] }) }, "forever" as "devops_1y")).toThrow(
      "invalid audit retention class",
    );
  });
});
