/**
 * packages/web/src/server/xlsxImportHandler.ts
 *
 * 根拠: REQ-037 / PrjOps:SPEC-INT-063 / AC-037-1 / ADR-0008 / AUD-OPM-002 / AUD-OPM-015。
 * 認証済みブラウザから受けたxlsxを、秘密を公開せずHMAC署名して常駐サーバーへ転送する。
 */
import { createHmac } from "node:crypto";
import type { Session } from "next-auth";
import { requireSession, UnauthorizedError } from "./authGuard";
import { readXlsxBody, XLSX_IMPORT_MAX_BYTES } from "./xlsxImportPolicy";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface XlsxImportHandlerDeps {
  getSession: () => Promise<Session | null>;
  serverBaseUrl: string;
  publicBaseUrl: string;
  importSecret?: string;
  fetchImpl?: typeof fetch;
}

function authError(err: unknown): Response {
  if (err instanceof UnauthorizedError) return Response.json({ error: err.message }, { status: 401 });
  return Response.json({ error: "internal server error" }, { status: 500 });
}

function signature(body: Uint8Array, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function safeFilename(value: string | null): string {
  if (!value) return "import.xlsx";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Invalid percent encoding is treated as a literal filename.
  }
  const basename = decoded.split(/[\\/]/).at(-1)?.slice(0, 200) || "import.xlsx";
  return encodeURIComponent(basename);
}

function hasExpectedOrigin(request: Request, publicBaseUrl: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(publicBaseUrl).origin;
}

function safeUpstreamFailure(status: number): Response {
  return Response.json({ error: "xlsx import service rejected the request" }, { status: status >= 400 ? status : 502 });
}

export async function handleXlsxImport(request: Request, deps: XlsxImportHandlerDeps): Promise<Response> {
  try {
    await requireSession(deps.getSession);
  } catch (err) {
    return authError(err);
  }
  if (!hasExpectedOrigin(request, deps.publicBaseUrl)) {
    return Response.json({ error: "invalid origin" }, { status: 403 });
  }
  if (!deps.importSecret) return Response.json({ error: "xlsx import disabled" }, { status: 503 });

  const url = new URL(request.url);
  const operation = url.searchParams.get("operation");
  if (operation !== "dry-run" && operation !== "execute") {
    return Response.json({ error: "invalid operation" }, { status: 400 });
  }
  if (operation === "execute" && request.headers.get("x-confirm-import") !== "yes") {
    return Response.json({ error: "confirmation required" }, { status: 409 });
  }
  const body = await readXlsxBody(request);
  if (body === null) {
    return Response.json({ error: "payload too large", maxBytes: XLSX_IMPORT_MAX_BYTES }, { status: 413 });
  }

  const upstreamUrl = new URL(`/xlsx-import/${operation}`, deps.serverBaseUrl);
  if (operation === "execute") {
    const owner = url.searchParams.get("owner");
    const repo = url.searchParams.get("repo");
    if (!owner || !repo) return Response.json({ error: "owner and repo are required" }, { status: 400 });
    upstreamUrl.searchParams.set("owner", owner);
    upstreamUrl.searchParams.set("repo", repo);
  }
  try {
    const upstream = await (deps.fetchImpl ?? fetch)(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": XLSX_MIME,
        "x-aiops-filename": safeFilename(request.headers.get("x-aiops-filename")),
        "x-aiops-signature-256": signature(body, deps.importSecret),
        ...(operation === "execute" ? { "x-confirm-import": "yes" } : {}),
      },
      body: body.buffer,
    });
    if (!upstream.ok) return safeUpstreamFailure(upstream.status);
    const payload = await upstream.json();
    return Response.json(payload, { status: upstream.status });
  } catch {
    return Response.json({ error: "xlsx import service unavailable" }, { status: 502 });
  }
}

export async function handleXlsxTemplate(deps: XlsxImportHandlerDeps): Promise<Response> {
  try {
    await requireSession(deps.getSession);
  } catch (err) {
    return authError(err);
  }
  if (!deps.importSecret) return Response.json({ error: "xlsx import disabled" }, { status: 503 });
  try {
    const upstream = await (deps.fetchImpl ?? fetch)(new URL("/xlsx-import/template", deps.serverBaseUrl), {
      headers: { "x-aiops-signature-256": signature(new Uint8Array(), deps.importSecret) },
    });
    if (!upstream.ok) return safeUpstreamFailure(upstream.status);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": XLSX_MIME,
        "content-disposition": 'attachment; filename="aiops-import-template.xlsx"',
      },
    });
  } catch {
    return Response.json({ error: "xlsx import service unavailable" }, { status: 502 });
  }
}
