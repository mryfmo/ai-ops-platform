// 根拠: FinalArch:MCP-001 / FinalArch:MCP-002 / FinalArch:CON-004 / ADR-0023 / WBS P4-T04

export const MCP_REGISTRY_CALLERS = ["control-plane", "claude-runner", "droid-runner"] as const;
export const MCP_TOOL_RISKS = ["L0", "L1", "L2", "L3"] as const;

export type McpRegistryCaller = (typeof MCP_REGISTRY_CALLERS)[number];
export type McpToolRisk = (typeof MCP_TOOL_RISKS)[number];
export type PolicyActorType = "human" | "service" | "agent";
export type PolicyEnvironment = "dev" | "staging" | "prod";
export type ResourceClassification = "public" | "internal" | "confidential" | "customer-confidential" | "restricted";

export interface GovernedRegistryEntry {
  readonly id: string;
  readonly enabled: boolean;
  readonly protocol: "mcp";
  readonly transport: "streamable-http";
  readonly version: "pinned";
  readonly risk: McpToolRisk;
  readonly operations: readonly string[];
  readonly allowed_callers: readonly McpRegistryCaller[];
}

export interface GovernedMcpToolCallRequest {
  readonly operationId: string;
  readonly invocationId: string;
  readonly workflowId: string;
  readonly traceId: string;
  readonly inputHash: string;
  readonly caller: McpRegistryCaller;
  readonly registryEntry: GovernedRegistryEntry;
  readonly operation: string;
  readonly policySystem: string;
  readonly policyToolName: string;
  readonly actor: {
    readonly id: string;
    readonly type: PolicyActorType;
    readonly tenantId: string;
    readonly groups?: readonly string[];
    readonly projectIds?: readonly string[];
  };
  readonly resource: {
    readonly id: string;
    readonly projectId?: string;
    readonly classification: ResourceClassification;
    readonly scope: unknown;
  };
  readonly context: { readonly purpose: string; readonly environment: PolicyEnvironment };
  readonly approval: { readonly version: number; readonly expiryMs: number };
  readonly input: unknown;
}

export interface McpPolicyInput {
  actor: GovernedMcpToolCallRequest["actor"];
  agent: { id: McpRegistryCaller; kind: "control-api" | "claude-code" | "droid" };
  action: { name: string; riskLevel: McpToolRisk; toolName: string; protocol: "mcp" };
  resource: {
    system: string;
    id: string;
    projectId?: string;
    classification: ResourceClassification;
  };
  context: {
    purpose: string;
    environment: PolicyEnvironment;
    providerCandidate: "none";
    sourceTrust: "trusted-platform";
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SAFE_NAME = /^[a-z][a-z0-9-]*$/u;
const SAFE_OPERATION = /^[a-z][a-z0-9_]*$/u;
const ACTOR_TYPES = ["human", "service", "agent"] as const;
const CLASSIFICATIONS = ["public", "internal", "confidential", "customer-confidential", "restricted"] as const;
const ENVIRONMENTS = ["dev", "staging", "prod"] as const;
const CALLER_KIND: Record<McpRegistryCaller, McpPolicyInput["agent"]["kind"]> = {
  "control-plane": "control-api",
  "claude-runner": "claude-code",
  "droid-runner": "droid",
};

function required(value: string, field: string): string {
  if (!value.trim()) throw new TypeError(`${field} is required`);
  return value;
}

export function assertGovernedMcpToolCallRequest(request: GovernedMcpToolCallRequest): void {
  for (const [field, value] of [
    ["operationId", request.operationId],
    ["invocationId", request.invocationId],
    ["traceId", request.traceId],
  ] as const) {
    if (!UUID.test(value)) throw new TypeError(`${field} must be a UUID`);
  }
  required(request.workflowId, "workflowId");
  if (!/^[0-9a-f]{64}$/u.test(request.inputHash)) throw new TypeError("inputHash must be lowercase SHA-256 hex");

  const entry = request.registryEntry;
  if (!entry.enabled) throw new TypeError("registry entry must be enabled before a tool call can be governed");
  if (!SAFE_NAME.test(entry.id)) throw new TypeError("registry entry id is invalid");
  if (entry.protocol !== "mcp" || entry.transport !== "streamable-http" || entry.version !== "pinned") {
    throw new TypeError("registry entry protocol, transport, and version must be governed values");
  }
  if (!(MCP_TOOL_RISKS as readonly string[]).includes(entry.risk)) {
    throw new TypeError("L4-L6 tools cannot use the MCP gateway path");
  }
  if (!(MCP_REGISTRY_CALLERS as readonly string[]).includes(request.caller)) {
    throw new TypeError("caller is not a governed registry caller");
  }
  if (!entry.allowed_callers.every((caller) => (MCP_REGISTRY_CALLERS as readonly string[]).includes(caller))) {
    throw new TypeError("allowed_callers contains an unknown caller");
  }
  if (!entry.allowed_callers.includes(request.caller)) throw new TypeError("caller is absent from allowed_callers");
  if (!SAFE_OPERATION.test(request.operation) || !entry.operations.includes(request.operation)) {
    throw new TypeError("operation is absent from the registry entry");
  }

  if (!SAFE_NAME.test(request.policySystem)) throw new TypeError("policySystem is invalid");
  const toolParts = request.policyToolName.split(".");
  if (toolParts.length !== 3 || toolParts[0] !== request.policySystem || toolParts[2] !== request.operation) {
    throw new TypeError("policyToolName must exactly bind system.group.operation");
  }
  if (!toolParts.every((part) => /^[a-z][a-z0-9_-]*$/u.test(part))) {
    throw new TypeError("policyToolName contains an invalid segment");
  }

  required(request.actor.id, "actor.id");
  required(request.actor.tenantId, "actor.tenantId");
  if (!(ACTOR_TYPES as readonly string[]).includes(request.actor.type)) throw new TypeError("actor.type is invalid");
  required(request.resource.id, "resource.id");
  if (!(CLASSIFICATIONS as readonly string[]).includes(request.resource.classification)) {
    throw new TypeError("resource.classification is invalid");
  }
  required(request.context.purpose, "context.purpose");
  if (!(ENVIRONMENTS as readonly string[]).includes(request.context.environment)) {
    throw new TypeError("context.environment is invalid");
  }
  if (!Number.isSafeInteger(request.approval.version) || request.approval.version < 1) {
    throw new TypeError("approval.version must be a positive safe integer");
  }
  if (!Number.isSafeInteger(request.approval.expiryMs) || request.approval.expiryMs < 1) {
    throw new TypeError("approval.expiryMs must be a positive safe integer");
  }
}

export function buildMcpPolicyInput(request: GovernedMcpToolCallRequest): McpPolicyInput {
  assertGovernedMcpToolCallRequest(request);
  return {
    actor: request.actor,
    agent: { id: request.caller, kind: CALLER_KIND[request.caller] },
    action: {
      name: request.operation,
      riskLevel: request.registryEntry.risk,
      toolName: request.policyToolName,
      protocol: "mcp",
    },
    resource: {
      system: request.policySystem,
      id: request.resource.id,
      ...(request.resource.projectId === undefined ? {} : { projectId: request.resource.projectId }),
      classification: request.resource.classification,
    },
    context: {
      purpose: request.context.purpose,
      environment: request.context.environment,
      providerCandidate: "none",
      sourceTrust: "trusted-platform",
    },
  };
}
