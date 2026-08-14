// 根拠: FinalArch:MCP-001 / FinalArch:MCP-002 / FinalArch:MCP-006 / FinalArch:CON-003..005 / ADR-0023 / WBS P4-T04 / P4-T10
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BOUNDED_INVOCATION_PROFILES,
  deriveInvocationContext,
  jsonResultByteLength,
  resolveInvocationProfile,
} from "../src/lib/invocationProfile.js";
import { buildMcpPolicyInput } from "../src/lib/mcpPolicy.js";
import {
  GovernedMcpToolCaller,
  type GovernedMcpToolCallDependencies,
  type GovernedMcpToolCallRequest,
  type ToolPolicyDecision,
} from "../src/mcp/governedToolCall.js";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const INVOCATION_ID = "22222222-2222-4222-8222-222222222222";
const TRACE_ID = "33333333-3333-4333-8333-333333333333";
const FALLBACK_DECISION_ID = "44444444-4444-4444-8444-444444444444";
const DECISION_ID = "55555555-5555-4555-8555-555555555555";
const APPROVAL_ID = "66666666-6666-4666-8666-666666666666";

afterEach(() => vi.useRealTimers());

const request: GovernedMcpToolCallRequest = {
  operationId: OPERATION_ID,
  invocationId: INVOCATION_ID,
  workflowId: "incident/INC-42",
  traceId: TRACE_ID,
  inputHash: "a".repeat(64),
  caller: "claude-runner",
  registryEntry: {
    id: "github-read",
    enabled: true,
    version: "pinned",
    risk: "L1",
    operations: ["read"],
    protocol: "mcp",
    transport: "streamable-http",
    allowed_callers: ["control-plane", "claude-runner"],
  },
  operation: "read",
  policySystem: "github",
  policyToolName: "github.repo-investigation.read",
  actor: {
    id: "user-1",
    type: "human",
    tenantId: "tenant-1",
    projectIds: ["PJ-1"],
  },
  resource: {
    id: "mryfmo/ai-ops-platform",
    projectId: "PJ-1",
    classification: "internal",
    scope: { repository: "mryfmo/ai-ops-platform" },
  },
  context: { purpose: "repository investigation", environment: "dev" },
  invocation: { depth: 0, ancestorOperationIds: [] },
  approval: { version: 1, expiryMs: 60_000 },
  input: { query: "open pull requests" },
};

const decision = (
  value: ToolPolicyDecision["decision"],
  overrides: Partial<ToolPolicyDecision> = {},
): ToolPolicyDecision => ({
  decision: value,
  decisionId: DECISION_ID,
  reasons: [`policy_${value}`],
  obligations: { allowedProvider: "none", requireHumanApproval: value === "require_approval" },
  policyBundleVersion: "0.1.0",
  ...overrides,
});

const approvalRequest = (risk: "L2" | "L3"): GovernedMcpToolCallRequest => ({
  ...request,
  registryEntry: {
    ...request.registryEntry,
    id: "plane-read-draft",
    risk,
    operations: ["draft"],
  },
  operation: "draft",
  policySystem: "plane",
  policyToolName: "plane.draft-work-item.draft",
  resource: {
    ...request.resource,
    id: "PJ-1/WORK-42",
    scope: { project: "PJ-1", workItem: "WORK-42" },
  },
  input: { title: "draft only" },
});

function harness(
  policyDecision: ToolPolicyDecision | Error,
  authorityStatus: "pending" | "approved" | "rejected" = "pending",
  now?: () => number,
) {
  const events: string[] = [];
  const execute = vi.fn(async () => {
    events.push("execute");
    return { ok: true };
  });
  const recordReceipt = vi.fn(async () => {
    events.push("receipt");
  });
  const dependencies: GovernedMcpToolCallDependencies = {
    decisionClient: {
      decide: vi.fn(async () => {
        events.push("decide");
        if (policyDecision instanceof Error) throw policyDecision;
        return policyDecision;
      }),
    },
    policyDecisions: {
      record: vi.fn(async () => {
        events.push("decision-record");
      }),
    },
    actionLedger: {
      plan: vi.fn(async () => {
        events.push("plan");
        return true;
      }),
      updateStatus: vi.fn(async (_operationId, status) => {
        events.push(`status:${status}`);
      }),
      claimExecution: vi.fn(async () => {
        events.push("claim");
        return true;
      }),
    },
    approvals: {
      create: vi.fn(async () => {
        events.push("approval-create");
        return { approvalId: APPROVAL_ID, status: "pending" };
      }),
      getById: vi.fn(async () => {
        events.push("approval-get");
        return { approvalId: APPROVAL_ID, status: authorityStatus };
      }),
    },
    approvalWorkflow: {
      wait: vi.fn(async (approval) => {
        events.push("approval-wait");
        return {
          approvalId: approval.approvalId,
          version: approval.version,
          status: authorityStatus === "pending" ? "expired" : authorityStatus,
        };
      }),
    },
    toolInvocations: { record: recordReceipt },
    execute,
    fallbackDecisionId: () => FALLBACK_DECISION_ID,
    policyBundleVersion: "0.1.0",
    now:
      now ??
      (() => {
        let value = 100;
        return () => (value += 10);
      })(),
  };
  return { caller: new GovernedMcpToolCaller(dependencies), dependencies, events, execute, recordReceipt };
}

describe("P4-T04 governed MCP tool calls [FinalArch:MCP-001]", () => {
  it("maps registry caller/risk and the exact policy binding into PolicyInput", () => {
    expect(buildMcpPolicyInput(request)).toEqual({
      actor: request.actor,
      agent: { id: "claude-runner", kind: "claude-code" },
      action: {
        name: "read",
        riskLevel: "L1",
        toolName: "github.repo-investigation.read",
        protocol: "mcp",
      },
      resource: {
        system: "github",
        id: "mryfmo/ai-ops-platform",
        projectId: "PJ-1",
        classification: "internal",
      },
      context: {
        purpose: "repository investigation",
        environment: "dev",
        providerCandidate: "none",
        sourceTrust: "trusted-platform",
      },
    });
  });

  it("rejects unknown callers and L4-L6 risks at the registry boundary", () => {
    expect(() =>
      buildMcpPolicyInput({
        ...request,
        caller: "rogue-runner",
        registryEntry: { ...request.registryEntry, allowed_callers: ["rogue-runner"] },
      } as unknown as GovernedMcpToolCallRequest),
    ).toThrow(/governed registry caller/u);
    expect(() =>
      buildMcpPolicyInput({
        ...request,
        registryEntry: { ...request.registryEntry, risk: "L4" },
      } as unknown as GovernedMcpToolCallRequest),
    ).toThrow(/L4-L6/u);
  });

  it("allow records the decision before the action claim and persists a versioned success receipt", async () => {
    const h = harness(decision("allow"));
    const receipt = await h.caller.invoke(request);

    expect(receipt).toMatchObject({
      status: "succeeded",
      decision: "allow",
      decisionId: DECISION_ID,
      policyBundleVersion: "0.1.0",
      approvalId: null,
      result: { ok: true },
    });
    expect(h.events).toEqual(["decide", "decision-record", "plan", "claim", "execute", "status:applied", "receipt"]);
    expect(h.recordReceipt).toHaveBeenCalledWith(expect.objectContaining({ policyDecisionId: DECISION_ID }));
    expect(h.execute).toHaveBeenCalledWith("github-read", "read", request.input);
  });

  it("deny records a blocked receipt and never reaches the tool executor", async () => {
    const h = harness(decision("deny"));
    await expect(h.caller.invoke(request)).resolves.toMatchObject({
      status: "blocked",
      decision: "deny",
      errorCode: "E-POLICY-DENY",
      policyBundleVersion: "0.1.0",
    });
    expect(h.execute).not.toHaveBeenCalled();
    expect(h.events).toEqual(["decide", "decision-record", "plan", "status:rejected", "receipt"]);
  });

  it("tool failure records a failed receipt linked to the allow decision", async () => {
    const h = harness(decision("allow"));
    h.execute.mockRejectedValueOnce(new Error("tool unavailable"));

    await expect(h.caller.invoke(request)).resolves.toMatchObject({
      status: "failed",
      decision: "allow",
      decisionId: DECISION_ID,
      policyBundleVersion: "0.1.0",
      errorCode: "E-TOOL-INVOKE",
    });
    expect(h.events).toEqual(["decide", "decision-record", "plan", "claim", "status:failed", "receipt"]);
  });

  it("OPA failure is normalized to a versioned deny with a local decision id", async () => {
    const h = harness(new TypeError("OPA unavailable"));
    await expect(h.caller.invoke(request)).resolves.toMatchObject({
      status: "blocked",
      decision: "deny",
      decisionId: FALLBACK_DECISION_ID,
      policyBundleVersion: "0.1.0",
      errorCode: "E-OPA-NETWORK",
    });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("malformed OPA decision identity is normalized to deny instead of throwing", async () => {
    const h = harness(decision("allow", { decisionId: "not-a-uuid" }));
    await expect(h.caller.invoke(request)).resolves.toMatchObject({
      status: "blocked",
      decision: "deny",
      decisionId: FALLBACK_DECISION_ID,
      errorCode: "E-OPA-MALFORMED",
    });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("require_approval links the approvals authority and workflow before execution", async () => {
    const h = harness(decision("require_approval"), "approved");
    const receipt = await h.caller.invoke(approvalRequest("L2"));

    expect(receipt).toMatchObject({
      status: "succeeded",
      decision: "require_approval",
      approvalId: APPROVAL_ID,
      policyBundleVersion: "0.1.0",
    });
    expect(h.events).toEqual([
      "decide",
      "decision-record",
      "approval-create",
      "plan",
      "status:approval_pending",
      "approval-wait",
      "approval-get",
      "status:approved",
      "claim",
      "execute",
      "status:applied",
      "receipt",
    ]);
    expect(h.dependencies.actionLedger.plan).toHaveBeenCalledWith(expect.objectContaining({ approvalId: APPROVAL_ID }));
  });

  it("require_approval rejection is terminal and cannot execute", async () => {
    const h = harness(decision("require_approval"), "rejected");
    await expect(h.caller.invoke(approvalRequest("L3"))).resolves.toMatchObject({
      status: "blocked",
      approvalId: APPROVAL_ID,
      errorCode: "E-APPROVAL-REJECTED",
    });
    expect(h.execute).not.toHaveBeenCalled();
    expect(h.events).toContain("status:rejected");
  });

  it("approval expiry or authority/workflow mismatch fails closed without auto-approval", async () => {
    const expired = harness(decision("require_approval"), "pending");
    await expect(expired.caller.invoke(approvalRequest("L2"))).resolves.toMatchObject({
      status: "blocked",
      errorCode: "E-APPROVAL-EXPIRED",
    });
    expect(expired.execute).not.toHaveBeenCalled();

    const mismatch = harness(decision("require_approval"), "approved");
    vi.mocked(mismatch.dependencies.approvals.getById).mockResolvedValueOnce({
      approvalId: APPROVAL_ID,
      status: "rejected",
    });
    await expect(mismatch.caller.invoke(approvalRequest("L2"))).resolves.toMatchObject({
      status: "failed",
      errorCode: "E-APPROVAL-MISMATCH",
    });
    expect(mismatch.execute).not.toHaveBeenCalled();
  });

  it("L2/L3 can never execute from an allow decision without the linked approval path", async () => {
    const h = harness(decision("allow"));
    await expect(h.caller.invoke(approvalRequest("L2"))).resolves.toMatchObject({
      status: "blocked",
      decision: "allow",
      errorCode: "E-POLICY-APPROVAL-REQUIRED",
    });
    expect(h.execute).not.toHaveBeenCalled();
    expect(h.events).toEqual(["decide", "decision-record", "plan", "status:rejected", "receipt"]);
  });
});

describe("P4-T10 bounded invocation profile [FinalArch:MCP-006]", () => {
  it("uses deterministic risk profiles and the stricter policy result-size obligation", () => {
    expect(BOUNDED_INVOCATION_PROFILES.L1).toEqual({
      maxResultBytes: 524_288,
      timeoutMs: 20_000,
      maxDepth: 3,
      maxChainLength: 6,
    });
    expect(resolveInvocationProfile("L1", 1_024).maxResultBytes).toBe(1_024);
    expect(resolveInvocationProfile("L1", 999_999).maxResultBytes).toBe(524_288);
    expect(jsonResultByteLength("é")).toBe(4);
    expect(deriveInvocationContext(request)).toEqual({ depth: 1, ancestorOperationIds: [OPERATION_ID] });
  });

  it("discards an oversized result and records a fully correlated failed receipt", async () => {
    const h = harness(decision("allow"));
    h.execute.mockResolvedValueOnce({ payload: "x".repeat(524_288) });

    const receipt = await h.caller.invoke(request);
    expect(receipt).toMatchObject({
      status: "failed",
      errorCode: "E-TOOL-OVERSIZED",
      correlation: {
        traceId: TRACE_ID,
        actorId: "user-1",
        tool: { serverId: "github-read", serverVersion: "pinned", name: "read" },
        resource: { id: "mryfmo/ai-ops-platform", projectId: "PJ-1" },
        result: { status: "failed", errorCode: "E-TOOL-OVERSIZED" },
      },
    });
    expect(receipt).not.toHaveProperty("result");
    expect(h.dependencies.actionLedger.updateStatus).toHaveBeenLastCalledWith(OPERATION_ID, "failed", {
      lastErrorClass: "E-TOOL-OVERSIZED",
    });
  });

  it("times out deterministically and ignores a later successful result", async () => {
    vi.useFakeTimers();
    const h = harness(decision("allow"));
    h.execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ late: true }), 20_001);
        }),
    );

    const pending = h.caller.invoke(request);
    await vi.advanceTimersByTimeAsync(20_000);
    const receipt = await pending;
    expect(receipt).toMatchObject({
      status: "failed",
      errorCode: "E-TOOL-TIMEOUT",
    });
    expect(receipt).not.toHaveProperty("result");
    await vi.advanceTimersByTimeAsync(1);
    expect(h.events).not.toContain("status:applied");
    expect(h.recordReceipt).toHaveBeenCalledTimes(1);
  });

  it("applies the wall-clock limit after synchronous result processing", async () => {
    const timestamps = [0, 100, 20_100, 20_101];
    const h = harness(decision("allow"), "pending", () => timestamps.shift() ?? 20_101);

    await expect(h.caller.invoke(request)).resolves.toMatchObject({
      status: "failed",
      errorCode: "E-TOOL-TIMEOUT",
    });
    expect(h.events).not.toContain("status:applied");
  });

  it.each([
    ["missing context", undefined, "E-TOOL-DEPTH"],
    ["depth", { depth: 4, ancestorOperationIds: [] }, "E-TOOL-DEPTH"],
    [
      "chain",
      { depth: 1, ancestorOperationIds: Array.from({ length: 6 }, (_, index) => `ancestor-${index}`) },
      "E-TOOL-DEPTH",
    ],
    ["recursion", deriveInvocationContext(request), "E-TOOL-RECURSION"],
  ] as const)("blocks %s before tool execution and records the limit result", async (_case, invocation, errorCode) => {
    const h = harness(decision("allow"));
    const boundedRequest = { ...request, invocation } as unknown as GovernedMcpToolCallRequest;

    const receipt = await h.caller.invoke(boundedRequest);
    expect(receipt).toMatchObject({
      status: "failed",
      errorCode,
      correlation: { result: { status: "failed", errorCode } },
    });
    expect(receipt).not.toHaveProperty("result");
    expect(h.execute).not.toHaveBeenCalled();
    expect(h.recordReceipt).toHaveBeenCalledTimes(1);
  });

  it("lets a stricter OPA maxResultBytes obligation override the risk profile", async () => {
    const h = harness(
      decision("allow", {
        obligations: { allowedProvider: "none", requireHumanApproval: false, maxResultBytes: 8 },
      }),
    );
    h.execute.mockResolvedValueOnce({ ok: true });

    const receipt = await h.caller.invoke(request);
    expect(receipt).toMatchObject({
      status: "failed",
      errorCode: "E-TOOL-OVERSIZED",
    });
    expect(receipt).not.toHaveProperty("result");
  });

  it("normalizes a non-positive maxResultBytes obligation to malformed deny", async () => {
    const h = harness(
      decision("allow", {
        obligations: { allowedProvider: "none", requireHumanApproval: false, maxResultBytes: 0 },
      }),
    );

    await expect(h.caller.invoke(request)).resolves.toMatchObject({
      status: "blocked",
      decision: "deny",
      errorCode: "E-OPA-MALFORMED",
    });
    expect(h.execute).not.toHaveBeenCalled();
  });
});
