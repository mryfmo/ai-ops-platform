/**
 * packages/server/tests/config.test.ts
 *
 * 根拠: ADR-0005（環境変数のfail-fastパース。誤設定のまま黙って稼働することを防ぐ）
 */
import { describe, it, expect, vi } from "vitest";
import { loadConfig } from "../src/config.js";

// security-reviewer指摘によりmin(32)へ引き上げたため、フィクスチャも32文字以上にする
const validEnv = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/aiops",
  GRAPH_CLIENT_STATE: "random-secret-of-at-least-32-chars-long",
  GITHUB_WEBHOOK_SECRET: "webhook-secret-of-at-least-32-chars-long",
  GRAPH_CLIENT_ID: "client-id",
  GRAPH_CLIENT_SECRET: "client-secret",
  GRAPH_TENANT_ID: "tenant-id",
  GRAPH_ALLOWED_TEAM_IDS: "team-1,team-2",
  GRAPH_ALLOWED_FROM_MAILBOXES: "reports@example.com",
  PUBLIC_BASE_URL: "https://aiops.example.com",
  CODING_TASK_CONFIRM_SECRET: "confirm-secret-of-at-least-32-characters",
  CODING_TASK_CALLBACK_SECRET: "coding-task-secret-of-at-least-32-chars",
  METRICS_TOKEN: "metrics-token-of-at-least-32-chars",
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
    expect(config.GRAPH_ALLOWED_TEAM_IDS).toEqual(["team-1", "team-2"]);
    expect(config.GRAPH_ALLOWED_FROM_MAILBOXES).toEqual(["reports@example.com"]);
    expect(config.GITHUB_APP_ID).toBeUndefined();
    expect(config.GITHUB_APP_PRIVATE_KEY).toBeUndefined();
    expect(config.GITHUB_APP_INSTALLATION_ID).toBeUndefined();
    expect(config.GITHUB_TOKEN).toBeUndefined();
    expect(config.STAKEHOLDERS_DIR).toBeUndefined();
    expect(config.PRJOPS_DATA_DIR).toBeUndefined();
    expect(config.PMO_NOTIFY_MAILBOX).toBeUndefined();
  });

  it("A046: pinned PrjOps snapshotは4変数all-or-none、絶対pathとdigest形状を要求する", () => {
    const configured = loadConfig({
      ...validEnv,
      PRJOPS_DATA_DIR: "/srv/prjops-data",
      PRJOPS_DATA_COMMIT_SHA: "1".repeat(40),
      PRJOPS_DATA_SOURCE_COMMIT_SHA: "1".repeat(40),
      PRJOPS_DATA_CONTENT_SHA256: "2".repeat(64),
    });
    expect(configured.PRJOPS_DATA_DIR).toBe("/srv/prjops-data");
    expect(() => loadConfig({ ...validEnv, PRJOPS_DATA_DIR: "/srv/prjops-data" })).toThrow("E-CFG01");
    expect(() =>
      loadConfig({
        ...validEnv,
        PRJOPS_DATA_DIR: "relative",
        PRJOPS_DATA_COMMIT_SHA: "1".repeat(40),
        PRJOPS_DATA_SOURCE_COMMIT_SHA: "1".repeat(40),
        PRJOPS_DATA_CONTENT_SHA256: "2".repeat(64),
      }),
    ).toThrow("E-CFG01");
  });

  it("A046: PMO_NOTIFY_MAILBOXをcanonical emailとして読む", () => {
    expect(loadConfig({ ...validEnv, PMO_NOTIFY_MAILBOX: " PMO@Example.com " }).PMO_NOTIFY_MAILBOX).toBe(
      "pmo@example.com",
    );
  });

  it("PrjOps:REQ-002: STAKEHOLDERS_DIRは絶対パスだけを許可する", () => {
    expect(loadConfig({ ...validEnv, STAKEHOLDERS_DIR: "/etc/aiops/stakeholders" }).STAKEHOLDERS_DIR).toBe(
      "/etc/aiops/stakeholders",
    );
    expect(() => loadConfig({ ...validEnv, STAKEHOLDERS_DIR: "./stakeholders" })).toThrow("E-CFG01");
  });

  it("Anthropic modelとpricingの現行既定値を維持する [PrjOps:SPEC-INT-001 / PrjOps:SPEC-INT-060]", () => {
    const config = loadConfig(validEnv);
    expect(config.ANTHROPIC_DEFAULT_MODEL).toBe("claude-sonnet-4-6");
    expect(config.ANTHROPIC_ESCALATION_MODEL).toBe("claude-opus-4-8");
    expect(config.ANTHROPIC_PRICING_USD_PER_MTOK["claude-sonnet-4-6"]).toEqual({ input: 3, output: 15 });
  });

  it("DevOps:SPEC-INT-061: GitHub App設定は3変数が揃えばパースされる", () => {
    const config = loadConfig({
      ...validEnv,
      GITHUB_APP_ID: "123",
      GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----",
      GITHUB_APP_INSTALLATION_ID: "456",
    });

    expect(config.GITHUB_APP_ID).toBe("123");
    expect(config.GITHUB_APP_INSTALLATION_ID).toBe("456");
  });

  it.each(["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_INSTALLATION_ID"])(
    "DevOps:SPEC-INT-061: App設定が一部だけのときE-CFG01: %s",
    (name) => {
      expect(() => loadConfig({ ...validEnv, [name]: "configured" })).toThrow("E-CFG01");
    },
  );

  it("PORTを上書きできる", () => {
    const config = loadConfig({ ...validEnv, PORT: "9090" });
    expect(config.PORT).toBe(9090);
  });

  it("Anthropic default/escalation modelを環境変数から受け取る [PrjOps:SPEC-INT-001 / PrjOps:SPEC-INT-060]", () => {
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
    "%sの空白のみを拒否する [PrjOps:SPEC-INT-001 / PrjOps:SPEC-INT-060]",
    (key) => {
      expect(() => loadConfig({ ...validEnv, [key]: "   " })).toThrow("E-CFG01");
    },
  );

  it("モデルIDの長さ上限を超える値を拒否する [PrjOps:SPEC-INT-001 / PrjOps:SPEC-INT-060]", () => {
    expect(() => loadConfig({ ...validEnv, ANTHROPIC_DEFAULT_MODEL: `m${"x".repeat(200)}` })).toThrow("E-CFG01");
  });

  it("不正なpricing JSONを起動時に拒否する [PrjOps:SPEC-INT-060]", () => {
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

  it("CODING_TASK_CONFIRM_SECRETが短すぎるとE-CFG01 [DevOps:SPEC-INT-070 / ADR-0006]", () => {
    expect(() => loadConfig({ ...validEnv, CODING_TASK_CONFIRM_SECRET: "short" })).toThrow("E-CFG01");
  });

  it("CODING_TASK_CONFIRM_SECRET欠落でE-CFG01 [DevOps:SPEC-INT-070]", () => {
    const { CODING_TASK_CONFIRM_SECRET: _drop, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow("E-CFG01");
  });

  it("確認トークン鍵とcallback鍵は別の値として読まれる [DevOps:SPEC-INT-070]", () => {
    // 兼用していた頃は、Actionsへ渡るcallback鍵から任意taskIdの確認トークンを再計算でき、
    // 人間クリック無しでdispatchできた。両者が独立していることを設定層で固定する。
    const config = loadConfig({
      ...validEnv,
      CODING_TASK_CONFIRM_SECRET: "c".repeat(32),
      CODING_TASK_CALLBACK_SECRET: "k".repeat(32),
    });

    expect(config.CODING_TASK_CONFIRM_SECRET).toBe("c".repeat(32));
    expect(config.CODING_TASK_CALLBACK_SECRET).toBe("k".repeat(32));
    expect(config.CODING_TASK_CONFIRM_SECRET).not.toBe(config.CODING_TASK_CALLBACK_SECRET);
  });

  it("2つの鍵に同じ値を設定するとE-CFG01 [DevOps:SPEC-INT-070]", () => {
    // 別変数にしても同値なら、Actionsへ渡る値から確認トークンを再計算できる状態に戻る。
    const same = "s".repeat(32);
    expect(() =>
      loadConfig({ ...validEnv, CODING_TASK_CONFIRM_SECRET: same, CODING_TASK_CALLBACK_SECRET: same }),
    ).toThrow("E-CFG01");
  });

  it("AUD-OPM-001: WEB_BFF_IDENTITY_SECRETは未設定ならapprovalsを無効化し32文字以上だけ受理する", () => {
    expect(loadConfig(validEnv).WEB_BFF_IDENTITY_SECRET).toBeUndefined();
    expect(() => loadConfig({ ...validEnv, WEB_BFF_IDENTITY_SECRET: "short" })).toThrow("E-CFG01");
    expect(loadConfig({ ...validEnv, WEB_BFF_IDENTITY_SECRET: "w".repeat(32) }).WEB_BFF_IDENTITY_SECRET).toBe(
      "w".repeat(32),
    );
  });

  it.each([
    "GRAPH_CLIENT_STATE",
    "GITHUB_WEBHOOK_SECRET",
    "GRAPH_CLIENT_SECRET",
    "REPORT_INGEST_SECRET",
    "XLSX_IMPORT_SECRET",
    "CODING_TASK_CONFIRM_SECRET",
    "CODING_TASK_CALLBACK_SECRET",
  ] as const)("AUD-OPM-001: identity envelope鍵は%sと同値を拒否する", (otherKey) => {
    const same = "s".repeat(32);
    expect(() => loadConfig({ ...validEnv, [otherKey]: same, WEB_BFF_IDENTITY_SECRET: same })).toThrow("E-CFG01");
  });

  it("ADR-0014の配信設定をパースできる", () => {
    const config = loadConfig({
      ...validEnv,
      REPORT_DELIVERY_ENABLED: "true",
      FROM_MAILBOX: "reports@example.com",
      REPORT_INGEST_SECRET: "report-ingest-secret-of-at-least-32-chars",
      HEARTBEAT_URL: "https://heartbeat.example.com/report-delivery",
      DEFAULT_TEAMS_TEAM_ID: "team-1",
      DEFAULT_TEAMS_CHANNEL_ID: "channel-1",
    });
    expect(config.REPORT_DELIVERY_ENABLED).toBe(true);
    expect(config.FROM_MAILBOX).toBe("reports@example.com");
    expect(config.HEARTBEAT_URL).toBe("https://heartbeat.example.com/report-delivery");
    expect(config.DEFAULT_TEAMS_TEAM_ID).toBe("team-1");
    expect(config.DEFAULT_TEAMS_CHANNEL_ID).toBe("channel-1");
  });

  it("Graph allowlistをtrim/lowercase/重複排除する", () => {
    const config = loadConfig({
      ...validEnv,
      GRAPH_ALLOWED_TEAM_IDS: " team-1,team-1,Team-1 ",
      GRAPH_ALLOWED_FROM_MAILBOXES: " Reports@Example.com,reports@example.com ",
    });
    expect(config.GRAPH_ALLOWED_TEAM_IDS).toEqual(["team-1", "Team-1"]);
    expect(config.GRAPH_ALLOWED_FROM_MAILBOXES).toEqual(["reports@example.com"]);
  });

  it.each([
    ["missing team list", { GRAPH_ALLOWED_TEAM_IDS: undefined }],
    ["empty team list", { GRAPH_ALLOWED_TEAM_IDS: " , " }],
    ["wildcard team list", { GRAPH_ALLOWED_TEAM_IDS: "team-1,*" }],
    ["missing mailbox list", { GRAPH_ALLOWED_FROM_MAILBOXES: undefined }],
    ["empty mailbox list", { GRAPH_ALLOWED_FROM_MAILBOXES: " , " }],
    ["wildcard mailbox list", { GRAPH_ALLOWED_FROM_MAILBOXES: "*" }],
  ])("不正なGraph allowlistは起動設定を拒否する: %s", (_label, override) => {
    expect(() => loadConfig({ ...validEnv, ...override })).toThrow("E-CFG01");
  });

  it.each([
    ["FROM_MAILBOXなし", { REPORT_DELIVERY_ENABLED: "true", FROM_MAILBOX: undefined }],
    ["allowlist外FROM_MAILBOX", { REPORT_DELIVERY_ENABLED: "true", FROM_MAILBOX: "other@example.com" }],
    [
      "team defaultのみ",
      { REPORT_DELIVERY_ENABLED: "true", FROM_MAILBOX: "reports@example.com", DEFAULT_TEAMS_TEAM_ID: "team-1" },
    ],
    [
      "channel defaultのみ",
      { REPORT_DELIVERY_ENABLED: "true", FROM_MAILBOX: "reports@example.com", DEFAULT_TEAMS_CHANNEL_ID: "channel-1" },
    ],
    [
      "allowlist外default team",
      {
        REPORT_DELIVERY_ENABLED: "true",
        FROM_MAILBOX: "reports@example.com",
        DEFAULT_TEAMS_TEAM_ID: "db-team",
        DEFAULT_TEAMS_CHANNEL_ID: "channel-1",
      },
    ],
  ])("delivery有効時の不正defaultは起動設定を拒否する: %s", (_label, override) => {
    expect(() => loadConfig({ ...validEnv, ...override })).toThrow("E-CFG01");
  });

  it("METRICS_TOKEN未設定時は起動警告を1回だけ出し、値をログへ含めない", () => {
    const { METRICS_TOKEN: _drop, ...rest } = validEnv;
    const warn = vi.fn();

    const config = loadConfig(rest, warn);

    expect(config.METRICS_TOKEN).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toBe("METRICS_TOKEN is not configured; GET /metrics is disabled and returns 503");
    expect(JSON.stringify(warn.mock.calls)).not.toContain(validEnv.METRICS_TOKEN);
  });

  it("METRICS_TOKENが32文字未満ならfail-fastする", () => {
    expect(() => loadConfig({ ...validEnv, METRICS_TOKEN: "too-short" })).toThrow("E-CFG01");
  });

  it("ADR-0005 AUD-OPM-009: HEARTBEAT_URLがURL形式でなければE-CFG01", () => {
    expect(() => loadConfig({ ...validEnv, HEARTBEAT_URL: "not-a-url" })).toThrow("E-CFG01");
  });

  it.each([
    "https://heartbeat-user@heartbeat.example.com/report-delivery",
    "https://heartbeat-user:super-secret@heartbeat.example.com/report-delivery",
  ])("ADR-0005 AUD-OPM-009: credential付きHEARTBEAT_URLはE-CFG01", (heartbeatUrl) => {
    expect(() => loadConfig({ ...validEnv, HEARTBEAT_URL: heartbeatUrl })).toThrow("E-CFG01");
  });
});
