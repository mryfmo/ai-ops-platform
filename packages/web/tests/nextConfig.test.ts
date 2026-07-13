/**
 * packages/web/tests/nextConfig.test.ts
 *
 * 根拠: AUD-SEC-002。全Next.jsルートへブラウザ向けセキュリティヘッダを付与する。
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

describe("Next.js security headers (AUD-SEC-002)", () => {
  it("全ルートにCSP、HSTS、nosniff、frame denialを設定する", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const entries = await nextConfig.headers!();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.source).toBe("/:path*");

    const headers = Object.fromEntries(entries[0]!.headers.map(({ key, value }) => [key, value]));
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).toContain("script-src 'self' 'unsafe-inline'");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});
