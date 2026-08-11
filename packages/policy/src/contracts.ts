// 根拠: FinalArch:CON-004, FinalArch:CON-005, ADR-0023

export const RISK_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];
export type ActorType = "human" | "service" | "agent";
export type AgentKind = "control-api" | "claude-code" | "droid" | "web-workbench" | "teams-adapter" | "temporal-worker";
export type ToolProtocol = "api" | "mcp" | "a2a" | "llm" | "ui";
export type ResourceClassification = "public" | "internal" | "confidential" | "customer-confidential" | "restricted";
export type PolicyEnvironment = "dev" | "staging" | "prod";
export type ProviderCandidate = "bedrock" | "anthropic" | "none";
export type SourceTrust = "trusted-platform" | "reviewed" | "untrusted-content";

export interface PolicyInput {
  actor: {
    id: string;
    type: ActorType;
    tenantId: string;
    groups?: string[];
    projectIds?: string[];
  };
  agent: {
    id: string;
    kind: AgentKind;
  };
  action: {
    name: string;
    riskLevel: RiskLevel;
    toolName?: string;
    protocol?: ToolProtocol;
  };
  resource: {
    system: string;
    id: string;
    projectId?: string;
    classification: ResourceClassification;
    labels?: string[];
  };
  context: {
    purpose: string;
    environment: PolicyEnvironment;
    providerCandidate?: ProviderCandidate;
    approvalId?: string;
    sourceTrust?: SourceTrust;
  };
}

export type PolicyDecisionValue = "allow" | "deny" | "require_approval";

export interface PolicyDecision {
  decision: PolicyDecisionValue;
  reasons: string[];
  obligations: {
    redactFields?: string[];
    allowedProvider?: ProviderCandidate;
    requireHumanApproval?: boolean;
    maxResultBytes?: number;
    allowedResourceIds?: string[];
  };
  policyBundleVersion: string;
  decisionId?: string;
}
