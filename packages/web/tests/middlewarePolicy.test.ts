/**
 * packages/web/tests/middlewarePolicy.test.ts
 *
 * 根拠: ADR-0005（/dashboard 認証必須化）。spec-reviewer指摘によりproxy.tsの
 *   判定ロジックを純粋関数化した decideDashboardRedirect を検証する。
 */
import { describe, it, expect } from "vitest";
import { decideDashboardRedirect } from "../src/server/middlewarePolicy";

describe("decideDashboardRedirect (ADR-0005)", () => {
  it("未認証で/dashboard配下にアクセスすると/loginへのリダイレクトを返す", () => {
    expect(decideDashboardRedirect("/dashboard", false)).toBe("/login");
    expect(decideDashboardRedirect("/dashboard/settings", false)).toBe("/login");
    expect(decideDashboardRedirect("/dashboard/xlsx-import", false)).toBe("/login");
  });

  it("認証済みなら/dashboard配下でもリダイレクトしない", () => {
    expect(decideDashboardRedirect("/dashboard", true)).toBeNull();
  });

  it("/dashboard配下以外は未認証でもリダイレクトしない", () => {
    expect(decideDashboardRedirect("/login", false)).toBeNull();
    expect(decideDashboardRedirect("/", false)).toBeNull();
  });
});
