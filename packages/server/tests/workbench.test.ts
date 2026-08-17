/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 */
import { Hono } from "hono";
import { InMemoryAuditLog } from "@aiops/shared";
import { signIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchForbiddenError, WorkbenchRepo } from "../src/db/workbenchRepo.js";
import {
  createWorkbenchPolicyDependencies,
  registerWorkbenchRoutes,
  type WorkbenchRoutesDeps,
} from "../src/http/routes/workbench.js";

const SECRET = "workbench-identity-secret-of-at-least-32-chars";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const NOW = 1_786_118_400;
const POLICY_VERSION = "0.2.0";
const DECISION_ID = "77777777-7777-4777-8777-777777777777";
const leader = {
  userId: "leader-1",
  profile: "PRF-L",
  persona: "leader",
  email: "leader@example.test",
  projects: ["PJ-001"],
  scopeMode: "project" as const,
  language: "ja" as const,
  active: true,
  teamsTeamId: null,
  teamsChannelId: null,
};

const repoWorkspace = {
  workspaceId: WORKSPACE_ID,
  kind: "project" as const,
  projectId: "PJ-001",
  ownerUserId: "leader-1",
  createdAt: "2026-08-16T00:00:00.000Z",
  sources: [
    {
      sourceRefId: "44444444-4444-4444-8444-444444444444",
      sourceSystem: "github" as const,
      sourceType: "repository",
      externalId: "mryfmo/ai-ops-platform",
      canonicalUrl: "https://github.com/mryfmo/ai-ops-platform",
    },
  ],
  runs: [
    {
      workflowId: "incident/inc-1",
      runId: "run-1",
      workflowType: "incident",
      status: "running",
      currentStep: "triage",
      updatedAt: "2026-08-16T00:01:00.000Z",
    },
  ],
  pendingActions: [
    {
      operationId: "55555555-5555-4555-8555-555555555555",
      approvalId: "66666666-6666-4666-8666-666666666666",
      workflowId: "incident/inc-1",
      actionStatus: "approval_pending",
      approvalStatus: "pending",
    },
  ],
  grant: { resourceType: "project" as const, resourceId: "PJ-001" },
};

const workspace = {
  ...repoWorkspace,
  grant: { ...repoWorkspace.grant, policyBundleVersion: POLICY_VERSION, decisionId: DECISION_ID },
};

function identityHeaders(path: string) {
  return {
    "x-aiops-entra-tenant-id": TENANT_ID,
    "x-aiops-entra-object-id": OBJECT_ID,
    "x-aiops-issued-at": String(NOW),
    "x-aiops-identity-signature": signIdentityEnvelope(
      { method: "GET", path, body: "", tenantId: TENANT_ID, objectId: OBJECT_ID, issuedAtUnix: NOW },
      SECRET,
    ),
  };
}

describe("WorkbenchRepo scoped projection [FinalArch:FR-UI-004 / UX-003]", () => {
  it("applies project scope in SQL and drops unselected content fields", async () => {
    const marker = "raw-source-or-workflow-content";
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          workspace_id: WORKSPACE_ID,
          kind: "project",
          project_id: "PJ-001",
          owner_user_id: "leader-1",
          created_at: "2026-08-16T00:00:00.000Z",
          sources: workspace.sources,
          runs: workspace.runs,
          pending_actions: workspace.pendingActions,
          grant_resource_type: "project",
          grant_resource_id: "PJ-001",
          content: marker,
          workflow_payload: marker,
          action_payload: marker,
        },
      ],
    });

    const result = await new WorkbenchRepo({ query }).findByIdFor(leader, WORKSPACE_ID);

    expect(result).toEqual(repoWorkspace);
    expect(JSON.stringify(result)).not.toContain(marker);
    const [sql, params] = query.mock.calls[0]!;
    expect(String(sql)).toContain("w.project_id = ANY($2::text[])");
    expect(String(sql)).toContain("FROM grants g");
    expect(String(sql)).toContain("g.revoked_at IS NULL");
    expect(String(sql)).toContain("g.expires_at > now()");
    expect(String(sql)).not.toContain("SELECT *");
    expect(params).toEqual([
      false,
      ["PJ-001"],
      WORKSPACE_ID,
      "leader-1",
      "workbench:project:",
      "workbench:repository:",
      "workbench:space:",
    ]);
  });

  it("rejects inconsistent global/project recipient scope before querying", async () => {
    const query = vi.fn();
    const repo = new WorkbenchRepo({ query });

    await expect(
      repo.findByIdFor({ userId: "leader-1", profile: "PRF-L", scopeMode: "global", projects: [] }, WORKSPACE_ID),
    ).rejects.toBeInstanceOf(WorkbenchForbiddenError);
    await expect(
      repo.findByIdFor(
        { userId: "leader-1", profile: "PRF-G", scopeMode: "global", projects: ["PJ-001"] },
        WORKSPACE_ID,
      ),
    ).rejects.toBeInstanceOf(WorkbenchForbiddenError);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects secret-shaped source metadata before persistence", async () => {
    const query = vi.fn();
    const secret = ["abcdefghijkl", "mnopqrstuvwx"].join("");
    await expect(
      new WorkbenchRepo({ query }).addSource({
        sourceRefId: "44444444-4444-4444-8444-444444444444",
        workspaceId: WORKSPACE_ID,
        sourceSystem: "github",
        sourceType: "repository",
        externalId: `api_key=${secret}`,
        canonicalUrl: "https://github.com/mryfmo/ai-ops-platform",
      }),
    ).rejects.toThrow("Workbench reference metadata contains a secret");
    expect(query).not.toHaveBeenCalled();
  });
});

describe("Workbench Hono API [FinalArch:FR-UI-003 / FinalArch:FR-UI-004]", () => {
  function setup(
    recipientResults: Array<typeof leader | null>,
    workspaceResults: Array<typeof repoWorkspace | null> = [repoWorkspace],
    decision: "allow" | "deny" | "require_approval" = "allow",
  ) {
    const auditLog = new InMemoryAuditLog();
    const deps = {
      workbenchRepo: { findByIdFor: vi.fn(async () => workspaceResults.shift() ?? null) },
      recipientsRepo: {
        findActiveByTrustedSubject: vi.fn(async () => recipientResults.shift() ?? null),
      },
      decisionClient: {
        decide: vi.fn(async () => ({
          decision,
          reasons: [decision],
          obligations: { allowedProvider: "none" as const, requireHumanApproval: false },
          policyBundleVersion: POLICY_VERSION,
          decisionId: DECISION_ID,
        })),
      },
      environment: "dev" as const,
      auditLog,
      identitySecret: SECRET,
      nowUnix: () => NOW,
      traceIdProvider: () => "trace-workbench",
    } satisfies WorkbenchRoutesDeps;
    const app = new Hono();
    registerWorkbenchRoutes(app, deps);
    return { app, deps, auditLog };
  }

  it("re-resolves active recipient per request and stops after deactivation", async () => {
    const { app, deps, auditLog } = setup([leader, null], [repoWorkspace, repoWorkspace]);
    const path = `/workbench/workspaces/${WORKSPACE_ID}`;

    expect((await app.request(path, { headers: identityHeaders(path) })).status).toBe(200);
    const inactive = await app.request(path, { headers: identityHeaders(path) });
    expect(inactive.status).toBe(404);
    expect(await inactive.json()).toEqual({ error: "workspace not found" });
    expect(deps.recipientsRepo.findActiveByTrustedSubject).toHaveBeenCalledTimes(2);
    expect(deps.workbenchRepo.findByIdFor).toHaveBeenCalledTimes(1);
    expect(deps.decisionClient.decide).toHaveBeenCalledTimes(1);
    expect(await auditLog.readAll()).toEqual([expect.objectContaining({ action: "workbench_authorization_denied" })]);
  });

  it("returns 401 without identity, 400 for invalid UUID, and one 404 for missing or out-of-scope", async () => {
    const { app, deps } = setup([leader], [null]);
    expect((await app.request(`/workbench/workspaces/${WORKSPACE_ID}`)).status).toBe(401);
    expect((await app.request("/workbench/workspaces/not-a-uuid")).status).toBe(400);
    const path = `/workbench/workspaces/${WORKSPACE_ID}`;
    expect((await app.request(path, { headers: identityHeaders(path) })).status).toBe(404);
    expect(deps.workbenchRepo.findByIdFor).toHaveBeenCalledWith(leader, WORKSPACE_ID);
    expect(deps.decisionClient.decide).not.toHaveBeenCalled();

    const invalidScope = setup([leader]);
    invalidScope.deps.workbenchRepo.findByIdFor.mockRejectedValueOnce(new WorkbenchForbiddenError());
    const forbidden = await invalidScope.app.request(path, { headers: identityHeaders(path) });
    expect(forbidden.status).toBe(404);
    expect(await forbidden.json()).toEqual({ error: "workspace not found" });
  });

  it("passes the SQL-resolved grant to OPA and returns its versioned grant state", async () => {
    const { app, deps } = setup([leader]);
    const path = `/workbench/workspaces/${WORKSPACE_ID}`;

    const response = await app.request(path, { headers: identityHeaders(path) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(workspace);
    expect(deps.decisionClient.decide).toHaveBeenCalledWith({
      actor: {
        id: "leader-1",
        type: "human",
        tenantId: TENANT_ID,
        projectIds: ["PJ-001"],
      },
      agent: { id: "workbench-bff", kind: "web-workbench" },
      action: { name: "read", riskLevel: "L0", protocol: "ui" },
      resource: {
        system: "workbench",
        id: "workbench:project:PJ-001",
        projectId: "PJ-001",
        classification: "internal",
        labels: ["capability-grant:active", "recipient-scope:project", `workspace-id:${WORKSPACE_ID}`],
      },
      context: {
        purpose: "workbench workspace read",
        environment: "dev",
        providerCandidate: "none",
        sourceTrust: "trusted-platform",
      },
    });
  });

  it("fails closed on OPA deny and re-queries grants so revoke becomes immediately invisible", async () => {
    const denied = setup([leader], [repoWorkspace], "deny");
    const path = `/workbench/workspaces/${WORKSPACE_ID}`;
    expect((await denied.app.request(path, { headers: identityHeaders(path) })).status).toBe(404);

    const revoked = setup([leader, leader], [repoWorkspace, null]);
    expect((await revoked.app.request(path, { headers: identityHeaders(path) })).status).toBe(200);
    expect((await revoked.app.request(path, { headers: identityHeaders(path) })).status).toBe(404);
    expect(revoked.deps.workbenchRepo.findByIdFor).toHaveBeenCalledTimes(2);
    expect(revoked.deps.decisionClient.decide).toHaveBeenCalledTimes(1);
  });

  it("fails closed when OPA is unavailable or not wired", async () => {
    const path = `/workbench/workspaces/${WORKSPACE_ID}`;
    const unavailable = setup([leader]);
    unavailable.deps.decisionClient.decide.mockRejectedValueOnce(new Error("synthetic OPA outage"));
    expect((await unavailable.app.request(path, { headers: identityHeaders(path) })).status).toBe(404);

    const disabled = setup([leader]);
    const disabledApp = new Hono();
    registerWorkbenchRoutes(disabledApp, { ...disabled.deps, decisionClient: undefined });
    expect((await disabledApp.request(path, { headers: identityHeaders(path) })).status).toBe(404);
  });

  it("wires an enforced OPA client into the route composition and reaches 200", async () => {
    const policyFetch = vi.fn<typeof fetch>(async () =>
      Response.json({
        result: {
          decision: "allow",
          reasons: ["workbench_explicit_capability_grant"],
          obligations: { allowedProvider: "none", requireHumanApproval: false },
          policyBundleVersion: POLICY_VERSION,
          decisionId: DECISION_ID,
        },
      }),
    );
    const policyDeps = createWorkbenchPolicyDependencies({
      enforce: true,
      baseUrl: "http://opa.aiops.internal:8181",
      environment: "dev",
      fetchImpl: policyFetch,
    });
    const composed = setup([leader]);
    const app = new Hono();
    registerWorkbenchRoutes(app, { ...composed.deps, ...policyDeps });
    const path = `/workbench/workspaces/${WORKSPACE_ID}`;

    const response = await app.request(path, { headers: identityHeaders(path) });

    expect(response.status).toBe(200);
    expect(policyFetch).toHaveBeenCalledOnce();
    expect(String(policyFetch.mock.calls[0]?.[0])).toBe("http://opa.aiops.internal:8181/v1/data/aiops/policy/decision");
  });
});
