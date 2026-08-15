// 根拠: FinalArch:PRD-007 / FinalArch:WIQ-004 / ADR-0024
import type {
  OpaDecisionResult,
  PolicyEnvironment,
  PolicyInput,
  ProviderCandidate,
  ResourceClassification,
} from "@aiops/policy";
import { sanitizeForLlmInput } from "@aiops/shared/secretSanitizer";

export type M365ExternalProvider = Exclude<ProviderCandidate, "none">;

export interface M365EgressRequest {
  readonly actor: {
    readonly id: string;
    readonly tenantId: string;
    readonly projectIds: readonly string[];
  };
  readonly projectId: string;
  readonly purpose: string;
  readonly providerCandidate: M365ExternalProvider;
  readonly classification: string;
  readonly requestedFields: readonly string[];
  readonly sourceSystems: readonly string[];
  readonly environment: PolicyEnvironment;
  readonly output: {
    readonly fields: Readonly<Record<string, unknown>>;
    readonly provenanceComplete: boolean;
    readonly summarized: boolean;
  };
}

export type M365EgressErrorCode =
  | "E-M365-EGRESS-INPUT"
  | "E-M365-EGRESS-POLICY"
  | "E-M365-EGRESS-OBLIGATION"
  | "E-M365-EGRESS-SIZE"
  | "E-M365-EGRESS-DISPATCH";

export type PreparedM365Egress =
  | { readonly ok: true; readonly provider: M365ExternalProvider; readonly content: string }
  | { readonly ok: false; readonly code: M365EgressErrorCode };

const CLASSIFICATION_RANK: Record<ResourceClassification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  "customer-confidential": 3,
  restricted: 4,
};
const FIELD_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u;
const MAX_ARRAY_ITEMS = 32;
const MAX_EGRESS_BYTES = 16_384;

function isClassification(value: string): value is ResourceClassification {
  return Object.hasOwn(CLASSIFICATION_RANK, value);
}

function isBoundedString(value: string, maxLength = 256): boolean {
  return value.trim() !== "" && value.length <= maxLength;
}

function validNames(values: readonly string[]): boolean {
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    values.length <= MAX_ARRAY_ITEMS &&
    values.every((value) => typeof value === "string" && FIELD_NAME.test(value)) &&
    new Set(values).size === values.length
  );
}

function effectiveClassification(request: M365EgressRequest): ResourceClassification | undefined {
  if (!isClassification(request.classification)) return undefined;
  return !request.output.provenanceComplete && CLASSIFICATION_RANK[request.classification] < 3
    ? "customer-confidential"
    : request.classification;
}

function validRequest(request: M365EgressRequest): boolean {
  return (
    isBoundedString(request.actor.id) &&
    isBoundedString(request.actor.tenantId) &&
    validNames(request.actor.projectIds) &&
    isBoundedString(request.projectId) &&
    request.actor.projectIds.includes(request.projectId) &&
    isBoundedString(request.purpose, 1_000) &&
    (request.providerCandidate === "bedrock" || request.providerCandidate === "anthropic") &&
    (request.environment === "dev" || request.environment === "staging" || request.environment === "prod") &&
    validNames(request.requestedFields) &&
    validNames(request.sourceSystems) &&
    typeof request.output.fields === "object" &&
    request.output.fields !== null &&
    !Array.isArray(request.output.fields) &&
    request.requestedFields.every((field) => Object.hasOwn(request.output.fields, field)) &&
    typeof request.output.provenanceComplete === "boolean" &&
    typeof request.output.summarized === "boolean"
  );
}

export function buildM365EgressPolicyInput(request: M365EgressRequest): PolicyInput | undefined {
  const classification = effectiveClassification(request);
  if (!classification || !validRequest(request)) return undefined;
  const labels = [
    request.output.provenanceComplete ? "provenance:complete" : "provenance:incomplete",
    ...[...request.requestedFields].sort().map((field) => `requested-field:${field}`),
    ...[...request.sourceSystems].sort().map((system) => `source-system:${system}`),
  ];
  return {
    actor: {
      id: request.actor.id,
      type: "human",
      tenantId: request.actor.tenantId,
      projectIds: [...request.actor.projectIds],
    },
    agent: { id: "control-plane", kind: "temporal-worker" },
    action: {
      name: "egress",
      riskLevel: "L1",
      toolName: "work-iq.m365-intelligence.egress",
      protocol: "llm",
    },
    resource: {
      system: "work-iq",
      id: "work-iq-output",
      projectId: request.projectId,
      classification,
      labels,
    },
    context: {
      purpose: request.purpose,
      environment: request.environment,
      providerCandidate: request.providerCandidate,
      sourceTrust: request.output.provenanceComplete ? "trusted-platform" : "untrusted-content",
    },
  };
}

function requiredRedactions(classification: ResourceClassification): readonly string[] {
  return classification === "customer-confidential"
    ? ["conversationId", "permissionContext", "sourceReferences"]
    : ["permissionContext", "sourceReferences"];
}

export function prepareM365Egress(
  request: M365EgressRequest,
  policyInput: PolicyInput,
  decision: OpaDecisionResult,
): PreparedM365Egress {
  const { obligations } = decision;
  const redactions = obligations.redactFields;
  if (
    decision.decision !== "allow" ||
    decision.errorCode !== undefined ||
    obligations.allowedProvider !== request.providerCandidate ||
    obligations.requireHumanApproval !== false ||
    !Array.isArray(redactions) ||
    redactions.some((field) => !FIELD_NAME.test(field)) ||
    new Set(redactions).size !== redactions.length ||
    !Number.isInteger(obligations.maxResultBytes) ||
    (obligations.maxResultBytes ?? 0) < 1 ||
    (obligations.maxResultBytes ?? 0) > MAX_EGRESS_BYTES
  ) {
    return { ok: false, code: "E-M365-EGRESS-OBLIGATION" };
  }
  const classification = policyInput.resource.classification;
  if (
    !requiredRedactions(classification).every((field) => redactions.includes(field)) ||
    (classification === "customer-confidential" && !request.output.summarized)
  ) {
    return { ok: false, code: "E-M365-EGRESS-OBLIGATION" };
  }

  const minimized = Object.fromEntries(
    request.requestedFields
      .filter((field) => !redactions.includes(field))
      .map((field) => [field, request.output.fields[field]]),
  );
  let content: string;
  try {
    content = sanitizeForLlmInput(JSON.stringify(minimized)).sanitized;
  } catch {
    return { ok: false, code: "E-M365-EGRESS-INPUT" };
  }
  if (content === "{}") return { ok: false, code: "E-M365-EGRESS-OBLIGATION" };
  if (new TextEncoder().encode(content).byteLength > obligations.maxResultBytes!) {
    return { ok: false, code: "E-M365-EGRESS-SIZE" };
  }
  return { ok: true, provider: request.providerCandidate, content };
}
