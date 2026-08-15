/** 根拠: FinalArch:PRD-007 / FinalArch:FR-M365-001..006 / FinalArch:WIQ-002 / ADR-0024 */
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AuditLogWriter } from "@aiops/shared";
import { verifyIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { WorkIqRestClient, type WorkIqRestClientOptions } from "@aiops/integrations";
import type { OpaDecisionClient, PolicyEnvironment, PolicyInput, ResourceClassification } from "@aiops/policy";

import type { RecipientsRepo } from "../../db/recipientsRepo.js";
import {
  createWorkIqOboTokenProvider,
  type WorkIqOboExchange,
  type WorkIqOboTokenCache,
} from "../../auth/workIqOboTokenProvider.js";

export const M365_QUERY_MAX_BYTES = 16_384;

export interface M365DelegatedRoutesDeps {
  recipientsRepo: Pick<RecipientsRepo, "findActiveByTrustedSubject">;
  exchange: WorkIqOboExchange;
  tokenCache: WorkIqOboTokenCache;
  decisionClient: Pick<OpaDecisionClient, "decide">;
  workIqFetch: WorkIqRestClientOptions["fetchImpl"];
  auditLog: AuditLogWriter;
  expectedTenantId: string;
  environment: PolicyEnvironment;
  identitySecret?: string;
  nowUnix?: () => number;
  traceIdProvider(): string;
}

interface AuthenticatedIdentity {
  readonly tenantId: string;
  readonly objectId: string;
}

interface M365Query {
  readonly question: string;
  /** Declared purpose context only; it does not constrain Work IQ retrieval. */
  readonly purpose: string;
  readonly classification: ResourceClassification;
  /** Declared purpose context only; Work IQ ask has no project/source filter parameters. */
  readonly projectId: string;
  readonly allowedSourceTypes: readonly string[];
}

const CLASSIFICATIONS = new Set<ResourceClassification>([
  "public",
  "internal",
  "confidential",
  "customer-confidential",
  "restricted",
]);
const SOURCE_TYPES = new Set(["mail", "calendar", "teams", "sharepoint", "onedrive", "people", "planner"]);
const INPUT_KEYS = new Set(["question", "purpose", "classification", "projectId", "allowedSourceTypes"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function authenticate(c: Context, body: string, deps: M365DelegatedRoutesDeps): AuthenticatedIdentity | Response {
  const tenantId = c.req.header("x-aiops-entra-tenant-id") ?? "";
  const objectId = c.req.header("x-aiops-entra-object-id") ?? "";
  const issuedAt = c.req.header("x-aiops-issued-at") ?? "";
  const issuedAtUnix = Number(issuedAt);
  if (!Number.isSafeInteger(issuedAtUnix) || String(issuedAtUnix) !== issuedAt) {
    return c.json({ error: "authentication required", code: "E-M365-IDENTITY" }, 401);
  }
  const url = new URL(c.req.url);
  const valid = verifyIdentityEnvelope(
    {
      method: c.req.method,
      path: `${url.pathname}${url.search}`,
      body,
      tenantId,
      objectId,
      issuedAtUnix,
    },
    c.req.header("x-aiops-identity-signature"),
    deps.identitySecret!,
    deps.nowUnix?.(),
  );
  return valid ? { tenantId, objectId } : c.json({ error: "authentication required", code: "E-M365-IDENTITY" }, 401);
}

function bearerToken(value: string | undefined): string | undefined {
  const match = value?.match(/^Bearer (\S+)$/u);
  return match?.[1];
}

function parseQuery(body: string): M365Query | undefined {
  let value: unknown;
  try {
    value = JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
  if (!isRecord(value) || Object.keys(value).some((key) => !INPUT_KEYS.has(key))) return undefined;
  if (
    typeof value.question !== "string" ||
    value.question.trim() === "" ||
    value.question.length > 10_000 ||
    typeof value.purpose !== "string" ||
    value.purpose.trim() === "" ||
    value.purpose.length > 1_000 ||
    typeof value.classification !== "string" ||
    !CLASSIFICATIONS.has(value.classification as ResourceClassification) ||
    typeof value.projectId !== "string" ||
    !/^PJ-[0-9]{3,}$/u.test(value.projectId)
  ) {
    return undefined;
  }
  const allowedSourceTypes = value.allowedSourceTypes ?? [];
  if (
    !Array.isArray(allowedSourceTypes) ||
    allowedSourceTypes.length > SOURCE_TYPES.size ||
    !allowedSourceTypes.every((source) => typeof source === "string" && SOURCE_TYPES.has(source)) ||
    new Set(allowedSourceTypes).size !== allowedSourceTypes.length
  ) {
    return undefined;
  }
  return {
    question: value.question,
    purpose: value.purpose,
    classification: value.classification as ResourceClassification,
    projectId: value.projectId,
    allowedSourceTypes,
  };
}

async function auditDenial(
  deps: M365DelegatedRoutesDeps,
  identity: AuthenticatedIdentity,
  traceId: string,
  action: "m365_authorization_denied" | "m365_policy_denied",
  detail: Record<string, unknown>,
): Promise<void> {
  const nowUnix = deps.nowUnix?.() ?? Math.floor(Date.now() / 1_000);
  await deps.auditLog.append({
    trace_id: traceId,
    actor: `ENTRA:${identity.tenantId}:${identity.objectId}`,
    action,
    basis: "FinalArch:PRD-007 / FinalArch:WIQ-002 / ADR-0024",
    detail,
    at: new Date(nowUnix * 1_000).toISOString(),
  });
}

function policyInput(identity: AuthenticatedIdentity, query: M365Query, environment: PolicyEnvironment): PolicyInput {
  // Work IQ ask accepts only a free-text question. These declarations limit the stated
  // purpose; they do not authorize or filter retrieval. Isolation is M365 permission
  // trimming plus output-side OPA classification/minimization in later P5 controls.
  const declaredPurposeScope = JSON.stringify({
    declaredPurpose: query.purpose,
    declaredProjectContext: query.projectId,
    declaredSourceContext: query.allowedSourceTypes,
  });
  return {
    actor: { id: identity.objectId, type: "human", tenantId: identity.tenantId },
    agent: { id: "control-api", kind: "control-api" },
    action: { name: "ask", riskLevel: "L1", toolName: "work-iq.m365-intelligence.ask", protocol: "mcp" },
    resource: { system: "work-iq", id: "delegated-m365-ask", classification: query.classification },
    context: {
      purpose: declaredPurposeScope,
      environment,
      providerCandidate: "none",
      sourceTrust: "trusted-platform",
    },
  };
}

export function registerM365DelegatedRoutes(app: Hono, deps: M365DelegatedRoutesDeps | undefined): void {
  app.use(
    "/m365/query",
    bodyLimit({
      maxSize: M365_QUERY_MAX_BYTES,
      onError: (c) => c.json({ error: "payload too large", code: "E-M365-INPUT" }, 413),
    }),
  );
  app.post("/m365/query", async (c) => {
    if (!deps?.identitySecret) return c.json({ error: "M365 query disabled", code: "E-M365-DISABLED" }, 503);
    const body = await c.req.text();
    const identity = authenticate(c, body, deps);
    if (identity instanceof Response) return identity;
    const traceId = deps.traceIdProvider();
    const recipient = await deps.recipientsRepo.findActiveByTrustedSubject(identity.tenantId, identity.objectId);
    if (!recipient) {
      await auditDenial(deps, identity, traceId, "m365_authorization_denied", { code: "E-M365-ACTIVE" });
      return c.json({ error: "M365 query forbidden", code: "E-M365-ACTIVE" }, 403);
    }
    const query = parseQuery(body);
    if (!query) return c.json({ error: "invalid M365 query", code: "E-M365-INPUT" }, 400);

    const userAssertion = bearerToken(c.req.header("authorization"));
    let tokenProvider;
    try {
      if (identity.tenantId !== deps.expectedTenantId || !userAssertion) throw new Error("E-M365-CLAIMS");
      tokenProvider = createWorkIqOboTokenProvider({
        exchange: deps.exchange,
        cache: deps.tokenCache,
        userAssertion,
        tenantId: identity.tenantId,
        subject: identity.objectId,
        nowUnix: deps.nowUnix,
      });
      await tokenProvider.getToken();
    } catch {
      await auditDenial(deps, identity, traceId, "m365_authorization_denied", { code: "E-M365-CLAIMS" });
      return c.json({ error: "M365 query forbidden", code: "E-M365-CLAIMS" }, 403);
    }

    let decision;
    try {
      decision = await deps.decisionClient.decide(policyInput(identity, query, deps.environment));
    } catch {
      await auditDenial(deps, identity, traceId, "m365_policy_denied", { code: "E-M365-POLICY-FAILURE" });
      return c.json({ error: "M365 query forbidden", code: "E-M365-POLICY-FAILURE" }, 403);
    }
    if (decision.decision !== "allow") {
      const code =
        decision.errorCode !== undefined
          ? "E-M365-POLICY-FAILURE"
          : decision.decision === "require_approval"
            ? "E-M365-POLICY-APPROVAL"
            : "E-M365-POLICY-DENY";
      await auditDenial(deps, identity, traceId, "m365_policy_denied", {
        code,
        decisionId: decision.decisionId ?? null,
        policyBundleVersion: decision.policyBundleVersion,
      });
      return c.json({ error: "M365 query forbidden", code }, 403);
    }

    const result = await new WorkIqRestClient({
      fetchImpl: deps.workIqFetch,
      tokenProvider,
      expectedTenantId: deps.expectedTenantId,
    }).ask({ question: query.question });
    return result.ok
      ? c.json({ result: result.value })
      : c.json({ error: "M365 query failed", code: result.errorCode }, 502);
  });
}
