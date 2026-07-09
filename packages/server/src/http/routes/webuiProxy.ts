/**
 * packages/server/src/http/routes/webuiProxy.ts
 *
 * 根拠: ADR-0005（公開エンドポイントを1つに保つ）。/app/* を同一コンテナ内の
 *   Next.js standalone（127.0.0.1:WEBUI_INTERNAL_PORT）へ転送する。
 *   TLS終端・Graph notificationUrl・認証境界をHono側に一元化するための構成。
 */
import type { Hono } from "hono";

export interface WebuiProxyDeps {
  /** 転送先（例: http://127.0.0.1:3100） */
  targetBaseUrl: string;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
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
      init.body = await c.req.raw.arrayBuffer();
    }

    try {
      const res = await fetchImpl(target, init);
      return new Response(res.body, { status: res.status, headers: res.headers });
    } catch {
      return c.json({ error: "WebUI upstream unreachable" }, 502);
    }
  });
}
