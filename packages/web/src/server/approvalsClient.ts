/**
 * packages/web/src/server/approvalsClient.ts
 *
 * 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / DEC-SPEC-002 / AUD-OPM-001。
 * Auth.js session由来のstable subjectだけを専用HMAC envelopeへ入れ、ブラウザ入力のidentityは捨てる。
 */
import type { Session } from "next-auth";
import { signIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { requireSession, UnauthorizedError } from "./authGuard";

export interface ApprovalsClientDeps {
  getSession: () => Promise<Session | null>;
  serverBaseUrl: string;
  publicBaseUrl: string;
  identitySecret?: string;
  fetchImpl?: typeof fetch;
  nowUnix?: () => number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function authError(error: unknown): Response {
  if (error instanceof UnauthorizedError) return Response.json({ error: error.message }, { status: 401 });
  throw error;
}

function sameOrigin(request: Request, publicBaseUrl: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(publicBaseUrl).origin;
}

function identityHeaders(
  method: string,
  path: string,
  body: string,
  subject: { tenantId: string; objectId: string },
  secret: string,
  issuedAtUnix: number,
): Record<string, string> {
  return {
    "x-aiops-entra-tenant-id": subject.tenantId,
    "x-aiops-entra-object-id": subject.objectId,
    "x-aiops-issued-at": String(issuedAtUnix),
    "x-aiops-identity-signature": signIdentityEnvelope(
      { method, path, body, tenantId: subject.tenantId, objectId: subject.objectId, issuedAtUnix },
      secret,
    ),
  };
}

async function safeUpstreamResponse(response: Response): Promise<Response> {
  if (!response.ok)
    return Response.json({ error: "approvals service rejected the request" }, { status: response.status });
  try {
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ error: "approvals service returned an invalid response" }, { status: 502 });
  }
}

export async function handleListApprovals(deps: ApprovalsClientDeps): Promise<Response> {
  let session;
  try {
    session = await requireSession(deps.getSession);
  } catch (error) {
    return authError(error);
  }
  if (!deps.identitySecret) return Response.json({ error: "approvals disabled" }, { status: 503 });
  const path = "/approvals";
  const issuedAtUnix = deps.nowUnix?.() ?? Math.floor(Date.now() / 1000);
  try {
    const upstream = await (deps.fetchImpl ?? fetch)(new URL(path, deps.serverBaseUrl), {
      headers: identityHeaders("GET", path, "", session.user.subject, deps.identitySecret, issuedAtUnix),
    });
    return safeUpstreamResponse(upstream);
  } catch {
    return Response.json({ error: "approvals service unavailable" }, { status: 502 });
  }
}

export async function handleApprovalDecision(
  request: Request,
  approvalId: string,
  deps: ApprovalsClientDeps,
): Promise<Response> {
  let session;
  try {
    session = await requireSession(deps.getSession);
  } catch (error) {
    return authError(error);
  }
  if (!sameOrigin(request, deps.publicBaseUrl)) return Response.json({ error: "invalid origin" }, { status: 403 });
  if (!deps.identitySecret) return Response.json({ error: "approvals disabled" }, { status: 503 });
  if (!UUID.test(approvalId)) return Response.json({ error: "invalid approval" }, { status: 400 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid approval decision" }, { status: 400 });
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return Response.json({ error: "invalid approval decision" }, { status: 400 });
  }
  const decisionInput = input as Record<string, unknown>;
  const decision = decisionInput.decision;
  const reason = decisionInput.reason;
  if (decision !== "approved" && decision !== "rejected") {
    return Response.json({ error: "invalid approval decision" }, { status: 400 });
  }
  if (reason !== undefined && typeof reason !== "string") {
    return Response.json({ error: "invalid approval reason" }, { status: 400 });
  }
  if (decision === "rejected" && (!reason || reason.trim() === "")) {
    return Response.json({ error: "rejection reason required" }, { status: 400 });
  }

  const payload = reason === undefined ? { decision } : { decision, reason: reason.trim() };
  const body = JSON.stringify(payload);
  const path = `/approvals/${approvalId}/decision`;
  const issuedAtUnix = deps.nowUnix?.() ?? Math.floor(Date.now() / 1000);
  try {
    const upstream = await (deps.fetchImpl ?? fetch)(new URL(path, deps.serverBaseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...identityHeaders("POST", path, body, session.user.subject, deps.identitySecret, issuedAtUnix),
      },
      body,
    });
    return safeUpstreamResponse(upstream);
  } catch {
    return Response.json({ error: "approvals service unavailable" }, { status: 502 });
  }
}
