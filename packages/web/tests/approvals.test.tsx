/**
 * @vitest-environment jsdom
 * packages/web/tests/approvals.test.tsx
 *
 * 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / DEC-SPEC-002 / AUD-OPM-001。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";
import { verifyIdentityEnvelope } from "@aiops/shared/security/identityEnvelope.js";
import { ApprovalsPanel } from "../src/app/approvals/ApprovalsPanel";
import { handleApprovalDecision, handleListApprovals, type ApprovalsClientDeps } from "../src/server/approvalsClient";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SECRET = "web-bff-identity-secret-of-at-least-32-chars";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const APPROVAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION = 7;
const CORRELATION = `v1.${"a".repeat(64)}`;
const NOW = 1_786_118_400;
const session = async () =>
  ({
    user: { subject: { tenantId: TENANT_ID, objectId: OBJECT_ID }, roles: [] },
    expires: "2099-01-01",
  }) as Session;

function deps(
  fetchImpl: typeof fetch,
  authenticated = true,
  identitySecret: string | undefined = SECRET,
): ApprovalsClientDeps {
  return {
    getSession: authenticated ? session : async () => null,
    serverBaseUrl: "http://127.0.0.1:8080",
    publicBaseUrl: "https://aiops.example.com",
    identitySecret,
    fetchImpl,
    nowUnix: () => NOW,
  };
}

describe("approvals WebUI BFF [DevOps:REQ-028 / DEC-SPEC-002]", () => {
  it("未認証は401、identity secret未設定は503でupstreamを呼ばない", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect((await handleListApprovals(deps(fetchImpl, false))).status).toBe(401);
    expect((await handleListApprovals(deps(fetchImpl, true, ""))).status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("session由来subjectだけでGET envelopeを署名してpending一覧を転送する", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      expect(url.pathname).toBe("/approvals");
      expect(headers.get("x-aiops-entra-tenant-id")).toBe(TENANT_ID);
      expect(headers.get("x-aiops-entra-object-id")).toBe(OBJECT_ID);
      expect(
        verifyIdentityEnvelope(
          {
            method: "GET",
            path: "/approvals",
            body: "",
            tenantId: TENANT_ID,
            objectId: OBJECT_ID,
            issuedAtUnix: NOW,
          },
          headers.get("x-aiops-identity-signature"),
          SECRET,
          NOW,
        ),
      ).toBe(true);
      return Response.json({ approvals: [] });
    });
    expect((await handleListApprovals(deps(fetchImpl))).status).toBe(200);
  });

  it("decideはsame-originとsession subjectを強制しclientのapprover申告を転送しない", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      const body = String(init?.body);
      const headers = new Headers(init?.headers);
      expect(JSON.parse(body)).toEqual({
        action: "approval_decision",
        approvalId: APPROVAL_ID,
        version: VERSION,
        correlation: CORRELATION,
        decision: "rejected",
        reason: "risk evidence missing",
      });
      expect(body).not.toContain("99999999");
      expect(
        verifyIdentityEnvelope(
          {
            method: "POST",
            path,
            body,
            tenantId: TENANT_ID,
            objectId: OBJECT_ID,
            issuedAtUnix: NOW,
          },
          headers.get("x-aiops-identity-signature"),
          SECRET,
          NOW,
        ),
      ).toBe(true);
      return Response.json({ approval: { approvalId: APPROVAL_ID, status: "rejected" } });
    });
    const request = new Request(`https://aiops.example.com/app/api/approvals/${APPROVAL_ID}`, {
      method: "POST",
      headers: { origin: "https://aiops.example.com", "content-type": "application/json" },
      body: JSON.stringify({
        decision: "rejected",
        reason: "risk evidence missing",
        version: VERSION,
        correlation: CORRELATION,
        approverObjectId: "99999999-9999-4999-8999-999999999999",
      }),
    });
    expect((await handleApprovalDecision(request, APPROVAL_ID, deps(fetchImpl))).status).toBe(200);

    const crossOrigin = new Request(`https://aiops.example.com/app/api/approvals/${APPROVAL_ID}`, {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved", version: VERSION, correlation: CORRELATION }),
    });
    expect((await handleApprovalDecision(crossOrigin, APPROVAL_ID, deps(fetchImpl))).status).toBe(403);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("JSON nullはupstreamへ転送せず400でfail closedにする", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const request = new Request(`https://aiops.example.com/app/api/approvals/${APPROVAL_ID}`, {
      method: "POST",
      headers: { origin: "https://aiops.example.com", "content-type": "application/json" },
      body: "null",
    });

    const response = await handleApprovalDecision(request, APPROVAL_ID, deps(fetchImpl));

    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

const pending = {
  approvalId: APPROVAL_ID,
  approvalType: "change",
  targetId: "release-42",
  status: "pending",
  requestedBy: "AGT-CHG",
  approverTenantId: null,
  approverObjectId: null,
  decidedAt: null,
  reason: null,
  canDecide: true,
  decisionDisabledReason: null,
  version: VERSION,
  correlation: CORRELATION,
  createdAt: "2026-08-08T00:00:00.000Z",
};

async function renderPanel(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  vi.stubGlobal("fetch", fetchMock);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<ApprovalsPanel />));
  await act(async () => Promise.resolve());
  return { container, root };
}

describe("approvals screen [DevOps:SPEC-EXT-010 / AUD-OPM-001]", () => {
  it("pending一覧を表示してapprove後に対象を除く", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ approvals: [pending] }))
      .mockResolvedValueOnce(Response.json({ approval: { ...pending, status: "approved" } }));
    const { container, root } = await renderPanel(fetchMock);
    expect(container.textContent).toContain("release-42");
    const approve = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "承認")!;
    await act(async () => approve.click());
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/app/api/approvals/${APPROVAL_ID}`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decision: "approved", version: VERSION, correlation: CORRELATION }),
      }),
    );
    expect(container.textContent).not.toContain("release-42");
    await act(async () => root.unmount());
  });

  it("DevOps:REQ-010 / M-18: 初回fetch完了前はloadingを表示しfalse empty stateを出さない", async () => {
    let resolveList!: (response: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveList = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>(() => pendingResponse);
    const { container, root } = await renderPanel(fetchMock);

    expect(container.textContent).toContain("読み込み中");
    expect(container.textContent).not.toContain("承認待ちの項目はありません。");

    await act(async () => {
      resolveList(Response.json({ approvals: [] }));
      await pendingResponse;
    });
    expect(container.textContent).not.toContain("読み込み中");
    expect(container.textContent).toContain("承認待ちの項目はありません。");
    await act(async () => root.unmount());
  });

  it.each([
    [400, "承認内容が正しくありません。"],
    [401, "認証の有効期限が切れました。再ログインしてください。"],
    [403, "この承認を操作する権限がありません。"],
    [409, "承認状態が更新されています。一覧を再読み込みしてください。"],
    [503, "承認機能は現在準備中です"],
  ])("DevOps:REQ-010: decision失敗 %i を利用者へ明示する", async (status, message) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ approvals: [pending] }))
      .mockResolvedValueOnce(Response.json({ error: "upstream error" }, { status }));
    const { container, root } = await renderPanel(fetchMock);
    const approve = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "承認")!;

    await act(async () => approve.click());

    expect(container.textContent).toContain(message);
    expect(container.textContent).toContain("release-42");
    await act(async () => root.unmount());
  });

  it("rejectは理由入力前に実行できない", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ approvals: [pending] }));
    const { container, root } = await renderPanel(fetchMock);
    const reject = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "差し戻し",
    )!;
    expect(reject.disabled).toBe(true);
    const reason = container.querySelector<HTMLTextAreaElement>("textarea")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(reason, "test evidence missing");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(reject.disabled).toBe(false);
    await act(async () => root.unmount());
  });

  it("DevOps:REQ-010: 域外行を表示したまま操作を無効化し理由を示す", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        approvals: [
          {
            ...pending,
            canDecide: false,
            decisionDisabledReason: "担当プロジェクト外のため判断できません。",
          },
        ],
      }),
    );
    const { container, root } = await renderPanel(fetchMock);
    expect(container.textContent).toContain("release-42");
    expect(container.textContent).toContain("担当プロジェクト外のため判断できません。");
    expect(container.querySelector<HTMLTextAreaElement>("textarea")!.disabled).toBe(true);
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    expect(buttons.every((button) => button.disabled)).toBe(true);
    await act(async () => buttons[0]!.click());
    expect(fetchMock).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});
