/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-005 */
import type { Session } from "next-auth";
import { InMemoryAuditLog } from "@aiops/shared";
import { verifyIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { describe, expect, it, vi } from "vitest";

import {
  handleWorkbenchHandoff,
  mintWorkbenchHandoffLink,
  type MintWorkbenchHandoffInput,
  type WorkbenchHandoffLink,
  type WorkbenchHandoffHandlerDeps,
} from "../src/server/workbenchHandoff.js";

const HANDOFF_SECRET = "handoff-secret-that-is-at-least-32-characters";
const IDENTITY_SECRET = "identity-secret-that-is-at-least-32-characters";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const DECISION_ID = "44444444-4444-4444-8444-444444444444";
const NONCE = "55555555-5555-4555-8555-555555555555";
const NOW = 1_786_118_400;

const identity = { provider: "microsoft-entra", tenantId: TENANT_ID, subjectId: OBJECT_ID } as const;
const mintInput: MintWorkbenchHandoffInput = {
  workspaceId: WORKSPACE_ID,
  conversationId: "agui-conversation-1",
  threadId: "agui-thread-1",
  workflowId: "incident/inc-1",
  identity,
  expiresAtUnix: NOW + 120,
};

// @ts-expect-error expiry is mandatory at the type boundary
const missingExpiry: MintWorkbenchHandoffInput = {
  workspaceId: WORKSPACE_ID,
  conversationId: "agui-conversation-1",
  threadId: "agui-thread-1",
  workflowId: "incident/inc-1",
  identity,
};
void missingExpiry;

// @ts-expect-error raw or LLM-produced strings cannot be treated as minted links
const unverifiedLink: WorkbenchHandoffLink = "https://workbench.example.test/attacker-controlled";
void unverifiedLink;

const workspace = {
  workspaceId: WORKSPACE_ID,
  kind: "project",
  projectId: "PJ-001",
  ownerUserId: "leader-1",
  createdAt: "2026-08-17T00:00:00.000Z",
  sources: [],
  runs: [
    {
      workflowId: "incident/inc-1",
      runId: "run-1",
      workflowType: "incident",
      status: "running",
      currentStep: "triage",
      updatedAt: "2026-08-17T00:01:00.000Z",
    },
  ],
  pendingActions: [],
  grant: {
    resourceType: "project",
    resourceId: "PJ-001",
    policyBundleVersion: "0.2.0",
    decisionId: DECISION_ID,
  },
};

function session(objectId = OBJECT_ID): () => Promise<Session> {
  return async () =>
    ({
      user: { subject: { tenantId: TENANT_ID, objectId }, roles: [] },
      expires: "2099-01-01",
    }) as Session;
}

function mint(input: MintWorkbenchHandoffInput = mintInput, nowUnix = NOW): string {
  return mintWorkbenchHandoffLink(input, {
    publicBaseUrl: "https://workbench.example.test",
    secret: HANDOFF_SECRET,
    nowUnix: () => nowUnix,
    nonceProvider: () => NONCE,
  });
}

function setup(
  options: {
    getSession?: () => Promise<Session | null>;
    nowUnix?: number;
    workspaceResponse?: Response;
    consume?: (nonce: string, expiresAtUnix: number) => Promise<boolean>;
  } = {},
) {
  const order: string[] = [];
  const auditLog = new InMemoryAuditLog();
  const consumed = new Set<string>();
  const consumeOnce = vi.fn(
    options.consume ??
      (async (nonce: string) => {
        order.push("consume");
        if (consumed.has(nonce)) return false;
        consumed.add(nonce);
        return true;
      }),
  );
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    order.push("fetch");
    const path = new URL(String(input)).pathname;
    const headers = new Headers(init?.headers);
    expect(
      verifyIdentityEnvelope(
        {
          method: "GET",
          path,
          body: "",
          tenantId: TENANT_ID,
          objectId: OBJECT_ID,
          issuedAtUnix: options.nowUnix ?? NOW,
        },
        headers.get("x-aiops-identity-signature"),
        IDENTITY_SECRET,
        options.nowUnix ?? NOW,
      ),
    ).toBe(true);
    return options.workspaceResponse ?? Response.json(workspace);
  });
  const deps: WorkbenchHandoffHandlerDeps = {
    getSession: options.getSession ?? session(),
    handoffSecret: HANDOFF_SECRET,
    identitySecret: IDENTITY_SECRET,
    serverBaseUrl: "http://127.0.0.1:8080",
    consumeOnce,
    fetchImpl,
    auditLog,
    traceIdProvider: () => "66666666-6666-4666-8666-666666666666",
    nowUnix: () => options.nowUnix ?? NOW,
  };
  return { deps, consumeOnce, fetchImpl, auditLog, order };
}

async function fixedDenial(response: Response): Promise<void> {
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "workbench handoff unavailable" });
}

describe("FinalArch:FR-UI-003 signed Teams-to-Workbench handoff", () => {
  it("mints a short-lived HTTPS token without identity, message, attachment, or secret content", () => {
    const link = mint();
    const token = new URL(link).searchParams.get("token")!;
    const payload = Buffer.from(token.split(".")[1]!, "base64url").toString("utf8");

    expect(link).toMatch(/^https:\/\/workbench\.example\.test\/app\/api\/workbench\/handoff\?token=v1\./u);
    expect(payload).not.toContain(TENANT_ID);
    expect(payload).not.toContain(OBJECT_ID);
    expect(payload).not.toContain(HANDOFF_SECRET);
    expect(payload).not.toContain("inputText");
    expect(payload).not.toContain("attachment");
  });

  it("rejects long-lived, expired-at-mint, extra-field, and non-HTTPS inputs", () => {
    expect(() => mint({ ...mintInput, expiresAtUnix: NOW + 301 })).toThrow("short-lived");
    expect(() => mint({ ...mintInput, expiresAtUnix: NOW })).toThrow("future");
    expect(() =>
      mintWorkbenchHandoffLink(
        { ...mintInput, inputText: "api_key=must-not-enter-link" } as MintWorkbenchHandoffInput,
        {
          publicBaseUrl: "https://workbench.example.test",
          secret: HANDOFF_SECRET,
          nowUnix: () => NOW,
          nonceProvider: () => NONCE,
        },
      ),
    ).toThrow("unknown or missing field");
    expect(() =>
      mintWorkbenchHandoffLink(mintInput, {
        publicBaseUrl: "http://workbench.example.test",
        secret: HANDOFF_SECRET,
        nowUnix: () => NOW,
        nonceProvider: () => NONCE,
      }),
    ).toThrow("HTTPS");
  });

  it("preserves workflow context only after identity verification, single-use consume, and current authorization", async () => {
    const link = mint();
    const { deps, consumeOnce, fetchImpl, auditLog, order } = setup();

    const response = await handleWorkbenchHandoff(new Request(link), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      context: {
        workspaceId: WORKSPACE_ID,
        conversationId: "agui-conversation-1",
        threadId: "agui-thread-1",
        workflowId: "incident/inc-1",
      },
      workspace,
    });
    expect(consumeOnce).toHaveBeenCalledWith(NONCE, NOW + 120);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["consume", "fetch"]);
    expect((await auditLog.readAll()).at(-1)).toMatchObject({ action: "workbench_handoff_consumed" });
  });

  it("rejects replay before a second Workbench authorization fetch", async () => {
    const link = mint();
    const { deps, fetchImpl } = setup();

    expect((await handleWorkbenchHandoff(new Request(link), deps)).status).toBe(200);
    await fixedDenial(await handleWorkbenchHandoff(new Request(link), deps));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["unsigned", "unsigned"],
    ["tampered", `${mint().slice(0, -1)}${mint().endsWith("a") ? "b" : "a"}`],
    ["expired", mint(mintInput, NOW)],
    ["duplicate query", `${mint()}&token=unsigned`],
  ])("returns one fixed denial for %s token", async (kind, linkOrToken) => {
    const nowUnix = kind === "expired" ? NOW + 120 : NOW;
    const request = new Request(
      kind === "unsigned"
        ? `https://workbench.example.test/app/api/workbench/handoff?token=${linkOrToken}`
        : linkOrToken,
    );
    const { deps, consumeOnce, fetchImpl } = setup({ nowUnix });

    await fixedDenial(await handleWorkbenchHandoff(request, deps));
    expect(consumeOnce).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a different authenticated identity before consuming the token", async () => {
    const { deps, consumeOnce, fetchImpl } = setup({ getSession: session("77777777-7777-4777-8777-777777777777") });

    await fixedDenial(await handleWorkbenchHandoff(new Request(mint()), deps));
    expect(consumeOnce).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when the replay authority is absent, rejects, or throws", async () => {
    const absent = setup();
    absent.deps.consumeOnce = undefined;
    await fixedDenial(await handleWorkbenchHandoff(new Request(mint()), absent.deps));
    expect(absent.fetchImpl).not.toHaveBeenCalled();

    for (const consume of [async () => false, async () => Promise.reject(new Error("store unavailable"))]) {
      const current = setup({ consume });
      await fixedDenial(await handleWorkbenchHandoff(new Request(mint()), current.deps));
      expect(current.fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("rejects a grant-external workflow and upstream denial with the same non-reflective response", async () => {
    const outside = setup({ workspaceResponse: Response.json({ ...workspace, runs: [] }) });
    await fixedDenial(await handleWorkbenchHandoff(new Request(mint()), outside.deps));
    expect(outside.fetchImpl).toHaveBeenCalledTimes(1);

    const upstream = setup({ workspaceResponse: Response.json({ error: "secret workspace" }, { status: 404 }) });
    await fixedDenial(await handleWorkbenchHandoff(new Request(mint()), upstream.deps));
    expect(upstream.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never records the token or a reflected failure value in audit details", async () => {
    const token = new URL(mint()).searchParams.get("token")!;
    const marker = "api_key=must-not-be-reflected";
    const { deps, auditLog } = setup();

    await fixedDenial(
      await handleWorkbenchHandoff(
        new Request(`https://workbench.example.test/app/api/workbench/handoff?token=${encodeURIComponent(marker)}`),
        deps,
      ),
    );
    const serialized = JSON.stringify(await auditLog.readAll());
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(marker);
  });
});
