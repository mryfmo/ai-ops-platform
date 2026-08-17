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
  ApprovalExpiredError,
  ApprovalStaleVersionError,
  ApprovalsRepo,
  type ApprovalTransactionRunner,
} from "../src/db/approvalsRepo.js";
import { applySchemaSerialized } from "./pgTestSchema.js";

const APPROVAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION = 7;
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
  dispatched_at: null,
  payload_hash: null,
  expected_version: VERSION,
  expires_at: "2099-01-01T00:00:00.000Z",
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
      expectedVersion: VERSION,
      traceId: "trace-approve",
    });

    expect(query.mock.calls[0]![0]).toContain("status = 'pending'");
    expect(query.mock.calls[0]![0]).toContain("expected_version = $6");
    expect(query.mock.calls[0]![0]).toContain("expires_at > now()");
    expect(query.mock.calls[0]![1]).toEqual([APPROVAL_ID, "approved", TENANT_ID, OBJECT_ID, null, VERSION]);
    expect(result.status).toBe("approved");
    expect(result.expectedVersion).toBe(VERSION);
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
        expectedVersion: VERSION,
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
        expectedVersion: VERSION,
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
      expectedVersion: VERSION,
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
        expectedVersion: VERSION,
        traceId: "trace-long-reason",
      }),
    ).rejects.toThrow("Invalid approval reason");
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    [
      "version mismatch",
      { status: "pending", expected_version: VERSION + 1, expired: false },
      ApprovalStaleVersionError,
    ],
    ["missing version", { status: "pending", expected_version: null, expired: false }, ApprovalStaleVersionError],
    ["expired", { status: "pending", expected_version: VERSION, expired: true }, ApprovalExpiredError],
  ])("%s CAS loser is rejected without audit or signal authority", async (_label, current, ErrorType) => {
    const { db } = mockDb([{ rows: [] }, { rows: [current] }]);
    const audit = new InMemoryAuditLog();
    await expect(
      testRepo(db, audit).decide(APPROVAL_ID, {
        decision: "approved",
        approverTenantId: TENANT_ID,
        approverObjectId: OBJECT_ID,
        expectedVersion: VERSION,
        traceId: "trace-stale",
      }),
    ).rejects.toBeInstanceOf(ErrorType);
    expect(await audit.readAll()).toEqual([]);
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
    // CASCADE は並行実行中の p1LedgerPg の FK 参照行まで消すため使わない。
    // 本 suite の approvals 行は他 suite から参照されない（DELETE は FK 安全に成功する）
    await realPool!.query("DELETE FROM approvals");
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
    await realPool!.query(
      "UPDATE approvals SET expected_version = $2, expires_at = '2099-01-01T00:00:00Z' WHERE approval_id = $1",
      [created.approvalId, VERSION],
    );

    const results = await Promise.allSettled([
      repo.decide(created.approvalId, {
        decision: "approved",
        approverTenantId: TENANT_ID,
        approverObjectId: OBJECT_ID,
        expectedVersion: VERSION,
        traceId: "trace-real-a",
      }),
      repo.decide(created.approvalId, {
        decision: "approved",
        approverTenantId: TENANT_ID,
        approverObjectId: "33333333-3333-4333-8333-333333333333",
        expectedVersion: VERSION,
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
    await realPool!.query(
      "UPDATE approvals SET expected_version = $2, expires_at = '2099-01-01T00:00:00Z' WHERE approval_id = $1",
      [created.approvalId, VERSION],
    );
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
        expectedVersion: VERSION,
        traceId: "trace-audit-failure-decide",
      }),
    ).rejects.toThrow("forced audit failure");
    await expect(
      realPool!.query("SELECT status FROM approvals WHERE approval_id = $1", [created.approvalId]),
    ).resolves.toMatchObject({ rows: [{ status: "pending" }] });
  });

  it("real PostgreSQLでもstale versionとexpiryを単一CASで拒否する", async () => {
    const audit = new InMemoryAuditLog();
    const repo = new ApprovalsRepo(realPool!, realTransaction(audit));
    const stale = await repo.create({
      approvalType: "change",
      targetId: "release-stale",
      requestedBy: "AGT-CHG",
      traceId: "trace-real-stale-create",
    });
    const expired = await repo.create({
      approvalType: "change",
      targetId: "release-expired",
      requestedBy: "AGT-CHG",
      traceId: "trace-real-expired-create",
    });
    await realPool!.query(
      `UPDATE approvals
       SET expected_version = CASE approval_id WHEN $1 THEN $3::bigint ELSE $4::bigint END,
           expires_at = CASE approval_id
             WHEN $1 THEN TIMESTAMPTZ '2099-01-01T00:00:00Z'
             ELSE TIMESTAMPTZ '2000-01-01T00:00:00Z'
           END
       WHERE approval_id = ANY($2::uuid[])`,
      [stale.approvalId, [stale.approvalId, expired.approvalId], VERSION + 1, VERSION],
    );
    const input = {
      decision: "approved" as const,
      approverTenantId: TENANT_ID,
      approverObjectId: OBJECT_ID,
      expectedVersion: VERSION,
      traceId: "trace-real-negative",
    };

    await expect(repo.decide(stale.approvalId, input)).rejects.toBeInstanceOf(ApprovalStaleVersionError);
    await expect(repo.decide(expired.approvalId, input)).rejects.toBeInstanceOf(ApprovalExpiredError);
    await expect(
      realPool!.query("SELECT status FROM approvals WHERE approval_id = ANY($1::uuid[]) ORDER BY approval_id", [
        [stale.approvalId, expired.approvalId],
      ]),
    ).resolves.toMatchObject({ rows: [{ status: "pending" }, { status: "pending" }] });
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
