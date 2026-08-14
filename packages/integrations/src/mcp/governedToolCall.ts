// 根拠: FinalArch:MCP-001 / FinalArch:MCP-002 / FinalArch:CON-003..005 / ADR-0023 / WBS P4-T04
import {
  buildMcpPolicyInput,
  type GovernedMcpToolCallRequest,
  type McpPolicyInput,
  type McpToolRisk,
} from "../lib/mcpPolicy.js";

export type { GovernedMcpToolCallRequest } from "../lib/mcpPolicy.js";

export type ToolPolicyDecisionValue = "allow" | "deny" | "require_approval";
export interface ToolPolicyDecision {
  decision: ToolPolicyDecisionValue;
  reasons: string[];
  obligations: Record<string, unknown>;
  policyBundleVersion: string;
  decisionId?: string;
  errorCode?: string;
}

type ActionStatus = "approval_pending" | "approved" | "applied" | "rejected" | "failed";
type ApprovalStatus = "pending" | "approved" | "rejected";
type ReceiptStatus = "succeeded" | "blocked" | "failed";

export interface GovernedMcpToolCallDependencies {
  decisionClient: { decide(input: McpPolicyInput): Promise<ToolPolicyDecision> };
  policyDecisions: {
    record(input: {
      decisionId: string;
      workflowId: string | null;
      actorId: string;
      action: string;
      resource: unknown;
      inputHash: string;
      policyBundleVersion: string;
      decision: ToolPolicyDecisionValue;
      reasons: unknown[];
      obligations: unknown;
      traceId: string;
    }): Promise<void>;
  };
  actionLedger: {
    plan(input: {
      operationId: string;
      workflowId: string;
      system: string;
      operation: string;
      resourceKey: string;
      inputHash: string;
      approvalId: string | null;
      deploymentId: null;
      traceId: string;
    }): Promise<boolean>;
    updateStatus(operationId: string, status: ActionStatus, fields?: { lastErrorClass?: string | null }): Promise<void>;
    claimExecution(operationId: string): Promise<boolean>;
  };
  approvals: {
    create(input: {
      approvalType: "change";
      targetId: string;
      projectId?: string;
      requestedBy: string;
      traceId: string;
    }): Promise<{ approvalId: string; status: ApprovalStatus }>;
    getById(approvalId: string): Promise<{ approvalId: string; status: ApprovalStatus } | null>;
  };
  approvalWorkflow: {
    wait(input: {
      approvalId: string;
      version: number;
      expiryMs: number;
      requestedBy: string;
    }): Promise<{ approvalId: string; version: number; status: "approved" | "rejected" | "expired" }>;
  };
  toolInvocations: {
    record(input: {
      invocationId: string;
      workflowId: string | null;
      serverId: string;
      serverVersion: string;
      toolName: string;
      riskLevel: McpToolRisk;
      resourceScope: unknown;
      policyDecisionId: string;
      approvalId: string | null;
      latencyMs: number;
      status: ReceiptStatus;
      errorClass: string | null;
      traceId: string;
    }): Promise<void>;
  };
  execute(serverId: string, toolName: string, input: unknown): Promise<unknown>;
  fallbackDecisionId(): string;
  policyBundleVersion: string;
  now?: () => number;
}

export interface ToolInvocationReceipt<T = unknown> {
  invocationId: string;
  operationId: string;
  status: ReceiptStatus;
  decision: ToolPolicyDecisionValue;
  decisionId: string;
  policyBundleVersion: string;
  approvalId: string | null;
  errorCode: string | null;
  result?: T;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isDecision(value: unknown): value is ToolPolicyDecision {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const decision = value as Partial<ToolPolicyDecision>;
  return (
    (decision.decision === "allow" || decision.decision === "deny" || decision.decision === "require_approval") &&
    Array.isArray(decision.reasons) &&
    decision.reasons.every((reason) => typeof reason === "string") &&
    typeof decision.obligations === "object" &&
    decision.obligations !== null &&
    !Array.isArray(decision.obligations) &&
    typeof decision.policyBundleVersion === "string" &&
    (decision.decisionId === undefined || (typeof decision.decisionId === "string" && UUID.test(decision.decisionId)))
  );
}

export class GovernedMcpToolCaller {
  private readonly now: () => number;

  constructor(private readonly dependencies: GovernedMcpToolCallDependencies) {
    this.now = dependencies.now ?? Date.now;
    if (!dependencies.policyBundleVersion) throw new TypeError("policyBundleVersion is required");
  }

  async invoke<T = unknown>(request: GovernedMcpToolCallRequest): Promise<ToolInvocationReceipt<T>> {
    const startedAt = this.now();
    const input = buildMcpPolicyInput(request);
    const decision = await this.decide(input);

    await this.dependencies.policyDecisions.record({
      decisionId: decision.decisionId,
      workflowId: request.workflowId,
      actorId: request.actor.id,
      action: request.operation,
      resource: input.resource,
      inputHash: request.inputHash,
      policyBundleVersion: decision.policyBundleVersion,
      decision: decision.decision,
      reasons: decision.reasons,
      obligations: decision.obligations,
      traceId: request.traceId,
    });

    let approvalId: string | null = null;
    if (decision.decision === "require_approval") {
      const approval = await this.dependencies.approvals.create({
        approvalType: "change",
        targetId: `mcp:${request.operationId}`,
        ...(request.resource.projectId === undefined ? {} : { projectId: request.resource.projectId }),
        requestedBy: request.actor.id,
        traceId: request.traceId,
      });
      approvalId = approval.approvalId;
    }

    const planned = await this.dependencies.actionLedger.plan({
      operationId: request.operationId,
      workflowId: request.workflowId,
      system: request.registryEntry.id,
      operation: request.operation,
      resourceKey: request.resource.id,
      inputHash: request.inputHash,
      approvalId,
      deploymentId: null,
      traceId: request.traceId,
    });
    if (!planned) return this.receipt(request, decision, approvalId, "blocked", "E-ACTION-DUPLICATE", startedAt);

    if (decision.decision === "deny") {
      const errorCode = decision.errorCode ?? "E-POLICY-DENY";
      await this.dependencies.actionLedger.updateStatus(request.operationId, "rejected", { lastErrorClass: errorCode });
      return this.receipt(request, decision, null, "blocked", errorCode, startedAt);
    }

    if (
      (request.registryEntry.risk === "L2" || request.registryEntry.risk === "L3") &&
      decision.decision !== "require_approval"
    ) {
      await this.dependencies.actionLedger.updateStatus(request.operationId, "rejected", {
        lastErrorClass: "E-POLICY-APPROVAL-REQUIRED",
      });
      return this.receipt(request, decision, null, "blocked", "E-POLICY-APPROVAL-REQUIRED", startedAt);
    }

    if (decision.decision === "require_approval") {
      if (decision.obligations.requireHumanApproval !== true || approvalId === null) {
        await this.dependencies.actionLedger.updateStatus(request.operationId, "failed", {
          lastErrorClass: "E-POLICY-APPROVAL-OBLIGATION",
        });
        return this.receipt(request, decision, approvalId, "failed", "E-POLICY-APPROVAL-OBLIGATION", startedAt);
      }
      await this.dependencies.actionLedger.updateStatus(request.operationId, "approval_pending");
      const outcome = await this.dependencies.approvalWorkflow.wait({
        approvalId,
        version: request.approval.version,
        expiryMs: request.approval.expiryMs,
        requestedBy: request.actor.id,
      });
      const authority = await this.dependencies.approvals.getById(approvalId);
      if (outcome.status === "expired" && authority?.status === "pending") {
        await this.dependencies.actionLedger.updateStatus(request.operationId, "failed", {
          lastErrorClass: "E-APPROVAL-EXPIRED",
        });
        return this.receipt(request, decision, approvalId, "blocked", "E-APPROVAL-EXPIRED", startedAt);
      }
      if (
        outcome.approvalId !== approvalId ||
        outcome.version !== request.approval.version ||
        authority?.approvalId !== approvalId ||
        outcome.status !== authority.status
      ) {
        await this.dependencies.actionLedger.updateStatus(request.operationId, "failed", {
          lastErrorClass: "E-APPROVAL-MISMATCH",
        });
        return this.receipt(request, decision, approvalId, "failed", "E-APPROVAL-MISMATCH", startedAt);
      }
      if (outcome.status === "rejected") {
        await this.dependencies.actionLedger.updateStatus(request.operationId, "rejected", {
          lastErrorClass: "E-APPROVAL-REJECTED",
        });
        return this.receipt(request, decision, approvalId, "blocked", "E-APPROVAL-REJECTED", startedAt);
      }
      await this.dependencies.actionLedger.updateStatus(request.operationId, "approved");
    }

    if (!(await this.dependencies.actionLedger.claimExecution(request.operationId))) {
      return this.receipt(request, decision, approvalId, "blocked", "E-ACTION-CLAIM", startedAt);
    }
    try {
      const result = (await this.dependencies.execute(request.registryEntry.id, request.operation, request.input)) as T;
      await this.dependencies.actionLedger.updateStatus(request.operationId, "applied");
      return this.receipt(request, decision, approvalId, "succeeded", null, startedAt, result);
    } catch {
      await this.dependencies.actionLedger.updateStatus(request.operationId, "failed", {
        lastErrorClass: "E-TOOL-INVOKE",
      });
      return this.receipt(request, decision, approvalId, "failed", "E-TOOL-INVOKE", startedAt);
    }
  }

  private async decide(
    input: McpPolicyInput,
  ): Promise<Required<Pick<ToolPolicyDecision, "decisionId">> & ToolPolicyDecision> {
    let candidate: unknown;
    try {
      candidate = await this.dependencies.decisionClient.decide(input);
    } catch {
      candidate = {
        decision: "deny",
        reasons: ["E-OPA-NETWORK"],
        obligations: { allowedProvider: "none", requireHumanApproval: false },
        policyBundleVersion: this.dependencies.policyBundleVersion,
        errorCode: "E-OPA-NETWORK",
      } satisfies ToolPolicyDecision;
    }
    const decision =
      isDecision(candidate) && candidate.policyBundleVersion === this.dependencies.policyBundleVersion
        ? candidate
        : ({
            decision: "deny",
            reasons: ["E-OPA-MALFORMED"],
            obligations: { allowedProvider: "none", requireHumanApproval: false },
            policyBundleVersion: this.dependencies.policyBundleVersion,
            errorCode: "E-OPA-MALFORMED",
          } satisfies ToolPolicyDecision);
    const decisionId = decision.decisionId ?? this.dependencies.fallbackDecisionId();
    if (!UUID.test(decisionId)) throw new TypeError("policy decision id must be a UUID");
    return { ...decision, decisionId };
  }

  private async receipt<T>(
    request: GovernedMcpToolCallRequest,
    decision: Required<Pick<ToolPolicyDecision, "decisionId">> & ToolPolicyDecision,
    approvalId: string | null,
    status: ReceiptStatus,
    errorCode: string | null,
    startedAt: number,
    result?: T,
  ): Promise<ToolInvocationReceipt<T>> {
    await this.dependencies.toolInvocations.record({
      invocationId: request.invocationId,
      workflowId: request.workflowId,
      serverId: request.registryEntry.id,
      serverVersion: request.registryEntry.version,
      toolName: request.operation,
      riskLevel: request.registryEntry.risk,
      resourceScope: request.resource.scope,
      policyDecisionId: decision.decisionId,
      approvalId,
      latencyMs: Math.max(0, this.now() - startedAt),
      status,
      errorClass: errorCode,
      traceId: request.traceId,
    });
    return {
      invocationId: request.invocationId,
      operationId: request.operationId,
      status,
      decision: decision.decision,
      decisionId: decision.decisionId,
      policyBundleVersion: decision.policyBundleVersion,
      approvalId,
      errorCode,
      ...(result === undefined ? {} : { result }),
    };
  }
}
