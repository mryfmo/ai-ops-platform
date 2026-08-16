/** 根拠: ADR-0024 / WIQ-001 / WIQ-002 / WIQ-005 / DELTA-03 */
import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WorkIqQueryReceiptsRepo } from "../src/db/workIqQueryReceiptsRepo.js";
import { applySchemaSerialized } from "./pgTestSchema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 2 }) : undefined;

describe.skipIf(!databaseUrl)("Work IQ receipt PostgreSQL constraints [ADR-0024] [WIQ-001] [WIQ-005]", () => {
  beforeAll(async () => {
    await applySchemaSerialized(pool!, [
      new URL("../../devops/src/db/schema.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608160000_work_iq_query_receipts.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608160000_work_iq_query_receipts.sql", import.meta.url),
    ]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("stores sanitized metadata and exposes no raw question or response column", async () => {
    const receiptId = randomUUID();
    const secret = ["abcdefghijkl", "mnopqrstuvwx"].join("");
    await new WorkIqQueryReceiptsRepo(pool!).record({
      receiptId,
      subjectId: "user-a",
      tenantId: randomUUID(),
      tool: "ask",
      questionHash: "a".repeat(64),
      sourceReferences: [{ note: `api_key=${secret}` }],
      permissionContext: { scope: "delegated" },
      provenanceComplete: true,
      decisionId: null,
      status: "succeeded",
      errorCode: null,
      traceId: randomUUID(),
    });

    const row = await pool!.query(
      "SELECT source_references::text AS refs FROM work_iq_query_receipts WHERE receipt_id = $1",
      [receiptId],
    );
    expect(String(row.rows[0]!.refs)).not.toContain(secret);
    const columns = await pool!.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'work_iq_query_receipts'`,
    );
    expect(columns.rows.map(({ column_name }) => column_name)).not.toEqual(
      expect.arrayContaining(["question", "question_text", "response", "response_text"]),
    );
  });

  it("blocks UPDATE, DELETE, and TRUNCATE for every role", async () => {
    const receiptId = randomUUID();
    await new WorkIqQueryReceiptsRepo(pool!).record({
      receiptId,
      subjectId: "user-a",
      tenantId: randomUUID(),
      tool: "fetch",
      questionHash: null,
      sourceReferences: [],
      permissionContext: null,
      provenanceComplete: false,
      decisionId: null,
      status: "failed",
      errorCode: "E-WIQ-HTTP",
      traceId: randomUUID(),
    });

    await expect(
      pool!.query("UPDATE work_iq_query_receipts SET result_status = 'blocked' WHERE receipt_id = $1", [receiptId]),
    ).rejects.toThrow(/E-WIQ-RECEIPT-IMMUTABLE/u);
    await expect(pool!.query("DELETE FROM work_iq_query_receipts WHERE receipt_id = $1", [receiptId])).rejects.toThrow(
      /E-WIQ-RECEIPT-IMMUTABLE/u,
    );
    await expect(pool!.query("TRUNCATE work_iq_query_receipts")).rejects.toThrow(/E-WIQ-RECEIPT-IMMUTABLE/u);
  });

  it("enforces ask/fetch, result, provenance, and app-role append-only constraints", async () => {
    const columns = `receipt_id, subject_id, tenant_id, tool_name, question_hash,
      source_references, permission_context, provenance_complete, policy_decision_id,
      result_status, error_code, trace_id`;
    const values = [
      randomUUID(),
      "user-a",
      randomUUID(),
      "fetch",
      "b".repeat(64),
      "[]",
      null,
      false,
      null,
      "succeeded",
      null,
      randomUUID(),
    ];
    await expect(
      pool!.query(
        `INSERT INTO work_iq_query_receipts (${columns}) VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")})`,
        values,
      ),
    ).rejects.toThrow(/work_iq_query_receipts_question_hash_check/u);

    const role = await pool!.query("SELECT 1 FROM pg_roles WHERE rolname = 'app_role'");
    if (role.rowCount) {
      const privileges = await pool!.query(
        `SELECT has_table_privilege('app_role', 'work_iq_query_receipts', 'INSERT') AS can_insert,
                has_table_privilege('app_role', 'work_iq_query_receipts', 'UPDATE') AS can_update,
                has_table_privilege('app_role', 'work_iq_query_receipts', 'DELETE') AS can_delete,
                has_table_privilege('app_role', 'work_iq_query_receipts', 'TRUNCATE') AS can_truncate`,
      );
      expect(privileges.rows[0]).toMatchObject({
        can_insert: true,
        can_update: false,
        can_delete: false,
        can_truncate: false,
      });
    }
  });
});
