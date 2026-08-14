/** @vitest-environment jsdom */
/** 根拠: FinalArch:MCP-001 / FinalArch:MCP-003 / FinalArch:MCP-004 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11 */
import { renderToStaticMarkup } from "react-dom/server";
import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";
import { verifyIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";

import { McpOpsView } from "../src/components/views/McpOpsView.js";
import { handleMcpOpsInvocation, handleMcpOpsSummary, type McpOpsClientDeps } from "../src/server/mcpOpsClient.js";
import DashboardLayout from "../src/app/dashboard/layout.js";

const SECRET = "web-bff-identity-secret-of-at-least-32-chars";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const INVOCATION_ID = "33333333-3333-4333-8333-333333333333";
const NOW = 1_786_118_400;
const session = async () =>
  ({
    user: { subject: { tenantId: TENANT_ID, objectId: OBJECT_ID }, roles: [] },
    expires: "2099-01-01",
  }) as Session;

const summary = {
  window: { hours: 24, since: "2026-08-14T00:00:00.000Z" },
  totalInvocations: 4,
  usage: [{ serverId: "github-read", toolName: "read", riskLevel: "L1", status: "succeeded", count: 4 }],
  policy: { totalDecisions: 5, deniedDecisions: 1, denyRatePct: 20 },
  denyReasons: [{ code: "E-POLICY-DENY", count: 1 }],
  errors: [{ code: "E-TOOL-INVOKE", count: 1 }],
  registry: { status: "match" as const, declaredHash: "a".repeat(64), approvedHash: "a".repeat(64) },
};

function deps(
  fetchImpl: typeof fetch,
  authenticated = true,
  identitySecret: string | undefined = SECRET,
): McpOpsClientDeps {
  return {
    getSession: authenticated ? session : async () => null,
    serverBaseUrl: "http://127.0.0.1:8080",
    identitySecret,
    fetchImpl,
    nowUnix: () => NOW,
  };
}

describe("MCP ops Web BFF [FinalArch:MCP-003 / FinalArch:MCP-006]", () => {
  it("session subjectでGETを署名しstrict metadata responseだけを返す", async () => {
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
      return Response.json(summary);
    });

    const response = await handleMcpOpsSummary(deps(fetchImpl));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
  });

  it("未認証/secret未設定はupstreamを呼ばず、raw content付きupstream responseは502で遮断する", async () => {
    const rawSecret = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ ...summary, rawInput: rawSecret }));
    expect((await handleMcpOpsSummary(deps(fetchImpl, false))).status).toBe(401);
    expect((await handleMcpOpsSummary(deps(fetchImpl, true, ""))).status).toBe(503);
    const response = await handleMcpOpsSummary(deps(fetchImpl));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(rawSecret);
  });

  it("invocation idをUUID境界で検証し、safe audit metadataだけを受理する", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        invocationId: INVOCATION_ID,
        workflowId: "workflow-1",
        traceId: "44444444-4444-4444-8444-444444444444",
        actorId: "user-1",
        tool: { serverId: "github-read", serverVersion: "pinned", name: "read", riskLevel: "L1" },
        resource: { id: "repo", projectId: "PJ-001" },
        policy: {
          decisionId: "55555555-5555-4555-8555-555555555555",
          bundleVersion: "0.1.0",
          decision: "allow",
        },
        result: { status: "succeeded", errorClass: null, latencyMs: 12 },
        action: {
          operationId: "66666666-6666-4666-8666-666666666666",
          status: "applied",
          errorClass: null,
        },
      }),
    );
    expect((await handleMcpOpsInvocation("not-a-uuid", deps(fetchImpl))).status).toBe(400);
    expect((await handleMcpOpsInvocation(INVOCATION_ID, deps(fetchImpl))).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("MCP ops dashboard view [FinalArch:MCP-001 / FinalArch:MCP-004]", () => {
  it("deterministic aggregatesとregistry stateを表示し、raw content用slotを持たない", () => {
    const html = renderToStaticMarkup(<McpOpsView summary={summary} audit={null} />);
    expect(html).toContain("MCP Operations");
    expect(html).toContain("20.0%");
    expect(html).toContain("E-POLICY-DENY");
    expect(html).toContain("hash match");
    expect(html).not.toContain("input");
    expect(html).not.toContain("result content");
  });

  it("dashboard navigationからMCP operations pageへ到達できる", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout>
        <div>dashboard</div>
      </DashboardLayout>,
    );
    expect(html).toContain('href="/app/dashboard/mcp-ops"');
  });
});
