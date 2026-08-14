/** 根拠: FinalArch:MCP-001 / FinalArch:MCP-003 / FinalArch:MCP-004 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11 */
import type { Context, Hono } from "hono";
import type { AuditLogWriter } from "@aiops/shared";
import { verifyIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";

import { McpOpsForbiddenError, type McpOpsRepo } from "../../db/mcpOpsRepo.js";
import type { RecipientsRepo } from "../../db/recipientsRepo.js";
import type { McpRegistryStatus } from "../../lib/mcpRegistryStatus.js";

export interface McpOpsRoutesDeps {
  mcpOpsRepo: Pick<McpOpsRepo, "summaryFor" | "findInvocation">;
  recipientsRepo: Pick<RecipientsRepo, "findActiveByTrustedSubject">;
  registryStatus: { read(): Promise<McpRegistryStatus> };
  auditLog: AuditLogWriter;
  identitySecret?: string;
  nowUnix?: () => number;
  traceIdProvider(): string;
}

interface AuthenticatedIdentity {
  tenantId: string;
  objectId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function authenticate(c: Context, deps: McpOpsRoutesDeps): AuthenticatedIdentity | Response {
  const tenantId = c.req.header("x-aiops-entra-tenant-id") ?? "";
  const objectId = c.req.header("x-aiops-entra-object-id") ?? "";
  const issuedAt = c.req.header("x-aiops-issued-at") ?? "";
  const issuedAtUnix = Number(issuedAt);
  if (!Number.isSafeInteger(issuedAtUnix) || String(issuedAtUnix) !== issuedAt) {
    return c.json({ error: "authentication required" }, 401);
  }
  const url = new URL(c.req.url);
  const valid = verifyIdentityEnvelope(
    { method: c.req.method, path: `${url.pathname}${url.search}`, body: "", tenantId, objectId, issuedAtUnix },
    c.req.header("x-aiops-identity-signature"),
    deps.identitySecret!,
    deps.nowUnix?.(),
  );
  return valid ? { tenantId, objectId } : c.json({ error: "authentication required" }, 401);
}

async function deny(
  c: Context,
  deps: McpOpsRoutesDeps,
  identity: AuthenticatedIdentity,
  code: string,
): Promise<Response> {
  const nowUnix = deps.nowUnix?.() ?? Math.floor(Date.now() / 1_000);
  await deps.auditLog.append({
    trace_id: deps.traceIdProvider(),
    actor: `ENTRA:${identity.tenantId}:${identity.objectId}`,
    action: "mcp_ops_authorization_denied",
    basis: "FinalArch:MCP-003 / WBS P4-T11",
    detail: { code },
    at: new Date(nowUnix * 1_000).toISOString(),
  });
  return c.json({ error: "MCP operations forbidden" }, 403);
}

async function recipient(c: Context, deps: McpOpsRoutesDeps, identity: AuthenticatedIdentity) {
  const active = await deps.recipientsRepo.findActiveByTrustedSubject(identity.tenantId, identity.objectId);
  return active ?? deny(c, deps, identity, "E-MCP-OPS-AUTHZ-ACTIVE");
}

export function registerMcpOpsRoutes(app: Hono, deps: McpOpsRoutesDeps | undefined): void {
  app.get("/mcp-ops/summary", async (c) => {
    if (!deps?.identitySecret) return c.json({ error: "MCP operations disabled" }, 503);
    const identity = authenticate(c, deps);
    if (identity instanceof Response) return identity;
    const active = await recipient(c, deps, identity);
    if (active instanceof Response) return active;
    try {
      const summary = await deps.mcpOpsRepo.summaryFor(active);
      const registry = await deps.registryStatus.read();
      return c.json({ ...summary, registry });
    } catch (error) {
      if (error instanceof McpOpsForbiddenError) return deny(c, deps, identity, "E-MCP-OPS-AUTHZ-SCOPE");
      throw error;
    }
  });

  app.get("/mcp-ops/invocations/:invocationId", async (c) => {
    if (!deps?.identitySecret) return c.json({ error: "MCP operations disabled" }, 503);
    const invocationId = c.req.param("invocationId");
    if (!UUID.test(invocationId)) return c.json({ error: "invalid invocation id" }, 400);
    const identity = authenticate(c, deps);
    if (identity instanceof Response) return identity;
    const active = await recipient(c, deps, identity);
    if (active instanceof Response) return active;
    try {
      const invocation = await deps.mcpOpsRepo.findInvocation(active, invocationId);
      return invocation === null ? c.json({ error: "invocation not found" }, 404) : c.json(invocation);
    } catch (error) {
      if (error instanceof McpOpsForbiddenError) return deny(c, deps, identity, "E-MCP-OPS-AUTHZ-SCOPE");
      throw error;
    }
  });
}
