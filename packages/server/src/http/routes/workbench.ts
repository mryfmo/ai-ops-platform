/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003。 */
import type { Context, Hono } from "hono";
import type { AuditLogWriter } from "@aiops/shared";
import { verifyIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";

import { WorkbenchForbiddenError, type WorkbenchRepo } from "../../db/workbenchRepo.js";
import type { RecipientsRepo } from "../../db/recipientsRepo.js";

export interface WorkbenchRoutesDeps {
  workbenchRepo: Pick<WorkbenchRepo, "findByIdFor">;
  recipientsRepo: Pick<RecipientsRepo, "findActiveByTrustedSubject">;
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

function authenticate(c: Context, deps: WorkbenchRoutesDeps): AuthenticatedIdentity | Response {
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
  deps: WorkbenchRoutesDeps,
  identity: AuthenticatedIdentity,
  code: string,
): Promise<Response> {
  const nowUnix = deps.nowUnix?.() ?? Math.floor(Date.now() / 1_000);
  await deps.auditLog.append({
    trace_id: deps.traceIdProvider(),
    actor: `ENTRA:${identity.tenantId}:${identity.objectId}`,
    action: "workbench_authorization_denied",
    basis: "FinalArch:FR-UI-004 / ADR-0025 / UX-003",
    detail: { code },
    at: new Date(nowUnix * 1_000).toISOString(),
  });
  return c.json({ error: "Workbench forbidden" }, 403);
}

export function registerWorkbenchRoutes(app: Hono, deps: WorkbenchRoutesDeps | undefined): void {
  app.get("/workbench/workspaces/:workspaceId", async (c) => {
    if (!deps?.identitySecret) return c.json({ error: "Workbench disabled" }, 503);
    const workspaceId = c.req.param("workspaceId");
    if (!UUID.test(workspaceId)) return c.json({ error: "invalid workspace id" }, 400);
    const identity = authenticate(c, deps);
    if (identity instanceof Response) return identity;
    const recipient = await deps.recipientsRepo.findActiveByTrustedSubject(identity.tenantId, identity.objectId);
    if (!recipient) return deny(c, deps, identity, "E-WORKBENCH-AUTHZ-ACTIVE");
    try {
      const workspace = await deps.workbenchRepo.findByIdFor(recipient, workspaceId);
      return workspace === null ? c.json({ error: "workspace not found" }, 404) : c.json(workspace);
    } catch (error) {
      if (error instanceof WorkbenchForbiddenError) {
        return deny(c, deps, identity, "E-WORKBENCH-AUTHZ-SCOPE");
      }
      throw error;
    }
  });
}
