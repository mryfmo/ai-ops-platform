/** 根拠: FinalArch:MCP-001 / FinalArch:MCP-003 / FinalArch:MCP-004 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11 */
import { Hono } from "hono";
import { InMemoryAuditLog } from "@aiops/shared";
import { signIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { describe, expect, it, vi } from "vitest";

import { McpOpsForbiddenError, McpOpsRepo } from "../src/db/mcpOpsRepo.js";
import { registryStatusFromText } from "../src/lib/mcpRegistryStatus.js";
import { registerMcpOpsRoutes, type McpOpsRoutesDeps } from "../src/http/routes/mcpOps.js";

const SECRET = "web-bff-identity-secret-of-at-least-32-chars";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const INVOCATION_ID = "33333333-3333-4333-8333-333333333333";
const NOW = 1_786_118_400;
const leader = { profile: "PRF-L", scopeMode: "project" as const, projects: ["PJ-001"] };

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

describe("McpOpsRepo metadata projection [FinalArch:MCP-003 / FinalArch:MCP-006]", () => {
  it("PRF-L scopeを全aggregate SQLへ渡し、raw evidence列をAPI modelへ投影しない", async () => {
    const rawSecret = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            server_id: "github-read",
            tool_name: "read",
            risk_level: "L1",
            status: "succeeded",
            invocation_count: "3",
            input: rawSecret,
            result: `raw-result-${rawSecret}`,
            resource_scope: { content: rawSecret },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { decision: "allow", decision_count: "3" },
          { decision: "deny", decision_count: "1" },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ code: "E-POLICY-DENY", decision_count: "1", reasons: [rawSecret] }] })
      .mockResolvedValueOnce({ rows: [{ code: "E-TOOL-INVOKE", invocation_count: "1", result: rawSecret }] });
    const repo = new McpOpsRepo({ query }, () => new Date("2026-08-15T00:00:00.000Z"));

    const summary = await repo.summaryFor(leader);

    expect(summary).toMatchObject({
      window: { hours: 24, since: "2026-08-14T00:00:00.000Z" },
      totalInvocations: 3,
      policy: { totalDecisions: 4, deniedDecisions: 1, denyRatePct: 25 },
    });
    expect(JSON.stringify(summary)).not.toContain(rawSecret);
    expect(query).toHaveBeenCalledTimes(4);
    for (const [sql, params] of query.mock.calls) {
      expect(String(sql)).toContain("resource ->> 'projectId' = ANY($2::text[])");
      expect(String(sql)).not.toContain("SELECT *");
      expect(params).toEqual([false, ["PJ-001"], "2026-08-14T00:00:00.000Z"]);
    }
    expect(query.mock.calls.map(([sql]) => String(sql)).join("\n")).toContain("E-REDACTED");
  });

  it("scope外roleや不整合scopeをquery前にfail-closedにする", async () => {
    const query = vi.fn();
    const repo = new McpOpsRepo({ query });
    await expect(repo.summaryFor({ profile: "PRF-M", scopeMode: "global", projects: [] })).rejects.toBeInstanceOf(
      McpOpsForbiddenError,
    );
    await expect(repo.summaryFor({ profile: "PRF-L", scopeMode: "global", projects: [] })).rejects.toBeInstanceOf(
      McpOpsForbiddenError,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("invocation auditはtrace/actor/tool/resource/result metadataだけを返し、域外行はSQLで不可視にする", async () => {
    const rawSecret = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          invocation_id: INVOCATION_ID,
          workflow_id: "workflow-1",
          trace_id: "44444444-4444-4444-8444-444444444444",
          actor_id: `actor-${rawSecret}`,
          server_id: "github-read",
          server_version: "pinned",
          tool_name: "read",
          risk_level: "L1",
          resource_id: "mryfmo/ai-ops-platform",
          project_id: "PJ-001",
          decision_id: "55555555-5555-4555-8555-555555555555",
          policy_bundle_version: "0.1.0",
          decision: "allow",
          status: "succeeded",
          error_class: null,
          latency_ms: "12",
          operation_id: "66666666-6666-4666-8666-666666666666",
          action_status: "applied",
          action_error_class: null,
          input_hash: rawSecret,
          resource_scope: { raw: rawSecret },
          result: rawSecret,
        },
      ],
    });

    const audit = await new McpOpsRepo({ query }).findInvocation(leader, INVOCATION_ID);

    expect(audit).toMatchObject({
      invocationId: INVOCATION_ID,
      tool: { serverId: "github-read", serverVersion: "pinned", name: "read", riskLevel: "L1" },
      resource: { id: "mryfmo/ai-ops-platform", projectId: "PJ-001" },
      result: { status: "succeeded", errorClass: null, latencyMs: 12 },
      action: { operationId: "66666666-6666-4666-8666-666666666666", status: "applied", errorClass: null },
    });
    expect(JSON.stringify(audit)).not.toContain(rawSecret);
    expect(String(query.mock.calls[0]![0])).toContain("resource ->> 'projectId' = ANY($2::text[])");
    expect(query.mock.calls[0]![1]).toEqual([false, ["PJ-001"], INVOCATION_ID]);
  });
});

describe("MCP registry drift metadata [FinalArch:MCP-004]", () => {
  const hash = "a".repeat(64);

  it("declared/approved hash一致だけをmatchとし、mismatch/malformedをfail-closedに示す", () => {
    expect(registryStatusFromText(`schema_version: "1.0"\nschema_hash: "${hash}"\nentries: []\n`, `${hash}\n`)).toEqual(
      {
        status: "match",
        declaredHash: hash,
        approvedHash: hash,
      },
    );
    expect(registryStatusFromText(`schema_hash: "${"b".repeat(64)}"\n`, hash).status).toBe("drift");
    expect(registryStatusFromText("schema_hash: malformed\n", hash).status).toBe("drift");
    expect(registryStatusFromText(`schema_hash: "${hash}"\n`, "invalid").status).toBe("unavailable");
  });
});

describe("MCP ops Hono API [FinalArch:MCP-001 / FinalArch:MCP-003]", () => {
  const summary = {
    window: { hours: 24, since: "2026-08-14T00:00:00.000Z" },
    totalInvocations: 0,
    usage: [],
    policy: { totalDecisions: 0, deniedDecisions: 0, denyRatePct: null },
    denyReasons: [],
    errors: [],
  };

  function setup(recipientResults: Array<typeof leader | null>) {
    const auditLog = new InMemoryAuditLog();
    const deps = {
      mcpOpsRepo: {
        summaryFor: vi.fn(async () => summary),
        findInvocation: vi.fn(async () => null),
      },
      recipientsRepo: {
        findActiveByTrustedSubject: vi.fn(async () => recipientResults.shift() ?? null),
      },
      registryStatus: {
        read: vi.fn(async () => ({
          status: "match" as const,
          declaredHash: "a".repeat(64),
          approvedHash: "a".repeat(64),
        })),
      },
      auditLog,
      identitySecret: SECRET,
      nowUnix: () => NOW,
      traceIdProvider: () => "trace-mcp-ops",
    } satisfies McpOpsRoutesDeps;
    const app = new Hono();
    registerMcpOpsRoutes(app, deps);
    return { app, deps, auditLog };
  }

  it("active recipientを毎request再照会し、inactive化後は403でdata repoを呼ばない", async () => {
    const { app, deps, auditLog } = setup([leader, null]);
    const path = "/mcp-ops/summary";
    expect((await app.request(path, { headers: identityHeaders(path) })).status).toBe(200);
    expect((await app.request(path, { headers: identityHeaders(path) })).status).toBe(403);
    expect(deps.recipientsRepo.findActiveByTrustedSubject).toHaveBeenCalledTimes(2);
    expect(deps.mcpOpsRepo.summaryFor).toHaveBeenCalledTimes(1);
    expect(await auditLog.readAll()).toEqual([expect.objectContaining({ action: "mcp_ops_authorization_denied" })]);
  });

  it("署名なしを401、invalid UUIDを400、scope外/不存在invocationを404にする", async () => {
    const { app, deps } = setup([leader, leader]);
    expect((await app.request("/mcp-ops/summary")).status).toBe(401);
    const invalidPath = "/mcp-ops/invocations/not-a-uuid";
    expect((await app.request(invalidPath, { headers: identityHeaders(invalidPath) })).status).toBe(400);
    const path = `/mcp-ops/invocations/${INVOCATION_ID}`;
    expect((await app.request(path, { headers: identityHeaders(path) })).status).toBe(404);
    expect(deps.mcpOpsRepo.findInvocation).toHaveBeenCalledWith(leader, INVOCATION_ID);
  });
});
