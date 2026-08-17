/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003。 */
import type { Session } from "next-auth";
import { z } from "zod";
import { signIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";

import { requireSession, UnauthorizedError } from "./authGuard";

const sourceSchema = z
  .object({
    sourceRefId: z.uuid(),
    sourceSystem: z.enum(["github", "sharepoint", "confluence", "temporal"]),
    sourceType: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/u),
    externalId: z.string().min(1).max(512),
    canonicalUrl: z.url().refine((url) => url.startsWith("https://")),
  })
  .strict();

const runSchema = z
  .object({
    workflowId: z.string().min(1),
    runId: z.string().min(1),
    workflowType: z.string().min(1),
    status: z.enum(["accepted", "running", "waiting", "completed", "failed", "cancelled"]),
    currentStep: z.string().nullable(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

const pendingActionSchema = z
  .object({
    operationId: z.uuid(),
    approvalId: z.uuid(),
    workflowId: z.string().min(1),
    actionStatus: z.enum([
      "planned",
      "approval_pending",
      "approved",
      "applying",
      "applied",
      "rejected",
      "failed",
      "unknown",
      "compensated",
    ]),
    approvalStatus: z.enum(["pending", "approved", "rejected"]),
  })
  .strict();

const grantSchema = z
  .object({
    resourceType: z.enum(["project", "repository", "space"]),
    resourceId: z.string().min(1).max(512),
    policyBundleVersion: z.string().min(1).max(128),
    decisionId: z.uuid().nullable(),
  })
  .strict();

const workspaceSchema = z
  .object({
    workspaceId: z.uuid(),
    kind: z.enum(["project", "repository", "meeting", "incident"]),
    projectId: z.string().min(1),
    ownerUserId: z.string().min(1),
    createdAt: z.iso.datetime(),
    sources: z.array(sourceSchema),
    runs: z.array(runSchema),
    pendingActions: z.array(pendingActionSchema),
    grant: grantSchema,
  })
  .strict();

export type WorkbenchWorkspace = z.infer<typeof workspaceSchema>;

export interface WorkbenchClientDeps {
  getSession: () => Promise<Session | null>;
  serverBaseUrl: string;
  identitySecret?: string;
  fetchImpl?: typeof fetch;
  nowUnix?: () => number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function handleWorkbenchWorkspace(workspaceId: string, deps: WorkbenchClientDeps): Promise<Response> {
  if (!UUID.test(workspaceId)) return Response.json({ error: "invalid workspace id" }, { status: 400 });
  let session;
  try {
    session = await requireSession(deps.getSession);
  } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ error: error.message }, { status: 401 });
    throw error;
  }
  if (!deps.identitySecret) return Response.json({ error: "Workbench disabled" }, { status: 503 });

  const path = `/workbench/workspaces/${workspaceId}`;
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
      return Response.json({ error: "Workbench service rejected the request" }, { status: upstream.status });
    }
    const parsed = workspaceSchema.safeParse(await upstream.json());
    return parsed.success
      ? Response.json(parsed.data)
      : Response.json({ error: "Workbench service returned an invalid reference model" }, { status: 502 });
  } catch {
    return Response.json({ error: "Workbench service unavailable" }, { status: 502 });
  }
}
