/**
 * packages/web/tests/xlsxImportHandler.test.ts
 * 根拠: REQ-037 / PrjOps:SPEC-INT-063 / AC-037-1 / ADR-0008 / AUD-OPM-002 / AUD-OPM-015。
 */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { handleXlsxImport, handleXlsxTemplate, type XlsxImportHandlerDeps } from "../src/server/xlsxImportHandler";
import { XLSX_IMPORT_MAX_BYTES } from "../src/server/xlsxImportPolicy";

const SECRET = "xlsx-import-secret-32-bytes-minimum";
const session = async () => ({ user: { email: "user@example.com" }, expires: "2099-01-01" }) as Session;

function deps(fetchImpl: typeof fetch, authenticated = true): XlsxImportHandlerDeps {
  return {
    getSession: authenticated ? session : async () => null,
    serverBaseUrl: "http://127.0.0.1:8080",
    publicBaseUrl: "https://aiops.example.com/app",
    importSecret: SECRET,
    fetchImpl,
  };
}

function request(body: BodyInit, suffix = "operation=dry-run", headers: Record<string, string> = {}): Request {
  return new Request(`https://aiops.example.com/app/api/xlsx-import?${suffix}`, {
    method: "POST",
    headers: { origin: "https://aiops.example.com", "x-aiops-filename": "plan.xlsx", ...headers },
    body,
  });
}

function streamedRequest(chunks: Uint8Array[], onCancel?: () => void): Request {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else if (!onCancel) controller.close();
    },
    cancel: onCancel,
  });
  return new Request("https://aiops.example.com/app/api/xlsx-import?operation=dry-run", {
    method: "POST",
    headers: { origin: "https://aiops.example.com", "x-aiops-filename": "plan.xlsx" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("Excel取込web handler [REQ-037 / PrjOps:SPEC-INT-063 / AC-037-1]", () => {
  it("未認証を401で拒否しupstreamを呼ばない", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const response = await handleXlsxImport(request("xlsx"), deps(fetchImpl, false));
    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("raw bytesをHMAC署名しcontent typeと安全なbasenameを保ってdry-runへ転送する", async () => {
    const body = new Uint8Array([0, 1, 2, 255]);
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const forwarded = new Uint8Array(init?.body as ArrayBuffer);
      expect(forwarded).toEqual(body);
      expect(new Headers(init?.headers).get("x-aiops-signature-256")).toBe(
        `sha256=${createHmac("sha256", SECRET).update(forwarded).digest("hex")}`,
      );
      expect(new Headers(init?.headers).get("content-type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(new Headers(init?.headers).get("x-aiops-filename")).toBe("plan.xlsx");
      return Response.json({
        ok: false,
        rowCount: 0,
        errors: [{ sheet: "issues", row: 2, column: "title", message: "required value missing" }],
        summary: "rejected",
      });
    });
    const response = await handleXlsxImport(
      request(body, "operation=dry-run", {
        "content-type": "application/x-test-xlsx",
        "x-aiops-filename": "..%2Fplan.xlsx",
      }),
      deps(fetchImpl),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ errors: [{ sheet: "issues", row: 2, column: "title" }] });
  });

  it("executeは明示確認なしを409、確認ありだけupstreamへ転送する", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get("x-confirm-import")).toBe("yes");
      return Response.json({ ok: true, result: { summary: "done" } });
    });
    const unconfirmed = await handleXlsxImport(
      request("xlsx", "operation=execute&owner=acme&repo=widget"),
      deps(fetchImpl),
    );
    expect(unconfirmed.status).toBe(409);
    const confirmed = await handleXlsxImport(
      request("xlsx", "operation=execute&owner=acme&repo=widget", { "x-confirm-import": "yes" }),
      deps(fetchImpl),
    );
    expect(confirmed.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("同一origin以外とContent-Length超過をbody読取前に拒否する", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const crossOrigin = request("xlsx", "operation=dry-run", { origin: "https://evil.example" });
    expect((await handleXlsxImport(crossOrigin, deps(fetchImpl))).status).toBe(403);
    const oversized = request("x", "operation=dry-run", { "content-length": String(XLSX_IMPORT_MAX_BYTES + 1) });
    expect((await handleXlsxImport(oversized, deps(fetchImpl))).status).toBe(413);
    expect(oversized.body?.locked).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("chunked 10MiB超過をcancelしupstreamより前に413で拒否する", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const cancelled = vi.fn();
    const oversized = streamedRequest([new Uint8Array(6 * 1024 * 1024), new Uint8Array(5 * 1024 * 1024)], cancelled);

    expect((await handleXlsxImport(oversized, deps(fetchImpl))).status).toBe(413);
    expect(cancelled).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exactly 10MiBをHMAC署名してupstreamへ転送する", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect((init?.body as ArrayBuffer).byteLength).toBe(XLSX_IMPORT_MAX_BYTES);
      return Response.json({ ok: true, rowCount: 0, errors: [], summary: "accepted" });
    });

    const response = await handleXlsxImport(
      streamedRequest([new Uint8Array(4 * 1024 * 1024), new Uint8Array(6 * 1024 * 1024)]),
      deps(fetchImpl),
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("upstreamの内部エラー本文をブラウザへ漏らさない", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ error: "postgres password=secret" }, { status: 500 }),
    );
    const response = await handleXlsxImport(request("xlsx"), deps(fetchImpl));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("password");
  });

  it("templateは認証と空byte HMACを要求してxlsxだけを返す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get("x-aiops-signature-256")).toBe(
        `sha256=${createHmac("sha256", SECRET).digest("hex")}`,
      );
      return new Response("xlsx");
    });
    expect((await handleXlsxTemplate(deps(fetchImpl, false))).status).toBe(401);
    const response = await handleXlsxTemplate(deps(fetchImpl));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("aiops-import-template.xlsx");
  });
});
