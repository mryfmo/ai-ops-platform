// 根拠: FinalArch:MCP-002 / FinalArch:CON-004 / ADR-0023 / WBS P4-T03
import type { PolicyDecision, PolicyDecisionValue, PolicyInput, ProviderCandidate } from "./contracts.js";

export const POLICY_BUNDLE_VERSION = "0.1.0";
export const OPA_DECISION_PATH = "/v1/data/aiops/policy/decision";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type OpaDecisionErrorCode = "E-OPA-HTTP" | "E-OPA-MALFORMED" | "E-OPA-NETWORK" | "E-OPA-TIMEOUT";
export type OpaDecisionResult = PolicyDecision & { errorCode?: OpaDecisionErrorCode };

export interface OpaDecisionClientOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxAttempts?: number;
  policyBundleVersion?: string;
}

class OpaTimeoutError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  );
}

function parseObligations(value: unknown): PolicyDecision["obligations"] | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !hasOnlyKeys(value, [
      "redactFields",
      "allowedProvider",
      "requireHumanApproval",
      "maxResultBytes",
      "allowedResourceIds",
    ])
  ) {
    return undefined;
  }
  if ("redactFields" in value && !isStringArray(value.redactFields)) return undefined;
  if (
    "allowedProvider" in value &&
    !(["bedrock", "anthropic", "none"] satisfies ProviderCandidate[]).includes(
      value.allowedProvider as ProviderCandidate,
    )
  ) {
    return undefined;
  }
  if ("requireHumanApproval" in value && typeof value.requireHumanApproval !== "boolean") return undefined;
  if ("maxResultBytes" in value && !Number.isInteger(value.maxResultBytes)) return undefined;
  if ("allowedResourceIds" in value && !isStringArray(value.allowedResourceIds)) return undefined;
  return value as PolicyDecision["obligations"];
}

function parseResponse(value: unknown, expectedVersion: string): PolicyDecision | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["result", "decision_id"])) return undefined;
  const result = value.result;
  if (!isRecord(result)) return undefined;
  if (!hasOnlyKeys(result, ["decision", "reasons", "obligations", "policyBundleVersion", "decisionId"])) {
    return undefined;
  }
  if (!(typeof result.decision === "string" && ["allow", "deny", "require_approval"].includes(result.decision))) {
    return undefined;
  }
  if (!isStringArray(result.reasons)) return undefined;
  const obligations = parseObligations(result.obligations);
  if (!obligations) return undefined;
  if (result.policyBundleVersion !== expectedVersion) return undefined;

  const resultDecisionId = result.decisionId;
  const envelopeDecisionId = value.decision_id;
  if (resultDecisionId !== undefined && !isUuid(resultDecisionId)) return undefined;
  if (envelopeDecisionId !== undefined && !isUuid(envelopeDecisionId)) return undefined;
  if (resultDecisionId !== undefined && envelopeDecisionId !== undefined && resultDecisionId !== envelopeDecisionId) {
    return undefined;
  }

  const decisionId = (resultDecisionId ?? envelopeDecisionId) as string | undefined;
  return {
    decision: result.decision as PolicyDecisionValue,
    reasons: result.reasons,
    obligations,
    policyBundleVersion: expectedVersion,
    ...(decisionId ? { decisionId } : {}),
  };
}

function failClosed(errorCode: OpaDecisionErrorCode, policyBundleVersion: string): OpaDecisionResult {
  return {
    decision: "deny",
    reasons: [errorCode],
    obligations: { allowedProvider: "none", requireHumanApproval: false },
    policyBundleVersion,
    errorCode,
  };
}

export class OpaDecisionClient {
  private readonly decisionUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly policyBundleVersion: string;

  constructor(options: OpaDecisionClientOptions) {
    const baseUrl = new URL(options.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new TypeError("OPA baseUrl must use http or https");
    }
    if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
      throw new TypeError("OPA baseUrl must not contain credentials, query, or fragment");
    }
    this.decisionUrl = new URL(OPA_DECISION_PATH, baseUrl).toString();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 2_000;
    this.maxAttempts = options.maxAttempts ?? 2;
    this.policyBundleVersion = options.policyBundleVersion ?? POLICY_BUNDLE_VERSION;

    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 30_000) {
      throw new TypeError("timeoutMs must be an integer between 1 and 30000");
    }
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 3) {
      throw new TypeError("maxAttempts must be an integer between 1 and 3");
    }
    if (!this.policyBundleVersion) throw new TypeError("policyBundleVersion is required");
  }

  async decide(input: PolicyInput): Promise<OpaDecisionResult> {
    let lastError: OpaDecisionErrorCode = "E-OPA-NETWORK";
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.post(input);
        if (!response.ok) {
          lastError = "E-OPA-HTTP";
          if (response.status >= 500 && attempt < this.maxAttempts) continue;
          return failClosed(lastError, this.policyBundleVersion);
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return failClosed("E-OPA-MALFORMED", this.policyBundleVersion);
        }
        const decision = parseResponse(body, this.policyBundleVersion);
        return decision ?? failClosed("E-OPA-MALFORMED", this.policyBundleVersion);
      } catch (error) {
        lastError = error instanceof OpaTimeoutError ? "E-OPA-TIMEOUT" : "E-OPA-NETWORK";
        if (attempt === this.maxAttempts) return failClosed(lastError, this.policyBundleVersion);
      }
    }
    return failClosed(lastError, this.policyBundleVersion);
  }

  private post(input: PolicyInput): Promise<Response> {
    const controller = new AbortController();
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        reject(new OpaTimeoutError("OPA decision timed out"));
      }, this.timeoutMs);
      this.fetchImpl(this.decisionUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      }).then(
        (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
