/**
 * packages/server/tests/approvalsRoutes.test.ts
 *
 * 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / DEC-SPEC-002 / AUD-OPM-001。
 */
import { Hono } from "hono";
import { InMemoryAuditLog } from "@aiops/shared";
import { signIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { describe, expect, it, vi } from "vitest";
import { ApprovalAlreadyDecidedError } from "../src/db/approvalsRepo.js";
import {
  APPROVAL_DECISION_MAX_BYTES,
  registerApprovalRoutes,
  type ApprovalRoutesDeps,
} from "../src/http/routes/approvals.js";

const SECRET = "web-bff-identity-secret-of-at-least-32-chars";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const APPROVAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = 1_786_118_400;
const pending = {
  approvalId: APPROVAL_ID,
  approvalType: "change" as const,
  targetId: "release-42",
  projectId: "PJ-001" as string | null,
  status: "pending" as const,
  requestedBy: "AGT-CHG",
  approverTenantId: null,
  approverObjectId: null,
  decidedAt: null,
  reason: null,
  createdAt: "2026-08-08T00:00:00.000Z",
};

function identityHeaders(method: string, path: string, body = "", issuedAtUnix = NOW) {
  const envelope = { method, path, body, tenantId: TENANT_ID, objectId: OBJECT_ID, issuedAtUnix };
  return {
    "x-aiops-entra-tenant-id": TENANT_ID,
    "x-aiops-entra-object-id": OBJECT_ID,
    "x-aiops-issued-at": String(issuedAtUnix),
    "x-aiops-identity-signature": signIdentityEnvelope(envelope, SECRET),
  };
}

function setup(
  options: {
    identitySecret?: string;
    profile?: string;
    approvalType?: "change" | "report" | "jit_grant";
    projectId?: string | null;
    projects?: string[];
    scopeMode?: "project" | "global";
  } = {
    identitySecret: SECRET,
  },
) {
  const current = {
    ...pending,
    approvalType: options.approvalType ?? "change",
    projectId: options.projectId === undefined ? pending.projectId : options.projectId,
  };
  const repo = {
    listPending: vi.fn(async () => [current]),
    getById: vi.fn(async () => current),
    decide: vi.fn(async () => ({
      ...current,
      status: "approved" as const,
      approverTenantId: TENANT_ID,
      approverObjectId: OBJECT_ID,
      decidedAt: "2026-08-08T00:01:00.000Z",
    })),
  };
  const recipientsRepo = {
    findActiveByTrustedSubject: vi.fn(async () => ({
      userId: "ST-001",
      profile: options.profile ?? "PRF-L",
      persona: "leader",
      email: "leader@example.com",
      projects: options.projects ?? ["PJ-001"],
      scopeMode: options.scopeMode ?? "project",
      language: "ja" as const,
      active: true,
      teamsTeamId: null,
      teamsChannelId: null,
    })),
    canDecideChangeByTrustedSubject: vi.fn(
      async (_tenantId: string, _objectId: string, projectId: string | null) =>
        (options.profile ?? "PRF-L") === "PRF-G" ||
        ((options.profile ?? "PRF-L") === "PRF-L" &&
          (options.scopeMode ?? "project") === "project" &&
          projectId !== null &&
          (options.projects ?? ["PJ-001"]).includes(projectId)),
    ),
  };
  const auditLog = new InMemoryAuditLog();
  const app = new Hono();
  registerApprovalRoutes(app, {
    approvalsRepo: repo,
    recipientsRepo,
    auditLog,
    identitySecret: options.identitySecret,
    nowUnix: () => NOW,
    traceIdProvider: () => "trace-route",
  } satisfies ApprovalRoutesDeps);
  return { app, repo, recipientsRepo, auditLog };
}

describe("approval routes [DevOps:SPEC-EXT-010 / AUD-OPM-001]", () => {
  it("secret未設定ではcapabilityを503で無効化しrepoを呼ばない", async () => {
    const { app, repo } = setup({ identitySecret: undefined });
    expect((await app.request("/approvals")).status).toBe(503);
    expect(repo.listPending).not.toHaveBeenCalled();
  });

  it("identity envelope欠落・改変・期限切れを401で拒否する", async () => {
    const { app, repo } = setup();
    expect((await app.request("/approvals")).status).toBe(401);
    expect(
      (
        await app.request("/approvals", {
          headers: identityHeaders("GET", "/different"),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request("/approvals", {
          headers: identityHeaders("GET", "/approvals", "", NOW - 91),
        })
      ).status,
    ).toBe(401);
    expect(repo.listPending).not.toHaveBeenCalled();
  });

  it("正しいGET envelopeでpending一覧を返す", async () => {
    const { app, repo } = setup();
    const response = await app.request("/approvals", { headers: identityHeaders("GET", "/approvals") });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      approvals: [{ ...pending, canDecide: true, decisionDisabledReason: null }],
    });
    expect(repo.listPending).toHaveBeenCalledWith(["change"]);
  });

  it("DevOps:REQ-010 / DEC-SPEC-002: PRF-Lは域外行も一覧表示するがdecide不可理由を返す", async () => {
    const { app } = setup({ identitySecret: SECRET, projects: ["PJ-002"] });
    const response = await app.request("/approvals", { headers: identityHeaders("GET", "/approvals") });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      approvals: [
        {
          ...pending,
          canDecide: false,
          decisionDisabledReason: "担当プロジェクト外のため判断できません。",
        },
      ],
    });
  });

  it.each(["PRF-M", "PRF-05"])("change承認はactive PRF-L/PRF-G以外を403で監査する: %s", async (profile) => {
    const { app, repo, auditLog } = setup({ identitySecret: SECRET, profile });
    const response = await app.request("/approvals", { headers: identityHeaders("GET", "/approvals") });
    expect(response.status).toBe(403);
    expect(repo.listPending).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({
        action: "approval_authorization_denied",
        detail: expect.objectContaining({ code: "E-APR-AUTHZ-PROFILE", profile }),
      }),
    ]);
  });

  it("署名済みbodyだけを受け、approverはbodyでなくenvelope subjectから渡す", async () => {
    const { app, repo, recipientsRepo } = setup();
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = JSON.stringify({
      decision: "approved",
      approverTenantId: "99999999-9999-4999-8999-999999999999",
      approverObjectId: "99999999-9999-4999-8999-999999999999",
    });
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(200);
    expect(repo.decide).toHaveBeenCalledWith(APPROVAL_ID, {
      decision: "approved",
      reason: undefined,
      approverTenantId: TENANT_ID,
      approverObjectId: OBJECT_ID,
      traceId: "trace-route",
    });
    expect(recipientsRepo.canDecideChangeByTrustedSubject).toHaveBeenCalledWith(TENANT_ID, OBJECT_ID, "PJ-001");
  });

  it.each([
    ["域外project", { projects: ["PJ-002"] }],
    ["NULL project", { projectId: null }],
  ])("DevOps:REQ-010 / DEC-SPEC-003: PRF-Lの%sは403で監査する", async (_label, option) => {
    const { app, repo, auditLog } = setup({ identitySecret: SECRET, ...option });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = JSON.stringify({ decision: "approved" });
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });
    expect(response.status).toBe(403);
    expect(repo.decide).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({
        action: "approval_authorization_denied",
        detail: expect.objectContaining({
          code: "E-APR-AUTHZ-PROJECT",
          approvalId: APPROVAL_ID,
          profile: "PRF-L",
        }),
      }),
    ]);
  });

  it("DevOps:REQ-010 / DEC-SPEC-003: PRF-L global assignmentは一覧取得から403でfail closedにする", async () => {
    const { app, repo, auditLog } = setup({
      identitySecret: SECRET,
      projects: [],
      scopeMode: "global",
    });
    const response = await app.request("/approvals", { headers: identityHeaders("GET", "/approvals") });
    expect(response.status).toBe(403);
    expect(repo.listPending).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({
        action: "approval_authorization_denied",
        detail: expect.objectContaining({ code: "E-APR-AUTHZ-SCOPE", profile: "PRF-L", scopeMode: "global" }),
      }),
    ]);
  });

  it("DevOps:REQ-010: PRF-GはNULL projectも承認できる", async () => {
    const { app, repo } = setup({ identitySecret: SECRET, profile: "PRF-G", projectId: null });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = JSON.stringify({ decision: "approved" });
    expect(
      (
        await app.request(path, {
          method: "POST",
          headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
          body,
        })
      ).status,
    ).toBe(200);
    expect(repo.decide).toHaveBeenCalledOnce();
  });

  it("DevOps:REQ-010 / DEC-SPEC-002: assignmentをリクエストごとに読み直す", async () => {
    const { app, repo, recipientsRepo } = setup();
    const first = await app.request("/approvals", { headers: identityHeaders("GET", "/approvals") });
    expect(await first.json()).toEqual({
      approvals: [{ ...pending, canDecide: true, decisionDisabledReason: null }],
    });
    recipientsRepo.findActiveByTrustedSubject.mockResolvedValueOnce({
      userId: "ST-001",
      profile: "PRF-L",
      persona: "leader",
      email: "leader@example.com",
      projects: ["PJ-002"],
      scopeMode: "project",
      language: "ja",
      active: true,
      teamsTeamId: null,
      teamsChannelId: null,
    });
    recipientsRepo.canDecideChangeByTrustedSubject.mockResolvedValueOnce(false);
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = JSON.stringify({ decision: "approved" });
    const second = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });
    expect(second.status).toBe(403);
    expect(recipientsRepo.findActiveByTrustedSubject).toHaveBeenCalledTimes(2);
    expect(recipientsRepo.canDecideChangeByTrustedSubject).toHaveBeenCalledWith(TENANT_ID, OBJECT_ID, "PJ-001");
    expect(repo.decide).not.toHaveBeenCalled();
  });

  it("reject理由欠落は400、CAS競合は409にする", async () => {
    const { app, repo } = setup();
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const missingReason = JSON.stringify({ decision: "rejected" });
    expect(
      (
        await app.request(path, {
          method: "POST",
          headers: { "content-type": "application/json", ...identityHeaders("POST", path, missingReason) },
          body: missingReason,
        })
      ).status,
    ).toBe(400);
    repo.decide.mockRejectedValueOnce(new ApprovalAlreadyDecidedError(APPROVAL_ID, "approved"));
    const approved = JSON.stringify({ decision: "approved" });
    expect(
      (
        await app.request(path, {
          method: "POST",
          headers: { "content-type": "application/json", ...identityHeaders("POST", path, approved) },
          body: approved,
        })
      ).status,
    ).toBe(409);
  });

  it("既に決定済みのapprovalも404に潰さず409を返す", async () => {
    const { app, repo } = setup();
    repo.getById.mockResolvedValueOnce({ ...pending, status: "approved" });
    repo.decide.mockRejectedValueOnce(new ApprovalAlreadyDecidedError(APPROVAL_ID, "approved"));
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = JSON.stringify({ decision: "approved" });
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });
    expect(response.status).toBe(409);
  });

  it.each(["report", "jit_grant"] as const)("未結線approval typeのdecideは403で監査する: %s", async (approvalType) => {
    const { app, repo, auditLog } = setup({ identitySecret: SECRET, approvalType });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = JSON.stringify({ decision: "approved" });
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });
    expect(response.status).toBe(403);
    expect(repo.decide).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({
        action: "approval_authorization_denied",
        detail: expect.objectContaining({ code: "E-APR-AUTHZ-TYPE", approvalType }),
      }),
    ]);
  });

  it("decision body上限を認証・repo呼出し前に413で強制する", async () => {
    const { app, repo, recipientsRepo } = setup();
    const response = await app.request(`/approvals/${APPROVAL_ID}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(APPROVAL_DECISION_MAX_BYTES + 1),
    });
    expect(response.status).toBe(413);
    expect(recipientsRepo.findActiveByTrustedSubject).not.toHaveBeenCalled();
    expect(repo.decide).not.toHaveBeenCalled();
  });
});
