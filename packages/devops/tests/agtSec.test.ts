import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import {
  validateGrantApplication,
  executeGrant,
  revokeExpiredGrants,
  detectManualPermissionDrift,
  type GrantApplication,
  type GrantRecord,
  type SecDependencies,
} from "../src/agents/AGT_SEC.js";

const validApp: GrantApplication = {
  subject: "octocat",
  subjectType: "internal",
  targetRepo: "devops-system",
  targetOwner: "acme",
  env: "staging",
  level: "push",
  reason: "PJ-001の検証環境デプロイ作業のため",
  requesterProjectIds: ["PRJ-001"],
  applicantProjectIds: ["PRJ-001", "PRJ-002"],
  requestedDurationMs: 7 * 24 * 60 * 60 * 1000,
  existingActiveGrantForSameTarget: false,
};

describe("validateGrantApplication [SPEC-INT-032]", () => {
  it("すべて妥当ならok", () => {
    expect(validateGrantApplication(validApp).ok).toBe(true);
  });
  it("所属プロジェクト不一致はエラー", () => {
    const r = validateGrantApplication({ ...validApp, applicantProjectIds: ["PRJ-999"] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("E-SEC03"))).toBe(true);
  });
  it("理由が空はエラー", () => {
    const r = validateGrantApplication({ ...validApp, reason: "" });
    expect(r.errors.some((e) => e.includes("E-SEC04"))).toBe(true);
  });
  it("既存の有効な権限がある場合はエラー", () => {
    const r = validateGrantApplication({ ...validApp, existingActiveGrantForSameTarget: true });
    expect(r.errors.some((e) => e.includes("E-SEC05"))).toBe(true);
  });
  it("TH-007上限超過の申請期間はエラー（本番かつ9時間）", () => {
    const r = validateGrantApplication({ ...validApp, env: "prod", requestedDurationMs: 9 * 60 * 60 * 1000 });
    expect(r.errors.some((e) => e.includes("E-SEC06"))).toBe(true);
  });
});

interface Harness {
  deps: SecDependencies;
  counters: { put: number; remove: number };
}

function makeDeps(): Harness {
  const counters = { put: 0, remove: 0 };
  const deps: SecDependencies = {
    githubClient: {
      putCollaboratorPermission: async () => {
        counters.put += 1;
      },
      removeCollaborator: async () => {
        counters.remove += 1;
      },
    },
    auditLog: new InMemoryAuditLog(),
    traceId: "trace-1",
  };
  return { deps, counters };
}

const record: GrantRecord = {
  grantId: "GRANT-0001",
  subject: "octocat",
  targetOwner: "acme",
  targetRepo: "devops-system",
  level: "push",
  expiresAt: "2026-07-13T00:00:00Z",
  revokedAt: null,
};

describe("executeGrant / revokeExpiredGrants", () => {
  it("executeGrantは権限付与APIを呼び、監査ログに記録する", async () => {
    const { deps, counters } = makeDeps();
    await executeGrant(record, "leader-1", deps);
    expect(counters.put).toBe(1);
    const logs = await deps.auditLog.readAll();
    expect(logs.some((l) => l.action === "grant")).toBe(true);
  });

  it("revokeExpiredGrantsは期限到来分のみ剥奪する", async () => {
    const { deps, counters } = makeDeps();
    const now = new Date("2026-07-14T00:00:00Z");
    const stillValid: GrantRecord = { ...record, grantId: "GRANT-0002", expiresAt: "2026-08-01T00:00:00Z" };
    const revoked = await revokeExpiredGrants([record, stillValid], now, deps);
    expect(revoked).toEqual(["GRANT-0001"]);
    expect(counters.remove).toBe(1);
  });

  it("すでにrevokedAtが設定済みのものは再処理しない", async () => {
    const { deps } = makeDeps();
    const already: GrantRecord = { ...record, revokedAt: "2026-07-13T00:00:00Z" };
    const revoked = await revokeExpiredGrants([already], new Date("2026-08-01T00:00:00Z"), deps);
    expect(revoked).toHaveLength(0);
  });
});

describe("detectManualPermissionDrift [SPEC-INT-032 手動変更検出]", () => {
  it("台帳にない権限保持者を検出する", () => {
    const drift = detectManualPermissionDrift(
      [record],
      [
        { subject: "octocat", level: "push" },
        { subject: "unknown-user", level: "admin" },
      ],
    );
    expect(drift).toEqual(["unknown-user"]);
  });
  it("台帳と一致していれば差分なし", () => {
    const drift = detectManualPermissionDrift([record], [{ subject: "octocat", level: "push" }]);
    expect(drift).toHaveLength(0);
  });
});
