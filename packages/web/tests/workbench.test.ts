/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 */
import type { Session } from "next-auth";
import { verifyIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { describe, expect, it, vi } from "vitest";

import { handleWorkbenchWorkspace, type WorkbenchClientDeps } from "../src/server/workbenchClient.js";

const SECRET = "workbench-identity-secret-of-at-least-32-chars";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const NOW = 1_786_118_400;
const session = async () =>
  ({
    user: { subject: { tenantId: TENANT_ID, objectId: OBJECT_ID }, roles: [] },
    expires: "2099-01-01",
  }) as Session;

const workspace = {
  workspaceId: WORKSPACE_ID,
  kind: "project",
  projectId: "PJ-001",
  ownerUserId: "leader-1",
  createdAt: "2026-08-16T00:00:00.000Z",
  sources: [
    {
      sourceRefId: "44444444-4444-4444-8444-444444444444",
      sourceSystem: "github",
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
};

function deps(fetchImpl: typeof fetch, authenticated = true, identitySecret = SECRET): WorkbenchClientDeps {
  return {
    getSession: authenticated ? session : async () => null,
    serverBaseUrl: "http://127.0.0.1:8080",
    identitySecret,
    fetchImpl,
    nowUnix: () => NOW,
  };
}

describe("Workbench Web BFF [FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / UX-003]", () => {
  it("signs the workspace GET with the session subject and returns the strict reference model", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      const headers = new Headers(init?.headers);
      expect(
        verifyIdentityEnvelope(
          { method: "GET", path, body: "", tenantId: TENANT_ID, objectId: OBJECT_ID, issuedAtUnix: NOW },
          headers.get("x-aiops-identity-signature"),
          SECRET,
          NOW,
        ),
      ).toBe(true);
      return Response.json(workspace);
    });

    const response = await handleWorkbenchWorkspace(WORKSPACE_ID, deps(fetchImpl));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(workspace);
  });

  it("blocks unauthenticated/disabled/invalid requests before fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect((await handleWorkbenchWorkspace(WORKSPACE_ID, deps(fetchImpl, false))).status).toBe(401);
    expect((await handleWorkbenchWorkspace(WORKSPACE_ID, deps(fetchImpl, true, ""))).status).toBe(503);
    expect((await handleWorkbenchWorkspace("not-a-uuid", deps(fetchImpl))).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an upstream content field and preserves a fixed upstream 404", async () => {
    const marker = "raw-source-content";
    const leakyFetch = vi.fn<typeof fetch>(async () => Response.json({ ...workspace, sourceContent: marker }));
    const invalid = await handleWorkbenchWorkspace(WORKSPACE_ID, deps(leakyFetch));
    expect(invalid.status).toBe(502);
    expect(await invalid.text()).not.toContain(marker);

    const missingFetch = vi.fn<typeof fetch>(async () => Response.json({ error: marker }, { status: 404 }));
    const missing = await handleWorkbenchWorkspace(WORKSPACE_ID, deps(missingFetch));
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain(marker);
  });
});
