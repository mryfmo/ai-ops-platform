/**
 * packages/server/tests/approvalsRepo.test.ts
 *
 * 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / AUD-OPM-001。
 */
import { InMemoryAuditLog, type AuditLogWriter, type PgQueryable } from "@aiops/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPROVAL_REASON_MAX_LENGTH,
  ApprovalAlreadyDecidedError,
  ApprovalsRepo,
  type ApprovalTransactionRunner,
} from "../src/db/approvalsRepo.js";
import { applySchemaSerialized } from "./pgTestSchema.js";

const APPROVAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const ROW = {
  approval_id: APPROVAL_ID,
  approval_type: "change",
  target_id: "release-42",
  project_id: "PJ-001",
  status: "pending",
  requested_by: "AGT-CHG",
  approver_tenant_id: null,
  approver_object_id: null,
  decided_at: null,
  reason: null,
  delivered_at: null,
  created_at: "2026-08-08T00:00:00.000Z",
};

function mockDb(results: Array<{ rows: Record<string, unknown>[]; rowCount?: number }>) {
  const query = vi.fn(async () => results.shift() ?? { rows: [], rowCount: 0 });
  return { db: { query } as PgQueryable, query };
}

function testTransaction(db: PgQueryable, auditLog: AuditLogWriter): ApprovalTransactionRunner {
  return async (work) => work({ db, auditLog });
}

function testRepo(db: PgQueryable, auditLog = new InMemoryAuditLog()): ApprovalsRepo {
  return new ApprovalsRepo(db, testTransaction(db, auditLog));
}

describe("ApprovalsRepo [DevOps:SPEC-EXT-010 / DevOps:REQ-028]", () => {
  it("createはpendingを作成し状態遷移を追記監査する", async () => {
    const { db, query } = mockDb([{ rows: [ROW], rowCount: 1 }]);
    const audit = new InMemoryAuditLog();
    const approval = await testRepo(db, audit).create({
      approvalType: "change",
      targetId: "release-42",
      projectId: "PJ-001",
      requestedBy: "AGT-CHG",
      traceId: "trace-create",
    });

    expect(query.mock.calls[0]![0]).toContain("INSERT INTO approvals");
    expect(approval).toMatchObject({ approvalId: APPROVAL_ID, status: "pending", approvalType: "change" });
    expect(await audit.readAll()).toEqual([
      expect.objectContaining({ action: "approval_create", actor: "AGT-CHG", trace_id: "trace-create" }),
    ]);
  });

  it("listPendingはpendingだけを決定順で返す", async () => {
    const { db, query } = mockDb([{ rows: [{ ...ROW, delivered_at: "2026-08-08T00:00:30.000Z" }] }]);
    const result = await testRepo(db).listPending(["change"]);
    expect(query.mock.calls[0]![0]).toContain("WHERE status = 'pending'");
    expect(query.mock.calls[0]![0]).toContain("approval_type = ANY");
    expect(query.mock.calls[0]![0]).toContain("delivered_at IS NOT NULL");
    expect(query.mock.calls[0]![0]).toContain("ORDER BY created_at, approval_id");
    expect(result).toHaveLength(1);
  });

  it("同一type/targetのpending createは既存IDを再利用し重複create監査を残さない", async () => {
    const { db, query } = mockDb([{ rows: [] }, { rows: [ROW] }]);
    const audit = new InMemoryAuditLog();
    const result = await testRepo(db, audit).create({
      approvalType: "change",
      targetId: "release-42",
      projectId: "PJ-001",
      requestedBy: "AGT-CHG",
      traceId: "trace-reuse",
    });
    expect(result.approvalId).toBe(APPROVAL_ID);
    expect(query.mock.calls[1]![0]).toContain("approval_type = $1");
    expect(await audit.readAll()).toEqual([]);
  });

  it("markDeliveredだけがpendingを一覧でactionableにし状態遷移を監査する", async () => {
    const delivered = { ...ROW, delivered_at: "2026-08-08T00:00:30.000Z" };
    const { db, query } = mockDb([{ rows: [delivered], rowCount: 1 }]);
    const audit = new InMemoryAuditLog();
    const result = await testRepo(db, audit).markDelivered(APPROVAL_ID, "trace-delivered");
    expect(query.mock.calls[0]![0]).toContain("delivered_at = now()");
    expect(result.deliveredAt).toBe("2026-08-08T00:00:30.000Z");
    expect(await audit.readAll()).toEqual([
      expect.objectContaining({ action: "approval_delivered", trace_id: "trace-delivered" }),
    ]);
  });

  it("decideはpendingだけをCAS更新しEntra subjectとapprove監査を記録する", async () => {
    const approved = {
      ...ROW,
      status: "approved",
      approver_tenant_id: TENANT_ID,
      approver_object_id: OBJECT_ID,
      decided_at: "2026-08-08T00:01:00.000Z",
    };
    const { db, query } = mockDb([{ rows: [approved], rowCount: 1 }]);
    const audit = new InMemoryAuditLog();
    const result = await testRepo(db, audit).decide(APPROVAL_ID, {
      decision: "approved",
      approverTenantId: TENANT_ID,
      approverObjectId: OBJECT_ID,
      traceId: "trace-approve",
    });

    expect(query.mock.calls[0]![0]).toContain("status = 'pending'");
    expect(query.mock.calls[0]![1]).toEqual([APPROVAL_ID, "approved", TENANT_ID, OBJECT_ID, null]);
    expect(result.status).toBe("approved");
    expect(await audit.readAll()).toEqual([
      expect.objectContaining({
        action: "approval_approve",
        actor: `ENTRA:${TENANT_ID}:${OBJECT_ID}`,
        trace_id: "trace-approve",
      }),
    ]);
  });

  it("rejectは理由必須をDB前に検証し、理由を監査recordへ渡す", async () => {
    const { db, query } = mockDb([]);
    const repo = testRepo(db);
    await expect(
      repo.decide(APPROVAL_ID, {
        decision: "rejected",
        reason: "   ",
        approverTenantId: TENANT_ID,
        approverObjectId: OBJECT_ID,
        traceId: "trace-reject",
      }),
    ).rejects.toThrow("E-AUD01");
    expect(query).not.toHaveBeenCalled();
  });

  it("二重承認はno-opにせず明示エラーにし偽の監査を残さない", async () => {
    const { db } = mockDb([
      { rows: [], rowCount: 0 },
      { rows: [{ status: "approved" }], rowCount: 1 },
    ]);
    const audit = new InMemoryAuditLog();
    await expect(
      testRepo(db, audit).decide(APPROVAL_ID, {
        decision: "approved",
        approverTenantId: TENANT_ID,
        approverObjectId: OBJECT_ID,
        traceId: "trace-replay",
      }),
    ).rejects.toBeInstanceOf(ApprovalAlreadyDecidedError);
    expect(await audit.readAll()).toEqual([]);
  });

  it("reject理由はDB保存・監査前にsecretを除去する", async () => {
    const secret = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";
    const rejected = {
      ...ROW,
      status: "rejected",
      approver_tenant_id: TENANT_ID,
      approver_object_id: OBJECT_ID,
      decided_at: "2026-08-08T00:01:00.000Z",
      reason: "token [REDACTED] must be rotated",
    };
    const { db, query } = mockDb([{ rows: [rejected], rowCount: 1 }]);
    const audit = new InMemoryAuditLog();
    await testRepo(db, audit).decide(APPROVAL_ID, {
      decision: "rejected",
      reason: `token ${secret} must be rotated`,
      approverTenantId: TENANT_ID,
      approverObjectId: OBJECT_ID,
      traceId: "trace-secret-reason",
    });
    expect(String(query.mock.calls[0]![1]![4])).not.toContain(secret);
    expect(JSON.stringify(await audit.readAll())).not.toContain(secret);
  });

  it("reject理由は上限超過をDB前に拒否する", async () => {
    const { db, query } = mockDb([]);
    await expect(
      testRepo(db).decide(APPROVAL_ID, {
        decision: "rejected",
        reason: "x".repeat(APPROVAL_REASON_MAX_LENGTH + 1),
        approverTenantId: TENANT_ID,
        approverObjectId: OBJECT_ID,
        traceId: "trace-long-reason",
      }),
    ).rejects.toThrow("Invalid approval reason");
    expect(query).not.toHaveBeenCalled();
  });
});

const databaseUrl = process.env.TEST_DATABASE_URL;
const realPool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : undefined;

describe.skipIf(!databaseUrl)("ApprovalsRepo real PostgreSQL CAS [DevOps:SPEC-EXT-010 / AUD-OPM-001]", () => {
  function realTransaction(auditLog: AuditLogWriter): ApprovalTransactionRunner {
    return async (work) => {
      const client = await realPool!.connect();
      try {
        await client.query("BEGIN");
        const result = await work({ db: client, auditLog });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    };
  }

  beforeAll(async () => {
    // P1-T05: 並行テストファイルとの schema 適用レース回避（advisory lock 直列化）
    await applySchemaSerialized(realPool!, [
      new URL("../../devops/src/db/schema.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608080000_approvals.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608090001_agt_dep_runtime.sql", import.meta.url),
    ]);
  });

  beforeEach(async () => {
    await realPool!.query("TRUNCATE approvals CASCADE");
  });

  afterAll(async () => {
    await realPool?.end();
  });

  it("同一pendingへの並行decideは1件だけ成立する", async () => {
    const audit = new InMemoryAuditLog();
    const repo = new ApprovalsRepo(realPool!, realTransaction(audit));
    const created = await repo.create({
      approvalType: "change",
      targetId: "release-real",
      requestedBy: "AGT-CHG",
      traceId: "trace-real-create",
    });

    const results = await Promise.allSettled([
      repo.decide(created.approvalId, {
        decision: "approved",
        approverTenantId: TENANT_ID,
        approverObjectId: OBJECT_ID,
        traceId: "trace-real-a",
      }),
      repo.decide(created.approvalId, {
        decision: "approved",
        approverTenantId: TENANT_ID,
        approverObjectId: "33333333-3333-4333-8333-333333333333",
        traceId: "trace-real-b",
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(
      ApprovalAlreadyDecidedError,
    );
    expect((await audit.readAll()).filter((record) => record.action === "approval_approve")).toHaveLength(1);
  });

  it("監査追記失敗時はapproval更新も同一transactionでrollbackする", async () => {
    const audit = new InMemoryAuditLog();
    const created = await new ApprovalsRepo(realPool!, realTransaction(audit)).create({
      approvalType: "change",
      targetId: "release-audit-failure",
      projectId: "PJ-001",
      requestedBy: "AGT-CHG",
      traceId: "trace-audit-failure-create",
    });
    const failingAudit: AuditLogWriter = {
      append: async () => {
        throw new Error("forced audit failure");
      },
      readAll: async () => [],
    };

    await expect(
      new ApprovalsRepo(realPool!, realTransaction(failingAudit)).decide(created.approvalId, {
        decision: "approved",
        approverTenantId: TENANT_ID,
        approverObjectId: OBJECT_ID,
        traceId: "trace-audit-failure-decide",
      }),
    ).rejects.toThrow("forced audit failure");
    await expect(
      realPool!.query("SELECT status FROM approvals WHERE approval_id = $1", [created.approvalId]),
    ).resolves.toMatchObject({ rows: [{ status: "pending" }] });
  });

  it("同一pending targetの再作成は同じapprovalを返す", async () => {
    const audit = new InMemoryAuditLog();
    const repo = new ApprovalsRepo(realPool!, realTransaction(audit));
    const input = {
      approvalType: "change" as const,
      targetId: "release-idempotent",
      projectId: "PJ-001",
      requestedBy: "AGT-CHG",
      traceId: "trace-idempotent",
    };
    const first = await repo.create(input);
    const second = await repo.create(input);
    expect(second.approvalId).toBe(first.approvalId);
    expect((await audit.readAll()).filter((record) => record.action === "approval_create")).toHaveLength(1);
  });
});
