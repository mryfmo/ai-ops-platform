/** 根拠: FinalArch:PRD-007 / FinalArch:FR-M365-001..006 / FinalArch:WIQ-002 / ADR-0024 */
import { Hono } from "hono";
import { InMemoryAuditLog } from "@aiops/shared";
import { signIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { describe, expect, it, vi } from "vitest";

import {
  WorkIqOboTokenCache,
  createWorkIqOboTokenProvider,
  type WorkIqOboExchange,
} from "../src/auth/workIqOboTokenProvider.js";
import { registerM365DelegatedRoutes, type M365DelegatedRoutesDeps } from "../src/http/routes/m365Delegated.js";

const SECRET = "m365-delegated-identity-secret-32-chars";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const SUBJECT = "33333333-3333-4333-8333-333333333333";
const OTHER_SUBJECT = "44444444-4444-4444-8444-444444444444";
const NOW = 1_786_118_400;
const PATH = "/m365/query";
const BODY = JSON.stringify({
  question: "What changed?",
  purpose: "project status",
  classification: "internal",
  projectId: "PJ-001",
  allowedSourceTypes: ["teams", "sharepoint"],
});

const validClaims = {
  iss: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
  tid: TENANT_ID,
  aud: "api://workiq.svc.cloud.microsoft",
  sub: SUBJECT,
  scp: "WorkIQAgent.Ask",
};

function identityHeaders(body = BODY, overrides: Record<string, string> = {}) {
  return {
    authorization: "Bearer synthetic-user-assertion",
    "content-type": "application/json",
    "x-aiops-entra-tenant-id": TENANT_ID,
    "x-aiops-entra-object-id": SUBJECT,
    "x-aiops-issued-at": String(NOW),
    "x-aiops-identity-signature": signIdentityEnvelope(
      { method: "POST", path: PATH, body, tenantId: TENANT_ID, objectId: SUBJECT, issuedAtUnix: NOW },
      SECRET,
    ),
    ...overrides,
  };
}

function identityHeadersFor(tenantId: string, objectId: string, body = BODY) {
  return {
    authorization: "Bearer synthetic-user-assertion",
    "content-type": "application/json",
    "x-aiops-entra-tenant-id": tenantId,
    "x-aiops-entra-object-id": objectId,
    "x-aiops-issued-at": String(NOW),
    "x-aiops-identity-signature": signIdentityEnvelope(
      { method: "POST", path: PATH, body, tenantId, objectId, issuedAtUnix: NOW },
      SECRET,
    ),
  };
}

function toolResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function setup(
  options: {
    claims?: unknown;
    decision?: "allow" | "deny" | "require_approval";
    decisionThrows?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const auditLog = new InMemoryAuditLog();
  const exchange = vi.fn(async () => {
    calls.push("claims");
    return {
      accessToken: "synthetic-workiq-token",
      claims: options.claims ?? validClaims,
      expiresAtUnix: NOW + 600,
    };
  });
  const decide = vi.fn(async () => {
    calls.push("opa");
    if (options.decisionThrows) throw new Error("synthetic OPA failure");
    const decision = options.decision ?? "allow";
    return {
      decision,
      reasons: [decision],
      obligations: {
        allowedProvider: "none" as const,
        requireHumanApproval: decision === "require_approval",
      },
      policyBundleVersion: "0.1.0",
      decisionId: "55555555-5555-4555-8555-555555555555",
    };
  });
  const workIqFetch = vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push("client");
    expect(init?.headers).toMatchObject({ authorization: "Bearer synthetic-workiq-token" });
    return toolResponse({
      response: "Synthetic answer",
      conversationId: "synthetic-conversation",
      sourceReferences: [{ system: "work-iq", objectId: "synthetic-message" }],
      permissionContext: { access: "delegated" },
    });
  });
  const deps = {
    recipientsRepo: {
      findActiveByTrustedSubject: vi.fn(async () => {
        calls.push("identity");
        return { profile: "PRF-L", scopeMode: "project" as const, projects: ["PJ-001"] };
      }),
    },
    exchange: { exchange } satisfies WorkIqOboExchange,
    tokenCache: new WorkIqOboTokenCache(),
    decisionClient: { decide },
    workIqFetch,
    auditLog,
    expectedTenantId: TENANT_ID,
    environment: "dev" as const,
    identitySecret: SECRET,
    nowUnix: () => NOW,
    traceIdProvider: () => "trace-m365-query",
  } satisfies M365DelegatedRoutesDeps;
  const app = new Hono();
  registerM365DelegatedRoutes(app, deps);
  return { app, deps, auditLog, calls, exchange, decide, workIqFetch };
}

describe("Control API delegated M365 endpoint [FinalArch:PRD-007] [FinalArch:WIQ-002]", () => {
  it("is fail-disabled until the delegated dependencies and identity secret are wired", async () => {
    const app = new Hono();
    registerM365DelegatedRoutes(app, undefined);

    const response = await app.request(PATH, { method: "POST", body: BODY });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "M365 query disabled", code: "E-M365-DISABLED" });
  });

  it("fixes the successful order at identity -> claims -> OPA -> Work IQ client", async () => {
    const { app, deps, calls, exchange, workIqFetch } = setup();

    const response = await app.request(PATH, { method: "POST", headers: identityHeaders(), body: BODY });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: {
        response: "Synthetic answer",
        conversationId: "synthetic-conversation",
        sourceReferences: [{ system: "work-iq", objectId: "synthetic-message" }],
        permissionContext: { access: "delegated" },
        provenanceComplete: true,
      },
    });
    expect(calls).toEqual(["identity", "claims", "opa", "client"]);
    expect(exchange).toHaveBeenCalledWith({
      userAssertion: "synthetic-user-assertion",
      subject: SUBJECT,
      tenantId: TENANT_ID,
      scopes: ["WorkIQAgent.Ask"],
      resourceAudience: "api://workiq.svc.cloud.microsoft",
    });
    expect(deps.decisionClient.decide).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ id: SUBJECT, tenantId: TENANT_ID }),
        action: { name: "ask", riskLevel: "L1", toolName: "work-iq.m365-intelligence.ask", protocol: "mcp" },
        resource: expect.objectContaining({ classification: "internal" }),
      }),
    );
    expect(workIqFetch).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it("treats project and source declarations as purpose context, not an ask authorization boundary", async () => {
    const { app, decide, workIqFetch } = setup();

    const response = await app.request(PATH, { method: "POST", headers: identityHeaders(), body: BODY });

    expect(response.status).toBe(200);
    const input = decide.mock.calls[0]?.[0];
    expect(input?.actor).not.toHaveProperty("projectIds");
    expect(input?.resource).toEqual({ system: "work-iq", id: "delegated-m365-ask", classification: "internal" });
    expect(JSON.parse(input?.context.purpose ?? "")).toEqual({
      declaredPurpose: "project status",
      declaredProjectContext: "PJ-001",
      declaredSourceContext: ["teams", "sharepoint"],
    });
    const request = JSON.parse(String(workIqFetch.mock.calls[0]?.[1]?.body)) as {
      params: { arguments: { question: string } };
    };
    expect(request.params.arguments.question).toBe("What changed?");
  });

  it("denies an invalid identity before OBO, OPA, or client dispatch", async () => {
    const { app, calls, exchange, decide, workIqFetch } = setup();

    const response = await app.request(PATH, {
      method: "POST",
      headers: identityHeaders(BODY, { "x-aiops-identity-signature": "sha256=bad" }),
      body: BODY,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication required", code: "E-M365-IDENTITY" });
    expect(calls).toEqual([]);
    expect(exchange).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(workIqFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong tenant", { ...validClaims, tid: OTHER_TENANT_ID }],
    ["wrong audience", { ...validClaims, aud: "https://graph.microsoft.com" }],
    ["wrong subject", { ...validClaims, sub: OTHER_SUBJECT }],
    ["app-only", { ...validClaims, scp: undefined, roles: ["WorkIQAgent.Ask"] }],
  ])("denies %s claims before OPA or client dispatch", async (_label, claims) => {
    const { app, auditLog, calls, decide, workIqFetch } = setup({ claims });

    const response = await app.request(PATH, { method: "POST", headers: identityHeaders(), body: BODY });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "M365 query forbidden", code: "E-M365-CLAIMS" });
    expect(calls).toEqual(["identity", "claims"]);
    expect(decide).not.toHaveBeenCalled();
    expect(workIqFetch).not.toHaveBeenCalled();
    const events = await auditLog.readAll();
    expect(events).toEqual([
      expect.objectContaining({ action: "m365_authorization_denied", detail: { code: "E-M365-CLAIMS" } }),
    ]);
    expect(JSON.stringify(events)).not.toContain("synthetic-workiq-token");
  });

  it("denies a valid envelope from the wrong configured tenant before OBO or OPA", async () => {
    const { app, auditLog, exchange, decide, workIqFetch } = setup();

    const response = await app.request(PATH, {
      method: "POST",
      headers: identityHeadersFor(OTHER_TENANT_ID, SUBJECT),
      body: BODY,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "M365 query forbidden", code: "E-M365-CLAIMS" });
    expect(exchange).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(workIqFetch).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({ action: "m365_authorization_denied", detail: { code: "E-M365-CLAIMS" } }),
    ]);
  });

  it.each([
    ["deny", false, "E-M365-POLICY-DENY"],
    ["require_approval", false, "E-M365-POLICY-APPROVAL"],
    ["allow", true, "E-M365-POLICY-FAILURE"],
  ] as const)("fails closed for OPA %s without Work IQ dispatch", async (decision, decisionThrows, code) => {
    const { app, auditLog, calls, workIqFetch } = setup({ decision, decisionThrows });

    const response = await app.request(PATH, { method: "POST", headers: identityHeaders(), body: BODY });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "M365 query forbidden", code });
    expect(calls).toEqual(["identity", "claims", "opa"]);
    expect(workIqFetch).not.toHaveBeenCalled();
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({ action: "m365_policy_denied", detail: expect.objectContaining({ code }) }),
    ]);
  });
});

describe("Work IQ OBO provider cache [FinalArch:FR-M365-001] [ADR-0024]", () => {
  it("isolates cached tokens by subject and tenant while binding the exact scope and resource", async () => {
    const cache = new WorkIqOboTokenCache();
    const exchange = {
      exchange: vi.fn(async ({ subject, tenantId }) => ({
        accessToken: `synthetic-${tenantId}-${subject}`,
        claims: {
          ...validClaims,
          iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
          tid: tenantId,
          sub: subject,
        },
        expiresAtUnix: NOW + 600,
      })),
    } satisfies WorkIqOboExchange;
    const provider = (tenantId: string, subject: string) =>
      createWorkIqOboTokenProvider({
        exchange,
        cache,
        userAssertion: "synthetic-user-assertion",
        tenantId,
        subject,
        nowUnix: () => NOW,
      });

    await provider(TENANT_ID, SUBJECT).getToken();
    await provider(TENANT_ID, SUBJECT).getToken();
    await provider(TENANT_ID, OTHER_SUBJECT).getToken();
    await provider(OTHER_TENANT_ID, SUBJECT).getToken();

    expect(exchange.exchange).toHaveBeenCalledTimes(3);
    for (const [input] of exchange.exchange.mock.calls) {
      expect(input).toMatchObject({
        scopes: ["WorkIQAgent.Ask"],
        resourceAudience: "api://workiq.svc.cloud.microsoft",
      });
    }
  });

  it("expires at the lesser of five minutes and token expiry minus 120 seconds", async () => {
    let now = NOW;
    let exchangeCalls = 0;
    const exchange = {
      exchange: vi.fn(async () => ({
        accessToken: `synthetic-workiq-token-${++exchangeCalls}`,
        claims: validClaims,
        expiresAtUnix: NOW + 1_000,
      })),
    } satisfies WorkIqOboExchange;
    const provider = createWorkIqOboTokenProvider({
      exchange,
      cache: new WorkIqOboTokenCache(),
      userAssertion: "synthetic-user-assertion",
      tenantId: TENANT_ID,
      subject: SUBJECT,
      nowUnix: () => now,
    });

    await provider.getToken();
    now = NOW + 299;
    await provider.getToken();
    now = NOW + 300;
    await provider.getToken();

    expect(exchange.exchange).toHaveBeenCalledTimes(2);
  });
});
