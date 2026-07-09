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
    expect(config.REPORT_DELIVERY_ENABLED).toBe(false);
  });

  it("PORTを上書きできる", () => {
    const config = loadConfig({ ...validEnv, PORT: "9090" });
    expect(config.PORT).toBe(9090);
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
