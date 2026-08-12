/**
 * packages/web/tests/config.test.ts
 *
 * 根拠: ADR-0005 / PrjOps:SPEC-INT-060（Web composition rootのLLMモデル設定）。
 */
import { describe, expect, it } from "vitest";
import { loadWebConfig, WEB_GATEWAY_MODEL_ALIASES } from "../src/server/config";

describe("loadWebConfig model configuration [PrjOps:SPEC-INT-060]", () => {
  const validEnv = {
    AUTH_SECRET: "auth-secret",
    AUTH_MICROSOFT_ENTRA_ID_ID: "client-id",
    AUTH_MICROSOFT_ENTRA_ID_SECRET: "client-secret",
    AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: "tenant-id",
    DATABASE_URL: "postgres://example",
    PUBLIC_BASE_URL: "https://example.invalid",
  };

  it("gateway の logical alias と pricing を任意設定できる [PrjOps:SPEC-INT-060 / FinalArch:LLM-001]", () => {
    const config = loadWebConfig({
      ...validEnv,
      ANTHROPIC_DEFAULT_MODEL: "  claude-fast  ",
      ANTHROPIC_PRICING_USD_PER_MTOK: '{"claude-fast":{"input":2,"output":10}}',
    });
    expect(config.ANTHROPIC_DEFAULT_MODEL).toBe("claude-fast");
    expect(config.ANTHROPIC_PRICING_USD_PER_MTOK).toEqual({ "claude-fast": { input: 2, output: 10 } });
  });

  it("モデルの空白のみを拒否する [PrjOps:SPEC-INT-060]", () => {
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: "   " })).toThrow("E-CFG02");
  });

  it("モデルIDの長さ上限を超える値を拒否する [PrjOps:SPEC-INT-060]", () => {
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: `m${"x".repeat(200)}` })).toThrow("E-CFG02");
  });

  it("gateway flag が off なら chat を fail-closed にし model 既定は logical alias にする [FinalArch:LLM-001]", () => {
    const config = loadWebConfig(validEnv);
    expect(config.LLM_GATEWAY_ENABLED).toBe(false);
    expect(config.ANTHROPIC_DEFAULT_MODEL).toBe("claude-standard");
  });

  it("gateway flag が有効なら URL と Web 専用 virtual key を必須にする [FinalArch:LLM-001]", () => {
    const flagOn = { AIOPS_FLAG_INFERENCE_LITELLM_ENABLED: "primary" };
    expect(() => loadWebConfig({ ...validEnv, ...flagOn })).toThrow(/E-CFG02.*LITELLM_BASE_URL/);
    expect(() =>
      loadWebConfig({ ...validEnv, ...flagOn, LITELLM_BASE_URL: "https://litellm.internal.example" }),
    ).toThrow(/E-CFG02.*LITELLM_WEB_VIRTUAL_KEY/);
    const config = loadWebConfig({
      ...validEnv,
      ...flagOn,
      LITELLM_BASE_URL: "https://litellm.internal.example",
      LITELLM_WEB_VIRTUAL_KEY: "  vk-web-test  ",
    });
    expect(config.LLM_GATEWAY_ENABLED).toBe(true);
    expect(config.LITELLM_WEB_VIRTUAL_KEY).toBe("vk-web-test");
  });

  it("gateway model は正典 logical alias だけを受理する [FinalArch:LLM-001]", () => {
    expect(WEB_GATEWAY_MODEL_ALIASES.has("claude-standard")).toBe(true);
    expect(() => loadWebConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: "claude-sonnet-4-6" })).toThrow(
      /E-CFG02.*logical alias/,
    );
  });

  it("gateway URL の非 HTTP(S)・userinfo と空白 virtual key を fail-fast する [FinalArch:LLM-001]", () => {
    const flagOn = { AIOPS_FLAG_INFERENCE_LITELLM_ENABLED: "primary", LITELLM_WEB_VIRTUAL_KEY: "vk-test" };
    expect(() => loadWebConfig({ ...validEnv, ...flagOn, LITELLM_BASE_URL: "ftp://litellm.internal" })).toThrow(
      "E-CFG02",
    );
    expect(() => loadWebConfig({ ...validEnv, ...flagOn, LITELLM_BASE_URL: "https://u:p@litellm.internal" })).toThrow(
      "E-CFG02",
    );
    expect(() =>
      loadWebConfig({
        ...validEnv,
        ...flagOn,
        LITELLM_BASE_URL: "https://litellm.internal",
        LITELLM_WEB_VIRTUAL_KEY: "   ",
      }),
    ).toThrow(/E-CFG02.*LITELLM_WEB_VIRTUAL_KEY/);
  });

  it("gateway kill switch は構成値があっても chat を強制 off にする [FinalArch:GOV-004]", () => {
    const config = loadWebConfig({
      ...validEnv,
      AIOPS_FLAG_INFERENCE_LITELLM_ENABLED: "primary",
      AIOPS_FLAG_INFERENCE_LITELLM_ENABLED_KILL: "1",
      LITELLM_BASE_URL: "https://litellm.internal.example",
      LITELLM_WEB_VIRTUAL_KEY: "vk-test",
    });
    expect(config.LLM_GATEWAY_ENABLED).toBe(false);
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
