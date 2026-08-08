/**
 * packages/web/tests/config.test.ts
 *
 * 根拠: ADR-0005 / PrjOps:SPEC-INT-060（Web composition rootのLLMモデル設定）。
 */
import { describe, expect, it } from "vitest";
import { loadWebConfig } from "../src/server/config";

describe("loadWebConfig model configuration [PrjOps:SPEC-INT-060]", () => {
  const validEnv = {
    AUTH_SECRET: "auth-secret",
    AUTH_MICROSOFT_ENTRA_ID_ID: "client-id",
    AUTH_MICROSOFT_ENTRA_ID_SECRET: "client-secret",
    AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: "tenant-id",
    DATABASE_URL: "postgres://example",
    PUBLIC_BASE_URL: "https://example.invalid",
  };

  it("ANTHROPIC_DEFAULT_MODELを任意設定できる [PrjOps:SPEC-INT-060]", () => {
    const config = loadWebConfig({
      ...validEnv,
      ANTHROPIC_DEFAULT_MODEL: "  custom-sonnet  ",
      ANTHROPIC_PRICING_USD_PER_MTOK: '{"custom-sonnet":{"input":2,"output":10}}',
    });
    expect(config.ANTHROPIC_DEFAULT_MODEL).toBe("custom-sonnet");
    expect(config.ANTHROPIC_PRICING_USD_PER_MTOK).toEqual({ "custom-sonnet": { input: 2, output: 10 } });
  });

  it("モデルの空白のみを拒否する [PrjOps:SPEC-INT-060]", () => {
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: "   " })).toThrow("E-CFG02");
  });

  it("モデルIDの長さ上限を超える値を拒否する [PrjOps:SPEC-INT-060]", () => {
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: `m${"x".repeat(200)}` })).toThrow("E-CFG02");
  });

  it("不正なpricing JSONを起動時に拒否する [PrjOps:SPEC-INT-060]", () => {
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_PRICING_USD_PER_MTOK: "{}" })).toThrow("E-CFG02");
  });

  it("P010-F02-T07: pinned prjops-data identityを4項目そろった場合だけ受理する", () => {
    const config = loadWebConfig({
      ...validEnv,
      PRJOPS_DATA_DIR: "/srv/prjops-data",
      PRJOPS_DATA_COMMIT_SHA: "1".repeat(40),
      PRJOPS_DATA_SOURCE_COMMIT_SHA: "1".repeat(40),
      PRJOPS_DATA_CONTENT_SHA256: "2".repeat(64),
    });
    expect(config.PRJOPS_DATA_DIR).toBe("/srv/prjops-data");
    expect(config.PRJOPS_DATA_COMMIT_SHA).toBe("1".repeat(40));
  });

  it("P010-F02-T07: partial/relative/noncanonical snapshot configをfail closedにする", () => {
    expect(() => loadWebConfig({ ...validEnv, PRJOPS_DATA_DIR: "/srv/prjops-data" })).toThrow("E-CFG02");
    expect(() =>
      loadWebConfig({
        ...validEnv,
        PRJOPS_DATA_DIR: "relative/prjops-data",
        PRJOPS_DATA_COMMIT_SHA: "A".repeat(40),
        PRJOPS_DATA_SOURCE_COMMIT_SHA: "1".repeat(40),
        PRJOPS_DATA_CONTENT_SHA256: "2".repeat(64),
      }),
    ).toThrow("E-CFG02");
  });

  it("AUD-OPM-001: WEB_BFF_IDENTITY_SECRETは任意だが32文字以上で他用途鍵と分離する", () => {
    expect(loadWebConfig(validEnv).WEB_BFF_IDENTITY_SECRET).toBeUndefined();
    expect(() => loadWebConfig({ ...validEnv, WEB_BFF_IDENTITY_SECRET: "short" })).toThrow("E-CFG02");
    expect(loadWebConfig({ ...validEnv, WEB_BFF_IDENTITY_SECRET: "w".repeat(32) }).WEB_BFF_IDENTITY_SECRET).toBe(
      "w".repeat(32),
    );
    const same = "s".repeat(32);
    expect(() => loadWebConfig({ ...validEnv, AUTH_SECRET: same, WEB_BFF_IDENTITY_SECRET: same })).toThrow("E-CFG02");
    expect(() =>
      loadWebConfig({ ...validEnv, AUTH_MICROSOFT_ENTRA_ID_SECRET: same, WEB_BFF_IDENTITY_SECRET: same }),
    ).toThrow("E-CFG02");
    expect(() => loadWebConfig({ ...validEnv, XLSX_IMPORT_SECRET: same, WEB_BFF_IDENTITY_SECRET: same })).toThrow(
      "E-CFG02",
    );
  });
});
