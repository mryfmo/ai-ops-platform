/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-005。 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Session } from "next-auth";
import type { AuditLogWriter } from "@aiops/shared";

import { requireSession } from "./authGuard";
import { handleWorkbenchWorkspace, type WorkbenchWorkspace } from "./workbenchClient";

const HANDOFF_PATH = "/app/api/workbench/handoff";
const MAX_TOKEN_LENGTH = 2_048;
const MAX_TTL_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DIGEST = /^[A-Za-z0-9_-]{43}$/u;
const TOKEN = /^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/u;

declare const workbenchHandoffLink: unique symbol;
export type WorkbenchHandoffLink = string & { readonly [workbenchHandoffLink]: true };

export interface MintWorkbenchHandoffInput {
  workspaceId: string;
  conversationId: string;
  threadId: string;
  workflowId: string;
  identity: {
    provider: "microsoft-entra";
    tenantId: string;
    subjectId: string;
  };
  expiresAtUnix: number;
}

interface HandoffClaims {
  v: 1;
  n: string;
  w: string;
  c: string;
  t: string;
  f: string;
  i: string;
  a: number;
  e: number;
}

export interface MintWorkbenchHandoffDeps {
  publicBaseUrl: string;
  secret: string;
  nowUnix?: () => number;
  nonceProvider?: () => string;
}

export interface WorkbenchHandoffHandlerDeps {
  getSession: () => Promise<Session | null>;
  handoffSecret?: string;
  identitySecret?: string;
  serverBaseUrl: string;
  consumeOnce?: (nonce: string, expiresAtUnix: number) => Promise<boolean>;
  fetchImpl?: typeof fetch;
  auditLog: AuditLogWriter;
  traceIdProvider?: () => string;
  nowUnix?: () => number;
}

function hmac(value: string, secret: string, domain: string): string {
  return createHmac("sha256", secret).update(`${domain}\0${value}`).digest("base64url");
}

function sameDigest(left: string, right: string): boolean {
  if (!DIGEST.test(left) || !DIGEST.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "base64url"), Buffer.from(right, "base64url"));
}

function identityBinding(tenantId: string, subjectId: string, secret: string): string {
  return hmac(`${tenantId}\0${subjectId}`, secret, "aiops-workbench-handoff-identity-v1");
}

function isExactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isReference(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) return false;
  return [...value].every((character) => {
    const code = character.codePointAt(0)!;
    return code > 0x20 && code !== 0x7f;
  });
}

function validateMintInput(input: MintWorkbenchHandoffInput): void {
  if (
    !isExactObject(input, ["conversationId", "expiresAtUnix", "identity", "threadId", "workflowId", "workspaceId"]) ||
    !isExactObject(input.identity, ["provider", "subjectId", "tenantId"])
  ) {
    throw new Error("Workbench handoff input has an unknown or missing field");
  }
  if (
    input.identity.provider !== "microsoft-entra" ||
    !UUID.test(input.identity.tenantId) ||
    !UUID.test(input.identity.subjectId) ||
    !UUID.test(input.workspaceId) ||
    !isReference(input.conversationId) ||
    !isReference(input.threadId) ||
    !isReference(input.workflowId) ||
    !Number.isSafeInteger(input.expiresAtUnix)
  ) {
    throw new Error("Invalid Workbench handoff input");
  }
}

export function mintWorkbenchHandoffLink(
  input: MintWorkbenchHandoffInput,
  deps: MintWorkbenchHandoffDeps,
): WorkbenchHandoffLink {
  validateMintInput(input);
  if (deps.secret.length < 32) throw new Error("Workbench handoff secret must contain at least 32 characters");

  const base = new URL(deps.publicBaseUrl);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("Workbench handoff requires an HTTPS public base URL");
  }
  const now = deps.nowUnix?.() ?? Math.floor(Date.now() / 1_000);
  if (!Number.isSafeInteger(now) || input.expiresAtUnix <= now) {
    throw new Error("Workbench handoff expiry must be in the future");
  }
  if (input.expiresAtUnix - now > MAX_TTL_SECONDS) {
    throw new Error("Workbench handoff must be short-lived (at most 300 seconds)");
  }
  const nonce = deps.nonceProvider?.() ?? randomUUID();
  if (!UUID.test(nonce)) throw new Error("Invalid Workbench handoff nonce");

  const claims: HandoffClaims = {
    v: 1,
    n: nonce,
    w: input.workspaceId,
    c: input.conversationId,
    t: input.threadId,
    f: input.workflowId,
    i: identityBinding(input.identity.tenantId, input.identity.subjectId, deps.secret),
    a: now,
    e: input.expiresAtUnix,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const unsigned = `v1.${payload}`;
  const token = `${unsigned}.${hmac(unsigned, deps.secret, "aiops-workbench-handoff-token-v1")}`;
  const link = new URL(HANDOFF_PATH, base.origin);
  link.searchParams.set("token", token);
  return link.toString() as WorkbenchHandoffLink;
}

function parseClaims(
  token: string,
  secret: string,
  tenantId: string,
  subjectId: string,
  now: number,
): HandoffClaims | null {
  if (token.length > MAX_TOKEN_LENGTH || secret.length < 32) return null;
  const match = TOKEN.exec(token);
  if (!match) return null;
  const unsigned = `v1.${match[1]}`;
  if (!sameDigest(match[2]!, hmac(unsigned, secret, "aiops-workbench-handoff-token-v1"))) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(match[1]!, "base64url").toString("utf8"));
    if (!isExactObject(parsed, ["a", "c", "e", "f", "i", "n", "t", "v", "w"])) return null;
    if (
      parsed.v !== 1 ||
      typeof parsed.n !== "string" ||
      typeof parsed.w !== "string" ||
      typeof parsed.c !== "string" ||
      typeof parsed.t !== "string" ||
      typeof parsed.f !== "string" ||
      typeof parsed.i !== "string" ||
      typeof parsed.a !== "number" ||
      typeof parsed.e !== "number" ||
      !UUID.test(parsed.n) ||
      !UUID.test(parsed.w) ||
      !isReference(parsed.c) ||
      !isReference(parsed.t) ||
      !isReference(parsed.f) ||
      !Number.isSafeInteger(parsed.a) ||
      !Number.isSafeInteger(parsed.e) ||
      parsed.a > now ||
      parsed.e <= now ||
      parsed.e <= parsed.a ||
      parsed.e - parsed.a > MAX_TTL_SECONDS ||
      !sameDigest(parsed.i, identityBinding(tenantId, subjectId, secret))
    ) {
      return null;
    }
    return parsed as unknown as HandoffClaims;
  } catch {
    return null;
  }
}

const DENIAL = { error: "workbench handoff unavailable" } as const;

export async function handleWorkbenchHandoff(request: Request, deps: WorkbenchHandoffHandlerDeps): Promise<Response> {
  const now = deps.nowUnix?.() ?? Math.floor(Date.now() / 1_000);
  const traceId = deps.traceIdProvider?.() ?? randomUUID();
  let actor = "ANONYMOUS";
  const deny = async (code: string): Promise<Response> => {
    try {
      await deps.auditLog.append({
        trace_id: traceId,
        actor,
        action: "workbench_handoff_denied",
        basis: "FinalArch:FR-UI-003",
        detail: { code },
        at: new Date(now * 1_000).toISOString(),
      });
    } catch {
      // The response remains non-reflective even when the append-only audit authority is unavailable.
    }
    return Response.json(DENIAL, { status: 404 });
  };

  let session;
  try {
    session = await requireSession(deps.getSession);
    actor = `ENTRA:${session.user.subject.tenantId}:${session.user.subject.objectId}`;
  } catch {
    return deny("authentication_failed");
  }
  if (!deps.handoffSecret || !deps.identitySecret || !deps.consumeOnce) return deny("handoff_disabled");

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const queryKeys = [...url.searchParams.keys()];
  if (url.pathname !== HANDOFF_PATH || !token || queryKeys.length !== 1 || queryKeys[0] !== "token") {
    return deny("invalid_token");
  }
  const claims = parseClaims(
    token,
    deps.handoffSecret,
    session.user.subject.tenantId,
    session.user.subject.objectId,
    now,
  );
  if (!claims) return deny("invalid_token");

  try {
    if (!(await deps.consumeOnce(claims.n, claims.e))) return deny("token_replayed");
  } catch {
    return deny("replay_authority_unavailable");
  }

  const workspaceResponse = await handleWorkbenchWorkspace(claims.w, {
    getSession: async () => session,
    serverBaseUrl: deps.serverBaseUrl,
    identitySecret: deps.identitySecret,
    fetchImpl: deps.fetchImpl,
    nowUnix: () => now,
  });
  if (!workspaceResponse.ok) return deny("authorization_failed");
  const workspace = (await workspaceResponse.json()) as WorkbenchWorkspace;
  if (!workspace.runs.some((run) => run.workflowId === claims.f)) return deny("authorization_failed");

  try {
    await deps.auditLog.append({
      trace_id: traceId,
      actor,
      action: "workbench_handoff_consumed",
      basis: "FinalArch:FR-UI-003",
      detail: { workspaceId: claims.w, workflowId: claims.f },
      at: new Date(now * 1_000).toISOString(),
    });
  } catch {
    return deny("audit_unavailable");
  }
  return Response.json({
    context: { workspaceId: claims.w, conversationId: claims.c, threadId: claims.t, workflowId: claims.f },
    workspace,
  });
}
