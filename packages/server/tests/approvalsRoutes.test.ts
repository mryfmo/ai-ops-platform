/**
 * packages/server/tests/approvalsRoutes.test.ts
 *
 * 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / DEC-SPEC-002 / AUD-OPM-001。
 */
import { Hono } from "hono";
import { InMemoryAuditLog } from "@aiops/shared";
import { signIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { describe, expect, it, vi } from "vitest";
import {
  ApprovalAlreadyDecidedError,
  ApprovalExpiredError,
  ApprovalStaleVersionError,
} from "../src/db/approvalsRepo.js";
import {
  APPROVAL_DECISION_MAX_BYTES,
  registerApprovalRoutes,
  signApprovalCardCorrelation,
  type ApprovalRoutesDeps,
} from "../src/http/routes/approvals.js";

const SECRET = "web-bff-identity-secret-of-at-least-32-chars";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const APPROVAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION = 7;
const NOW = 1_786_118_400;
const pending = {
  approvalId: APPROVAL_ID,
  approvalType: "change" as const,
  targetId: "release-42",
  projectId: "PJ-001" as string | null,
  targetSha: null,
  status: "pending" as const,
  requestedBy: "AGT-CHG",
  approverTenantId: null,
  approverObjectId: null,
  decidedAt: null,
  reason: null,
  deliveredAt: "2026-08-08T00:00:30.000Z",
  dispatchedAt: null,
  payloadHash: null,
  expectedVersion: VERSION,
  expiresAt: "2099-01-01T00:00:00.000Z",
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

function decisionBody(
  overrides: Record<string, unknown> = {},
  identity: { tenantId: string; objectId: string } = { tenantId: TENANT_ID, objectId: OBJECT_ID },
): string {
  return JSON.stringify({
    action: "approval_decision",
    approvalId: APPROVAL_ID,
    version: VERSION,
    decision: "approved",
    correlation: signApprovalCardCorrelation({ approvalId: APPROVAL_ID, version: VERSION, ...identity }, SECRET),
    ...overrides,
  });
}

function setup(
  options: {
    identitySecret?: string;
    profile?: string;
    approvalType?: "change" | "report" | "jit_grant";
    projectId?: string | null;
    projects?: string[];
    scopeMode?: "project" | "global";
    requestedBy?: string;
    expectedVersion?: number | null;
    signalPort?: boolean;
  } = {
    identitySecret: SECRET,
  },
) {
  const current = {
    ...pending,
    approvalType: options.approvalType ?? "change",
    projectId: options.projectId === undefined ? pending.projectId : options.projectId,
    requestedBy: options.requestedBy ?? pending.requestedBy,
    expectedVersion: options.expectedVersion === undefined ? pending.expectedVersion : options.expectedVersion,
  };
  const events: string[] = [];
  const repo = {
    listPending: vi.fn(async () => [current]),
    getById: vi.fn(async () => current),
    decide: vi.fn(async (_approvalId: string, input: { decision: "approved" | "rejected"; reason?: string }) => {
      events.push("cas");
      return {
        ...current,
        status: input.decision,
        approverTenantId: TENANT_ID,
        approverObjectId: OBJECT_ID,
        decidedAt: "2026-08-08T00:01:00.000Z",
        reason: input.reason?.trim() || null,
      };
    }),
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
  const signalApprovalDecision = vi.fn(async () => {
    events.push("signal");
  });
  const app = new Hono();
  registerApprovalRoutes(app, {
    approvalsRepo: repo,
    recipientsRepo,
    auditLog,
    identitySecret: options.identitySecret,
    signalApprovalDecision: options.signalPort === false ? undefined : signalApprovalDecision,
    nowUnix: () => NOW,
    traceIdProvider: () => "trace-route",
  } satisfies ApprovalRoutesDeps);
  return { app, repo, recipientsRepo, auditLog, signalApprovalDecision, events };
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
    const payload = await response.json();
    expect(payload).toEqual({
      approvals: [
        expect.objectContaining({
          approvalId: APPROVAL_ID,
          canDecide: true,
          decisionDisabledReason: null,
          version: VERSION,
          correlation: signApprovalCardCorrelation(
            { approvalId: APPROVAL_ID, version: VERSION, tenantId: TENANT_ID, objectId: OBJECT_ID },
            SECRET,
          ),
        }),
      ],
    });
    expect(payload.approvals[0]).not.toHaveProperty("expectedVersion");
    expect(repo.listPending).toHaveBeenCalledWith(["change"]);
  });

  it("DevOps:REQ-010 / AC-010a: list capabilityでdecision署名検証を通過してsignalへ到達する", async () => {
    const { app, signalApprovalDecision, events } = setup();
    const listResponse = await app.request("/approvals", { headers: identityHeaders("GET", "/approvals") });
    const listed = (await listResponse.json()).approvals[0] as { version: number; correlation: string };
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = JSON.stringify({
      action: "approval_decision",
      approvalId: APPROVAL_ID,
      version: listed.version,
      correlation: listed.correlation,
      decision: "approved",
    });
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(200);
    expect(signalApprovalDecision).toHaveBeenCalledOnce();
    expect(events).toEqual(["cas", "signal"]);
  });

  it("DevOps:REQ-010: canDecide=falseとlegacy NULL version行にcapabilityを配布しない", async () => {
    const outside = setup({ identitySecret: SECRET, projects: ["PJ-002"] });
    const outsideResponse = await outside.app.request("/approvals", {
      headers: identityHeaders("GET", "/approvals"),
    });
    const outsideApproval = (await outsideResponse.json()).approvals[0] as Record<string, unknown>;
    expect(outsideApproval).not.toHaveProperty("version");
    expect(outsideApproval).not.toHaveProperty("correlation");
    expect(outsideApproval).not.toHaveProperty("expectedVersion");

    const legacy = setup({ identitySecret: SECRET, expectedVersion: null });
    const legacyResponse = await legacy.app.request("/approvals", { headers: identityHeaders("GET", "/approvals") });
    const legacyApproval = (await legacyResponse.json()).approvals[0] as Record<string, unknown>;
    expect(legacyApproval).toMatchObject({
      canDecide: false,
      decisionDisabledReason: "承認情報が不完全なため判断できません。",
    });
    expect(legacyApproval).not.toHaveProperty("version");
    expect(legacyApproval).not.toHaveProperty("correlation");
    expect(legacyApproval).not.toHaveProperty("expectedVersion");
  });

  it("DevOps:REQ-010 / DEC-SPEC-002: PRF-Lは域外行も一覧表示するがdecide不可理由を返す", async () => {
    const { app } = setup({ identitySecret: SECRET, projects: ["PJ-002"] });
    const response = await app.request("/approvals", { headers: identityHeaders("GET", "/approvals") });
    expect(response.status).toBe(200);
    const approval = (await response.json()).approvals[0] as Record<string, unknown>;
    expect(approval).toMatchObject({
      approvalId: APPROVAL_ID,
      canDecide: false,
      decisionDisabledReason: "担当プロジェクト外のため判断できません。",
    });
    expect(approval).not.toHaveProperty("version");
    expect(approval).not.toHaveProperty("correlation");
    expect(approval).not.toHaveProperty("expectedVersion");
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

  it("署名済みcard actionだけをCASし、P3-T03 payloadをCAS後にsignalする", async () => {
    const { app, repo, recipientsRepo, signalApprovalDecision, events } = setup();
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody({
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
      expectedVersion: VERSION,
      traceId: "trace-route",
    });
    expect(signalApprovalDecision).toHaveBeenCalledWith({
      approvalId: APPROVAL_ID,
      version: VERSION,
      decision: "approved",
      approverObjectId: OBJECT_ID,
    });
    expect(events).toEqual(["cas", "signal"]);
    expect(recipientsRepo.canDecideChangeByTrustedSubject).toHaveBeenCalledWith(TENANT_ID, OBJECT_ID, "PJ-001");
  });

  it("reject理由をauthority receiptからP3-T03 signalへ渡す", async () => {
    const { app, signalApprovalDecision, events } = setup();
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody({ decision: "rejected", reason: "risk is too high" });
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(200);
    expect(signalApprovalDecision).toHaveBeenCalledWith({
      approvalId: APPROVAL_ID,
      version: VERSION,
      decision: "rejected",
      approverObjectId: OBJECT_ID,
      reason: "risk is too high",
    });
    expect(events).toEqual(["cas", "signal"]);
  });

  it.each([
    ["域外project", { projects: ["PJ-002"] }],
    ["NULL project", { projectId: null }],
  ])("DevOps:REQ-010 / DEC-SPEC-003: PRF-Lの%sは403で監査する", async (_label, option) => {
    const { app, repo, auditLog } = setup({ identitySecret: SECRET, ...option });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody();
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
    const body = decisionBody();
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
    const firstPayload = await first.json();
    expect(firstPayload).toEqual({
      approvals: [
        expect.objectContaining({
          approvalId: APPROVAL_ID,
          canDecide: true,
          decisionDisabledReason: null,
          version: VERSION,
          correlation: expect.any(String),
        }),
      ],
    });
    expect(firstPayload.approvals[0]).not.toHaveProperty("expectedVersion");
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
    const body = decisionBody();
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
    const missingReason = decisionBody({ decision: "rejected" });
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
    const approved = decisionBody();
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
    const { app, repo, signalApprovalDecision } = setup();
    repo.getById.mockResolvedValueOnce({ ...pending, status: "approved" });
    repo.decide.mockRejectedValueOnce(new ApprovalAlreadyDecidedError(APPROVAL_ID, "approved"));
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody();
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });
    expect(response.status).toBe(409);
    expect(signalApprovalDecision).not.toHaveBeenCalled();
  });

  it("card correlationを押下者identityに束縛し、不一致を一様な403で監査する", async () => {
    const { app, repo, auditLog, signalApprovalDecision } = setup();
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody({}, { tenantId: TENANT_ID, objectId: "33333333-3333-4333-8333-333333333333" });
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "approval forbidden" });
    expect(repo.getById).not.toHaveBeenCalled();
    expect(repo.decide).not.toHaveBeenCalled();
    expect(signalApprovalDecision).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({
        action: "approval_authorization_denied",
        detail: expect.objectContaining({ code: "E-APR-CORRELATION" }),
      }),
    ]);
  });

  it("requested_byと同じEntra subjectによる自己承認を403で監査する", async () => {
    const { app, repo, auditLog, signalApprovalDecision } = setup({
      identitySecret: SECRET,
      requestedBy: OBJECT_ID,
    });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody();
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(403);
    expect(repo.decide).not.toHaveBeenCalled();
    expect(signalApprovalDecision).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({
        action: "approval_authorization_denied",
        detail: expect.objectContaining({ code: "E-APR-SELF-APPROVAL" }),
      }),
    ]);
  });

  it.each([
    ["stale", new ApprovalStaleVersionError(APPROVAL_ID, VERSION), "approval stale"],
    ["expired", new ApprovalExpiredError(APPROVAL_ID), "approval expired"],
  ])("%s cardを409で拒否しsignalしない", async (_label, error, message) => {
    const { app, repo, auditLog, signalApprovalDecision } = setup();
    repo.decide.mockRejectedValueOnce(error);
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody();
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: message });
    expect(signalApprovalDecision).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([expect.objectContaining({ action: "approval_card_decision_rejected" })]);
  });

  it("CAS receiptとapproval authorityのid/version/status不一致をsignal前に拒否する", async () => {
    const { app, repo, auditLog, signalApprovalDecision } = setup();
    repo.decide.mockResolvedValueOnce({
      ...pending,
      status: "approved",
      expectedVersion: VERSION + 1,
      approverTenantId: TENANT_ID,
      approverObjectId: OBJECT_ID,
      decidedAt: "2026-08-08T00:01:00.000Z",
    });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody();
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "approval authority mismatch" });
    expect(signalApprovalDecision).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([expect.objectContaining({ action: "approval_card_decision_rejected" })]);
  });

  it("signal port未結線はCAS前に503でfail closedにする", async () => {
    const { app, repo } = setup({ identitySecret: SECRET, signalPort: false });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody();
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(503);
    expect(repo.decide).not.toHaveBeenCalled();
  });

  it("CAS成功後のsignal障害は503でfail closedにし、外部確定を返さない", async () => {
    const { app, repo, auditLog, signalApprovalDecision, events } = setup();
    signalApprovalDecision.mockImplementationOnce(async () => {
      events.push("signal");
      throw new Error("Temporal unavailable");
    });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody();
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...identityHeaders("POST", path, body) },
      body,
    });

    expect(response.status).toBe(503);
    expect(repo.decide).toHaveBeenCalledOnce();
    expect(events).toEqual(["cas", "signal"]);
    expect(await auditLog.readAll()).toEqual([expect.objectContaining({ action: "approval_signal_failed" })]);
  });

  it.each(["report", "jit_grant"] as const)("未結線approval typeのdecideは403で監査する: %s", async (approvalType) => {
    const { app, repo, auditLog } = setup({ identitySecret: SECRET, approvalType });
    const path = `/approvals/${APPROVAL_ID}/decision`;
    const body = decisionBody();
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
