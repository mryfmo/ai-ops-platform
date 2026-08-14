/** 根拠: FinalArch:MCP-003 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11。safe metadata-only MCP operations BFF。 */
import type { Session } from "next-auth";
import { z } from "zod";
import { signIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";

import { requireSession, UnauthorizedError } from "./authGuard";

const count = z.number().int().nonnegative();
const nullableMetadata = z.string().nullable();
const distribution = z.object({ code: z.string(), count }).strict();
const registryStatusSchema = z
  .object({
    status: z.enum(["match", "drift", "unavailable"]),
    declaredHash: nullableMetadata,
    approvedHash: nullableMetadata,
  })
  .strict();

const mcpOpsSummarySchema = z
  .object({
    window: z.object({ hours: z.number().int().positive(), since: z.string() }).strict(),
    totalInvocations: count,
    usage: z.array(
      z
        .object({
          serverId: z.string(),
          toolName: z.string(),
          riskLevel: z.string(),
          status: z.string(),
          count,
        })
        .strict(),
    ),
    policy: z
      .object({
        totalDecisions: count,
        deniedDecisions: count,
        denyRatePct: z.number().min(0).max(100).nullable(),
      })
      .strict(),
    denyReasons: z.array(distribution),
    errors: z.array(distribution),
    registry: registryStatusSchema,
  })
  .strict();

const mcpInvocationAuditSchema = z
  .object({
    invocationId: z.string(),
    workflowId: nullableMetadata,
    traceId: z.string(),
    actorId: z.string(),
    tool: z
      .object({ serverId: z.string(), serverVersion: z.string(), name: z.string(), riskLevel: z.string() })
      .strict(),
    resource: z.object({ id: z.string(), projectId: z.string().optional() }).strict(),
    policy: z.object({ decisionId: z.string(), bundleVersion: z.string(), decision: z.string() }).strict(),
    result: z.object({ status: z.string(), errorClass: nullableMetadata, latencyMs: count.nullable() }).strict(),
    action: z.object({ operationId: z.string(), status: z.string(), errorClass: nullableMetadata }).strict().nullable(),
  })
  .strict();

export type McpOpsSummary = z.infer<typeof mcpOpsSummarySchema>;
export type McpInvocationAudit = z.infer<typeof mcpInvocationAuditSchema>;

export interface McpOpsClientDeps {
  getSession: () => Promise<Session | null>;
  serverBaseUrl: string;
  identitySecret?: string;
  fetchImpl?: typeof fetch;
  nowUnix?: () => number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function authError(error: unknown): Response {
  if (error instanceof UnauthorizedError) return Response.json({ error: error.message }, { status: 401 });
  throw error;
}

async function signedGet(path: string, schema: z.ZodType, deps: McpOpsClientDeps): Promise<Response> {
  let session;
  try {
    session = await requireSession(deps.getSession);
  } catch (error) {
    return authError(error);
  }
  if (!deps.identitySecret) return Response.json({ error: "MCP operations disabled" }, { status: 503 });
  const issuedAtUnix = deps.nowUnix?.() ?? Math.floor(Date.now() / 1_000);
  const subject = session.user.subject;
  try {
    const upstream = await (deps.fetchImpl ?? fetch)(new URL(path, deps.serverBaseUrl), {
      headers: {
        "x-aiops-entra-tenant-id": subject.tenantId,
        "x-aiops-entra-object-id": subject.objectId,
        "x-aiops-issued-at": String(issuedAtUnix),
        "x-aiops-identity-signature": signIdentityEnvelope(
          { method: "GET", path, body: "", tenantId: subject.tenantId, objectId: subject.objectId, issuedAtUnix },
          deps.identitySecret,
        ),
      },
    });
    if (!upstream.ok) {
      return Response.json({ error: "MCP operations service rejected the request" }, { status: upstream.status });
    }
    const parsed = schema.safeParse(await upstream.json());
    return parsed.success
      ? Response.json(parsed.data)
      : Response.json({ error: "MCP operations service returned invalid metadata" }, { status: 502 });
  } catch {
    return Response.json({ error: "MCP operations service unavailable" }, { status: 502 });
  }
}

export function handleMcpOpsSummary(deps: McpOpsClientDeps): Promise<Response> {
  return signedGet("/mcp-ops/summary", mcpOpsSummarySchema, deps);
}

export function handleMcpOpsInvocation(invocationId: string, deps: McpOpsClientDeps): Promise<Response> {
  if (!UUID.test(invocationId))
    return Promise.resolve(Response.json({ error: "invalid invocation id" }, { status: 400 }));
  return signedGet(`/mcp-ops/invocations/${invocationId}`, mcpInvocationAuditSchema, deps);
}
