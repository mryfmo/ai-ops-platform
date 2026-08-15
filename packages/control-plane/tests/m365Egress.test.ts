// 根拠: FinalArch:PRD-007 / FinalArch:WIQ-004 / ADR-0024
import type { OpaDecisionResult, PolicyDecision } from "@aiops/policy";
import { describe, expect, it, vi } from "vitest";

import { routeM365Output, type M365EgressRequest } from "../src/activities/m365Egress.js";

const request: M365EgressRequest = {
  actor: {
    id: "user-1",
    tenantId: "tenant-1",
    projectIds: ["PJ-001"],
  },
  projectId: "PJ-001",
  purpose: "answer a project status question",
  providerCandidate: "bedrock",
  classification: "customer-confidential",
  requestedFields: ["response", "sourceReferences"],
  sourceSystems: ["teams", "sharepoint"],
  environment: "dev",
  output: {
    fields: {
      response: "Minimized project summary",
      conversationId: "conversation-1",
      sourceReferences: [{ system: "teams", objectId: "message-1" }],
      permissionContext: { access: "delegated" },
    },
    provenanceComplete: true,
    summarized: true,
  },
};

function decision(
  overrides: Partial<PolicyDecision> & { obligations?: PolicyDecision["obligations"] } = {},
): OpaDecisionResult {
  return {
    decision: "allow",
    reasons: ["m365_customer_confidential_bedrock"],
    obligations: {
      allowedProvider: "bedrock",
      redactFields: ["conversationId", "permissionContext", "sourceReferences"],
      maxResultBytes: 4_096,
      requireHumanApproval: false,
    },
    policyBundleVersion: "0.2.0",
    ...overrides,
  };
}

describe("M365 output egress checkpoint [FinalArch:WIQ-004] [ADR-0024]", () => {
  it("routes only summarized, obligation-compliant customer-confidential output to Bedrock", async () => {
    const decide = vi.fn(async () => decision());
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(request, { decisionClient: { decide }, dispatch });

    expect(result).toMatchObject({ status: "dispatched", provider: "bedrock" });
    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ id: "user-1", projectIds: ["PJ-001"] }),
        action: {
          name: "egress",
          riskLevel: "L1",
          toolName: "work-iq.m365-intelligence.egress",
          protocol: "llm",
        },
        resource: expect.objectContaining({
          system: "work-iq",
          projectId: "PJ-001",
          classification: "customer-confidential",
          labels: [
            "provenance:complete",
            "requested-field:response",
            "requested-field:sourceReferences",
            "source-system:sharepoint",
            "source-system:teams",
          ],
        }),
        context: expect.objectContaining({ providerCandidate: "bedrock" }),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      provider: "bedrock",
      content: JSON.stringify({ response: "Minimized project summary" }),
    });
  });

  it("sanitizes secrets inside retained fields before LLM dispatch", async () => {
    const secret = ["sk", "ant", "A".repeat(24)].join("-");
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(
      {
        ...request,
        output: {
          ...request.output,
          fields: { ...request.output.fields, response: `Summary ${secret}` },
        },
      },
      { decisionClient: { decide: async () => decision() }, dispatch },
    );

    expect(result.status).toBe("dispatched");
    expect(dispatch).toHaveBeenCalledWith({
      provider: "bedrock",
      content: JSON.stringify({ response: "Summary ***REDACTED:anthropic_api_key***" }),
    });
  });

  it("redacts prohibited metadata recursively inside retained fields", async () => {
    const dispatch = vi.fn(async () => undefined);

    await routeM365Output(
      {
        ...request,
        output: {
          ...request.output,
          fields: {
            ...request.output.fields,
            response: {
              text: "Summary",
              permissionContext: { access: "delegated" },
              nested: {
                conversationId: "conversation-1",
                sourceReferences: [{ objectId: "message-1" }],
                retained: "safe",
              },
            },
          },
        },
      },
      { decisionClient: { decide: async () => decision() }, dispatch },
    );

    expect(dispatch).toHaveBeenCalledWith({
      provider: "bedrock",
      content: JSON.stringify({ response: { text: "Summary", nested: { retained: "safe" } } }),
    });
  });

  it.each(["bedrock", "anthropic"] as const)("never dispatches restricted output to %s", async (providerCandidate) => {
    const decide = vi.fn(async () =>
      decision({
        decision: "deny",
        reasons: ["m365_restricted_no_egress"],
        obligations: { allowedProvider: "none", requireHumanApproval: false },
      }),
    );
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(
      { ...request, classification: "restricted", providerCandidate },
      { decisionClient: { decide }, dispatch },
    );

    expect(result).toEqual({ status: "blocked", code: "E-M365-EGRESS-POLICY" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("keeps restricted output local even if a policy response is accidentally allow", async () => {
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(
      { ...request, classification: "restricted" },
      { decisionClient: { decide: async () => decision() }, dispatch },
    );

    expect(result).toEqual({ status: "blocked", code: "E-M365-EGRESS-POLICY" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("escalates incomplete provenance to customer-confidential before policy", async () => {
    const decide = vi.fn(async () => decision());

    await routeM365Output(
      {
        ...request,
        classification: "internal",
        output: { ...request.output, provenanceComplete: false },
      },
      { decisionClient: { decide }, dispatch: async () => undefined },
    );

    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          classification: "customer-confidential",
          labels: expect.arrayContaining(["provenance:incomplete"]),
        }),
      }),
    );
  });

  it("blocks an unknown classification before policy or LLM dispatch", async () => {
    const decide = vi.fn(async () => decision());
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(
      { ...request, classification: "unknown" },
      { decisionClient: { decide }, dispatch },
    );

    expect(result).toEqual({ status: "blocked", code: "E-M365-EGRESS-INPUT" });
    expect(decide).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("fails closed on a malformed runtime request before policy or LLM dispatch", async () => {
    const decide = vi.fn(async () => decision());
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(undefined as unknown as M365EgressRequest, {
      decisionClient: { decide },
      dispatch,
    });

    expect(result).toEqual({ status: "blocked", code: "E-M365-EGRESS-INPUT" });
    expect(decide).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong provider", decision({ obligations: { ...decision().obligations, allowedProvider: "anthropic" } })],
    ["missing redactions", decision({ obligations: { allowedProvider: "bedrock", maxResultBytes: 4_096 } })],
    [
      "unsupported redaction path",
      decision({ obligations: { ...decision().obligations, redactFields: ["permissionContext.secret"] } }),
    ],
    ["missing size bound", decision({ obligations: { ...decision().obligations, maxResultBytes: undefined } })],
    ["unbounded size", decision({ obligations: { ...decision().obligations, maxResultBytes: 1_000_000 } })],
  ])("blocks customer-confidential output for %s obligation", async (_label, policyDecision) => {
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(request, {
      decisionClient: { decide: async () => policyDecision },
      dispatch,
    });

    expect(result).toEqual({ status: "blocked", code: "E-M365-EGRESS-OBLIGATION" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("blocks unsummarized or oversized customer-confidential output", async () => {
    const dispatch = vi.fn(async () => undefined);
    const deps = { decisionClient: { decide: async () => decision() }, dispatch };

    await expect(
      routeM365Output({ ...request, output: { ...request.output, summarized: false } }, deps),
    ).resolves.toEqual({ status: "blocked", code: "E-M365-EGRESS-OBLIGATION" });
    await expect(
      routeM365Output(
        {
          ...request,
          output: {
            ...request.output,
            fields: { ...request.output.fields, response: "x".repeat(4_097) },
          },
        },
        deps,
      ),
    ).resolves.toEqual({ status: "blocked", code: "E-M365-EGRESS-SIZE" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each([
    decision({ decision: "require_approval" }),
    decision({ decision: "deny" }),
    decision({ errorCode: "E-OPA-MALFORMED" }),
  ])("blocks every non-allow or fail-closed policy result", async (policyDecision) => {
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(request, {
      decisionClient: { decide: async () => policyDecision },
      dispatch,
    });

    expect(result).toEqual({ status: "blocked", code: "E-M365-EGRESS-POLICY" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("blocks a missing policy decision and never dispatches", async () => {
    const dispatch = vi.fn(async () => undefined);

    const result = await routeM365Output(request, {
      decisionClient: {
        decide: async () => {
          throw new Error("OPA unavailable");
        },
      },
      dispatch,
    });

    expect(result).toEqual({ status: "blocked", code: "E-M365-EGRESS-POLICY" });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
