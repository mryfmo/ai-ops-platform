/**
 * packages/server/src/http/routes/approvals.ts
 *
 * 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / DEC-SPEC-002 / AUD-OPM-001。
 * Web BFFが署名したstable Entra subjectだけを承認者として受け、client bodyの表示名・IDは信用しない。
 */
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AuditLogWriter } from "@aiops/shared";
import { verifyIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import {
  APPROVAL_REASON_MAX_LENGTH,
  ApprovalAlreadyDecidedError,
  ApprovalNotFoundError,
  type ApprovalsRepo,
} from "../../db/approvalsRepo.js";
import type { DeliveryRecipient, RecipientsRepo } from "../../db/recipientsRepo.js";

export const APPROVAL_DECISION_MAX_BYTES = 4_096;

export interface ApprovalRoutesDeps {
  approvalsRepo: Pick<ApprovalsRepo, "listPending" | "getById" | "decide">;
  recipientsRepo: Pick<RecipientsRepo, "findActiveByTrustedSubject" | "canDecideChangeByTrustedSubject">;
  auditLog: AuditLogWriter;
  identitySecret?: string;
  nowUnix?: () => number;
  traceIdProvider(): string;
}

interface AuthenticatedIdentity {
  tenantId: string;
  objectId: string;
}

const CHANGE_APPROVER_PROFILES = new Set(["PRF-L", "PRF-G"]);

async function denyAuthorization(
  c: Context,
  deps: ApprovalRoutesDeps,
  identity: AuthenticatedIdentity,
  traceId: string,
  detail: Record<string, unknown>,
): Promise<Response> {
  await deps.auditLog.append({
    trace_id: traceId,
    actor: `ENTRA:${identity.tenantId}:${identity.objectId}`,
    action: "approval_authorization_denied",
    basis: "DevOps:REQ-010/AC-010c/AUD-OPM-001",
    detail,
    at: new Date().toISOString(),
  });
  return c.json({ error: "approval forbidden" }, 403);
}

async function authorizeChangeApprover(
  c: Context,
  deps: ApprovalRoutesDeps,
  identity: AuthenticatedIdentity,
  traceId: string,
): Promise<DeliveryRecipient | Response> {
  const recipient = await deps.recipientsRepo.findActiveByTrustedSubject(identity.tenantId, identity.objectId);
  if (!recipient || !CHANGE_APPROVER_PROFILES.has(recipient.profile)) {
    return denyAuthorization(c, deps, identity, traceId, {
      code: "E-APR-AUTHZ-PROFILE",
      profile: recipient?.profile ?? null,
    });
  }
  if (recipient.profile === "PRF-L" && recipient.scopeMode !== "project") {
    return denyAuthorization(c, deps, identity, traceId, {
      code: "E-APR-AUTHZ-SCOPE",
      profile: recipient.profile,
      scopeMode: recipient.scopeMode,
    });
  }
  return recipient;
}

function changeDecisionAccess(
  approval: { projectId: string | null },
  recipient: DeliveryRecipient,
): { canDecide: boolean; decisionDisabledReason: string | null } {
  if (recipient.profile === "PRF-G") return { canDecide: true, decisionDisabledReason: null };
  if (approval.projectId === null) {
    return {
      canDecide: false,
      decisionDisabledReason: "プロジェクト未特定の承認は全体管理者のみ判断できます。",
    };
  }
  const canDecide = recipient.projects.includes(approval.projectId);
  return {
    canDecide,
    decisionDisabledReason: canDecide ? null : "担当プロジェクト外のため判断できません。",
  };
}

function authenticate(c: Context, body: string, deps: ApprovalRoutesDeps): AuthenticatedIdentity | Response {
  const tenantId = c.req.header("x-aiops-entra-tenant-id") ?? "";
  const objectId = c.req.header("x-aiops-entra-object-id") ?? "";
  const issuedAt = c.req.header("x-aiops-issued-at") ?? "";
  const issuedAtUnix = Number(issuedAt);
  if (!Number.isSafeInteger(issuedAtUnix) || String(issuedAtUnix) !== issuedAt) {
    return c.json({ error: "authentication required" }, 401);
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
  return valid ? { tenantId, objectId } : c.json({ error: "authentication required" }, 401);
}

function errorResponse(c: Context, error: unknown): Response {
  if (error instanceof ApprovalAlreadyDecidedError) {
    return c.json({ error: "approval already decided", status: error.status }, 409);
  }
  if (error instanceof ApprovalNotFoundError) return c.json({ error: "approval not found" }, 404);
  if (error instanceof SyntaxError || (error instanceof Error && /Invalid approval|E-AUD01/.test(error.message))) {
    return c.json({ error: "invalid approval decision" }, 400);
  }
  throw error;
}

export function registerApprovalRoutes(app: Hono, deps: ApprovalRoutesDeps | undefined): void {
  app.get("/approvals", async (c) => {
    if (!deps?.identitySecret) return c.json({ error: "approvals disabled" }, 503);
    const identity = authenticate(c, "", deps);
    if (identity instanceof Response) return identity;
    const traceId = deps.traceIdProvider();
    const authorization = await authorizeChangeApprover(c, deps, identity, traceId);
    if (authorization instanceof Response) return authorization;
    const approvals = await deps.approvalsRepo.listPending(["change"]);
    return c.json({
      approvals: approvals.map((approval) => ({
        ...approval,
        ...changeDecisionAccess(approval, authorization),
      })),
    });
  });

  app.use(
    "/approvals/:approvalId/decision",
    bodyLimit({
      maxSize: APPROVAL_DECISION_MAX_BYTES,
      onError: (c) => c.json({ error: "payload too large", maxBytes: APPROVAL_DECISION_MAX_BYTES }, 413),
    }),
  );
  app.post("/approvals/:approvalId/decision", async (c) => {
    if (!deps?.identitySecret) return c.json({ error: "approvals disabled" }, 503);
    const body = await c.req.text();
    const identity = authenticate(c, body, deps);
    if (identity instanceof Response) return identity;
    try {
      const traceId = deps.traceIdProvider();
      const authorization = await authorizeChangeApprover(c, deps, identity, traceId);
      if (authorization instanceof Response) return authorization;
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const decision = parsed.decision;
      if (decision !== "approved" && decision !== "rejected") throw new Error("Invalid approval decision");
      const reason = parsed.reason;
      if (reason !== undefined && typeof reason !== "string") throw new Error("Invalid approval reason");
      if (typeof reason === "string" && reason.trim().length > APPROVAL_REASON_MAX_LENGTH) {
        throw new Error("Invalid approval reason");
      }
      if (decision === "rejected" && (!reason || reason.trim() === "")) throw new Error("Invalid approval reason");
      const approvalId = c.req.param("approvalId");
      const existing = await deps.approvalsRepo.getById(approvalId);
      if (!existing) throw new ApprovalNotFoundError(approvalId);
      if (existing.approvalType !== "change") {
        return denyAuthorization(c, deps, identity, traceId, {
          code: "E-APR-AUTHZ-TYPE",
          approvalId,
          approvalType: existing.approvalType,
        });
      }
      const canDecide = await deps.recipientsRepo.canDecideChangeByTrustedSubject(
        identity.tenantId,
        identity.objectId,
        existing.projectId,
      );
      if (!canDecide) {
        return denyAuthorization(c, deps, identity, traceId, {
          code: "E-APR-AUTHZ-PROJECT",
          approvalId,
          projectId: existing.projectId,
          profile: authorization.profile,
          scopeMode: authorization.scopeMode,
        });
      }
      const approval = await deps.approvalsRepo.decide(approvalId, {
        decision,
        reason,
        approverTenantId: identity.tenantId,
        approverObjectId: identity.objectId,
        traceId,
      });
      return c.json({ approval });
    } catch (error) {
      return errorResponse(c, error);
    }
  });
}
