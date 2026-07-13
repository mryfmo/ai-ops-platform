/**
 * packages/server/tests/config.test.ts
 *
 * 根拠: ADR-0005（環境変数のfail-fastパース。誤設定のまま黙って稼働することを防ぐ）
 */
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

// security-reviewer指摘によりmin(32)へ引き上げたため、フィクスチャも32文字以上にする
const validEnv = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/aiops",
  GRAPH_CLIENT_STATE: "random-secret-of-at-least-32-chars-long",
  GITHUB_WEBHOOK_SECRET: "webhook-secret-of-at-least-32-chars-long",
  GRAPH_CLIENT_ID: "client-id",
  GRAPH_CLIENT_SECRET: "client-secret",
  GRAPH_TENANT_ID: "tenant-id",
  PUBLIC_BASE_URL: "https://aiops.example.com",
  CODING_TASK_CALLBACK_SECRET: "coding-task-secret-of-at-least-32-chars",
};

describe("loadConfig (ADR-0005)", () => {
  it("必須項目が揃えばパースされ、既定値が適用される", () => {
    const config = loadConfig(validEnv);
    expect(config.PORT).toBe(8080);
    expect(config.WEBUI_INTERNAL_PORT).toBe(3100);
    expect(config.DATABASE_URL).toContain("postgres://");
    expect(config.DB_POOL_MAX).toBe(10);
    expect(config.DB_POOL_CONNECTION_TIMEOUT_MS).toBe(5000);
    expect(config.DB_STATEMENT_TIMEOUT_MS).toBe(30000);
    expect(config.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS).toBe(30000);
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.OTEL_SERVICE_NAME).toBe("ai-ops-platform-server");
    expect(config.REPORT_DELIVERY_ENABLED).toBe(false);
  });

  it("Anthropic modelとpricingの現行既定値を維持する [SPEC-INT-001 / SPEC-INT-060]", () => {
    const config = loadConfig(validEnv);
    expect(config.ANTHROPIC_DEFAULT_MODEL).toBe("claude-sonnet-4-6");
    expect(config.ANTHROPIC_ESCALATION_MODEL).toBe("claude-opus-4-8");
    expect(config.ANTHROPIC_PRICING_USD_PER_MTOK["claude-sonnet-4-6"]).toEqual({ input: 3, output: 15 });
  });

  it("PORTを上書きできる", () => {
    const config = loadConfig({ ...validEnv, PORT: "9090" });
    expect(config.PORT).toBe(9090);
  });

  it("Anthropic default/escalation modelを環境変数から受け取る [SPEC-INT-001 / SPEC-INT-060]", () => {
    const config = loadConfig({
      ...validEnv,
      ANTHROPIC_DEFAULT_MODEL: "  custom-sonnet  ",
      ANTHROPIC_ESCALATION_MODEL: "  custom-opus  ",
      ANTHROPIC_PRICING_USD_PER_MTOK: '{"custom-sonnet":{"input":2,"output":10}}',
    });
    expect(config.ANTHROPIC_DEFAULT_MODEL).toBe("custom-sonnet");
    expect(config.ANTHROPIC_ESCALATION_MODEL).toBe("custom-opus");
    expect(config.ANTHROPIC_PRICING_USD_PER_MTOK).toEqual({ "custom-sonnet": { input: 2, output: 10 } });
  });

  it.each(["ANTHROPIC_DEFAULT_MODEL", "ANTHROPIC_ESCALATION_MODEL"] as const)(
    "%sの空白のみを拒否する [SPEC-INT-001 / SPEC-INT-060]",
    (key) => {
      expect(() => loadConfig({ ...validEnv, [key]: "   " })).toThrow("E-CFG01");
    },
  );

  it("モデルIDの長さ上限を超える値を拒否する [SPEC-INT-001 / SPEC-INT-060]", () => {
    expect(() => loadConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: `m${"x".repeat(200)}` })).toThrow("E-CFG01");
  });

  it("不正なpricing JSONを起動時に拒否する [SPEC-INT-060]", () => {
    expect(() =>
      loadConfig({ ...validEnv, ANTHROPIC_PRICING_USD_PER_MTOK: '{"model":{"input":-1,"output":5}}' }),
    ).toThrow("E-CFG01");
  });

  it("DB pool設定を上書きできる", () => {
    const config = loadConfig({
      ...validEnv,
      DB_POOL_MAX: "20",
      DB_POOL_CONNECTION_TIMEOUT_MS: "7000",
      DB_STATEMENT_TIMEOUT_MS: "45000",
      DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS: "15000",
    });
    expect(config.DB_POOL_MAX).toBe(20);
    expect(config.DB_POOL_CONNECTION_TIMEOUT_MS).toBe(7000);
    expect(config.DB_STATEMENT_TIMEOUT_MS).toBe(45000);
    expect(config.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS).toBe(15000);
  });

  it("observability設定を上書きできる", () => {
    const config = loadConfig({
      ...validEnv,
      LOG_LEVEL: "debug",
      OTEL_SERVICE_NAME: "aiops-test",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://otel.example.com/v1/traces",
    });
    expect(config.LOG_LEVEL).toBe("debug");
    expect(config.OTEL_SERVICE_NAME).toBe("aiops-test");
    expect(config.OTEL_EXPORTER_OTLP_ENDPOINT).toBe("https://otel.example.com");
    expect(config.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT).toBe("https://otel.example.com/v1/traces");
  });

  it("DATABASE_URL欠落でE-CFG01", () => {
    const { DATABASE_URL: _drop, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow("E-CFG01");
  });

  it("GRAPH_CLIENT_STATEが短すぎるとE-CFG01（弱い検証値の防止）", () => {
    expect(() => loadConfig({ ...validEnv, GRAPH_CLIENT_STATE: "short" })).toThrow("E-CFG01");
  });

  it("PUBLIC_BASE_URLがURL形式でないとE-CFG01", () => {
    expect(() => loadConfig({ ...validEnv, PUBLIC_BASE_URL: "not-a-url" })).toThrow("E-CFG01");
  });

  it("CODING_TASK_CALLBACK_SECRETが短すぎるとE-CFG01（ADR-0006, 弱いシークレットの防止）", () => {
    expect(() => loadConfig({ ...validEnv, CODING_TASK_CALLBACK_SECRET: "short" })).toThrow("E-CFG01");
  });

  it("CODING_TASK_CALLBACK_SECRET欠落でE-CFG01", () => {
    const { CODING_TASK_CALLBACK_SECRET: _drop, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow("E-CFG01");
  });

  it("ADR-0014の配信設定をパースできる", () => {
    const config = loadConfig({
      ...validEnv,
      REPORT_DELIVERY_ENABLED: "true",
      FROM_MAILBOX: "reports@example.com",
      REPORT_INGEST_SECRET: "report-ingest-secret-of-at-least-32-chars",
      DEFAULT_TEAMS_TEAM_ID: "team-1",
      DEFAULT_TEAMS_CHANNEL_ID: "channel-1",
    });
    expect(config.REPORT_DELIVERY_ENABLED).toBe(true);
    expect(config.FROM_MAILBOX).toBe("reports@example.com");
    expect(config.DEFAULT_TEAMS_CHANNEL_ID).toBe("channel-1");
  });
});
