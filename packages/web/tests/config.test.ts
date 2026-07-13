/**
 * packages/web/tests/config.test.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-060（Web composition rootのLLMモデル設定）。
 */
import { describe, expect, it } from "vitest";
import { loadWebConfig } from "../src/server/config";

describe("loadWebConfig model configuration [SPEC-INT-060]", () => {
  const validEnv = {
    AUTH_SECRET: "auth-secret",
    AUTH_MICROSOFT_ENTRA_ID_ID: "client-id",
    AUTH_MICROSOFT_ENTRA_ID_SECRET: "client-secret",
    AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: "tenant-id",
    DATABASE_URL: "postgres://example",
    PUBLIC_BASE_URL: "https://example.invalid",
  };

  it("ANTHROPIC_DEFAULT_MODELを任意設定できる [SPEC-INT-060]", () => {
    const config = loadWebConfig({
      ...validEnv,
      ANTHROPIC_DEFAULT_MODEL: "  custom-sonnet  ",
      ANTHROPIC_PRICING_USD_PER_MTOK: '{"custom-sonnet":{"input":2,"output":10}}',
    });
    expect(config.ANTHROPIC_DEFAULT_MODEL).toBe("custom-sonnet");
    expect(config.ANTHROPIC_PRICING_USD_PER_MTOK).toEqual({ "custom-sonnet": { input: 2, output: 10 } });
  });

  it("モデルの空白のみを拒否する [SPEC-INT-060]", () => {
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: "   " })).toThrow("E-CFG02");
  });

  it("モデルIDの長さ上限を超える値を拒否する [SPEC-INT-060]", () => {
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: `m${"x".repeat(200)}` })).toThrow("E-CFG02");
  });

  it("不正なpricing JSONを起動時に拒否する [SPEC-INT-060]", () => {
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_PRICING_USD_PER_MTOK: "{}" })).toThrow("E-CFG02");
  });
});
