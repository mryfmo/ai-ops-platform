// 根拠: FinalArch:MCP-002 / FinalArch:CON-004 / ADR-0023 / WBS P4-T03
import { describe, expect, it, vi } from "vitest";

import {
  OpaDecisionClient,
  POLICY_BUNDLE_VERSION,
  type FetchLike,
  type PolicyDecisionValue,
  type PolicyInput,
} from "../src/index.js";

const input: PolicyInput = {
  actor: { id: "user-1", type: "human", tenantId: "tenant-1", projectIds: ["project-1"] },
  agent: { id: "gateway-1", kind: "control-api" },
  action: {
    name: "read",
    riskLevel: "L1",
    toolName: "github.repo-investigation.read",
    protocol: "mcp",
  },
  resource: {
    system: "github",
    id: "mryfmo/ai-ops-platform",
    projectId: "project-1",
    classification: "internal",
  },
  context: {
    purpose: "repository investigation",
    environment: "dev",
    providerCandidate: "none",
    sourceTrust: "trusted-platform",
  },
};

function opaResponse(decision: PolicyDecisionValue): Response {
  return Response.json({
    decision_id: "c6a4463d-6559-4d15-a399-bdd1c1f22c10",
    result: {
      decision,
      reasons: [`policy_${decision}`],
      obligations: {
        allowedProvider: "none",
        requireHumanApproval: decision === "require_approval",
      },
      policyBundleVersion: POLICY_BUNDLE_VERSION,
    },
  });
}

describe("OPA decision client [FinalArch:MCP-002]", () => {
  it.each(["allow", "deny", "require_approval"] as const)(
    "returns a validated %s decision with bundle version [FinalArch:MCP-002]",
    async (decision) => {
      const fetchImpl = vi.fn<FetchLike>(async () => opaResponse(decision));
      const client = new OpaDecisionClient({ baseUrl: "http://opa.aiops.internal:8181", fetchImpl });

      await expect(client.decide(input)).resolves.toEqual({
        decision,
        reasons: [`policy_${decision}`],
        obligations: {
          allowedProvider: "none",
          requireHumanApproval: decision === "require_approval",
        },
        policyBundleVersion: POLICY_BUNDLE_VERSION,
        decisionId: "c6a4463d-6559-4d15-a399-bdd1c1f22c10",
      });

      const [url, init] = fetchImpl.mock.calls[0] ?? [];
      expect(url).toBe("http://opa.aiops.internal:8181/v1/data/aiops/policy/decision");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      expect(JSON.parse(String(init?.body))).toEqual({ input });
    },
  );

  it("fails closed on malformed, unknown, or version-drifted responses [FinalArch:MCP-002]", async () => {
    const bodies = [
      { result: { decision: "allow" } },
      {
        result: {
          decision: "allow",
          reasons: [],
          obligations: {},
          policyBundleVersion: "unexpected-version",
        },
      },
      {
        result: {
          decision: "allow",
          reasons: [],
          obligations: {},
          policyBundleVersion: POLICY_BUNDLE_VERSION,
          unexpected: true,
        },
      },
    ];

    for (const body of bodies) {
      const client = new OpaDecisionClient({
        baseUrl: "http://opa.aiops.internal:8181",
        fetchImpl: async () => Response.json(body),
      });
      const result = await client.decide(input);
      expect(result).toMatchObject({
        decision: "deny",
        reasons: ["E-OPA-MALFORMED"],
        policyBundleVersion: POLICY_BUNDLE_VERSION,
        errorCode: "E-OPA-MALFORMED",
      });
    }
  });

  it("times out and retries only the configured finite number of times [FinalArch:MCP-002]", async () => {
    const fetchImpl = vi.fn<FetchLike>(() => new Promise<Response>(() => undefined));
    const client = new OpaDecisionClient({
      baseUrl: "http://opa.aiops.internal:8181",
      fetchImpl,
      timeoutMs: 5,
      maxAttempts: 2,
    });

    await expect(client.decide(input)).resolves.toMatchObject({
      decision: "deny",
      reasons: ["E-OPA-TIMEOUT"],
      policyBundleVersion: POLICY_BUNDLE_VERSION,
      errorCode: "E-OPA-TIMEOUT",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("normalizes repeated 5xx responses to a versioned deny [FinalArch:MCP-002]", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response("unavailable", { status: 503 }));
    const client = new OpaDecisionClient({
      baseUrl: "http://opa.aiops.internal:8181",
      fetchImpl,
      maxAttempts: 2,
    });

    await expect(client.decide(input)).resolves.toMatchObject({
      decision: "deny",
      reasons: ["E-OPA-HTTP"],
      policyBundleVersion: POLICY_BUNDLE_VERSION,
      errorCode: "E-OPA-HTTP",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("normalizes network failure and does not retry a deterministic 4xx [FinalArch:MCP-002]", async () => {
    const networkFetch = vi.fn<FetchLike>(async () => {
      throw new TypeError("connection refused");
    });
    const networkClient = new OpaDecisionClient({
      baseUrl: "http://opa.aiops.internal:8181",
      fetchImpl: networkFetch,
      maxAttempts: 2,
    });
    await expect(networkClient.decide(input)).resolves.toMatchObject({
      decision: "deny",
      errorCode: "E-OPA-NETWORK",
      policyBundleVersion: POLICY_BUNDLE_VERSION,
    });
    expect(networkFetch).toHaveBeenCalledTimes(2);

    const badRequestFetch = vi.fn<FetchLike>(async () => new Response("bad request", { status: 400 }));
    const badRequestClient = new OpaDecisionClient({
      baseUrl: "http://opa.aiops.internal:8181",
      fetchImpl: badRequestFetch,
      maxAttempts: 2,
    });
    await expect(badRequestClient.decide(input)).resolves.toMatchObject({
      decision: "deny",
      errorCode: "E-OPA-HTTP",
      policyBundleVersion: POLICY_BUNDLE_VERSION,
    });
    expect(badRequestFetch).toHaveBeenCalledTimes(1);
  });
});
