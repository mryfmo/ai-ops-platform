/**
 * packages/server/src/http/routes/webuiProxy.ts
 *
 * 根拠: ADR-0005（公開エンドポイントを1つに保つ）。/app/* を同一コンテナ内の
 *   Next.js standalone（127.0.0.1:WEBUI_INTERNAL_PORT）へ転送する。
 *   TLS終端・Graph notificationUrl・認証境界をHono側に一元化するための構成。
 */
import type { Hono } from "hono";
import { XLSX_IMPORT_MAX_BYTES } from "./xlsxImport.js";

export interface WebuiProxyDeps {
  /** 転送先（例: http://127.0.0.1:3100） */
  targetBaseUrl: string;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
}

async function readBodyUpTo(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > maxBytes) return null;
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function registerWebuiProxy(app: Hono, deps: WebuiProxyDeps | undefined): void {
  app.all("/app/*", async (c) => {
    if (!deps) {
      return c.json({ error: "WebUI is not available" }, 503);
    }
    const fetchImpl = deps.fetchImpl ?? fetch;
    const url = new URL(c.req.url);
    const target = `${deps.targetBaseUrl}${url.pathname}${url.search}`;

    const headers = new Headers(c.req.raw.headers);
    headers.delete("host");

    const init: RequestInit = {
      method: c.req.method,
      headers,
      redirect: "manual",
    };
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      if (/^\/app\/api\/xlsx-import\/?$/.test(url.pathname)) {
        const body = await readBodyUpTo(c.req.raw, XLSX_IMPORT_MAX_BYTES);
        if (body === null) return c.json({ error: "payload too large", maxBytes: XLSX_IMPORT_MAX_BYTES }, 413);
        init.body = body;
        headers.delete("transfer-encoding");
        headers.set("content-length", String(body.byteLength));
      } else {
        init.body = await c.req.raw.arrayBuffer();
      }
    }

    try {
      const res = await fetchImpl(target, init);
      const responseHeaders = new Headers(res.headers);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");
      responseHeaders.delete("transfer-encoding");
      return new Response(res.body, { status: res.status, headers: responseHeaders });
    } catch {
      return c.json({ error: "WebUI upstream unreachable" }, 502);
    }
  });
}
