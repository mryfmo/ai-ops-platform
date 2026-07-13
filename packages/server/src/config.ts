/**
 * packages/server/src/config.ts
 *
 * 根拠:
 *   - ADR-0005: 常駐サーバの環境変数はzodで起動時にfail-fastパースする。
 *     GRAPH_CLIENT_STATE（Graph change notificationのclientState検証値）を新設し、
 *     graphClient.tsの固定値ハードコードを廃止する。
 *   - SPEC-INT-060: 外部通信allowlist（api.anthropic.com / graph.microsoft.com / api.github.com）。
 *   - ADR-0006: CODING_TASK_CALLBACK_SECRETは.github/workflows/coding-task.ymlが
 *     POST /internal/coding-tasks/:taskId/callback を呼ぶ際のBearer認証シークレット。
 */
import { z } from "zod";

const commaList = (lowercase = false) =>
  z
    .string()
    .transform((value) => [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => (lowercase ? item.toLowerCase() : item)),
      ),
    ])
    .refine((values) => values.length > 0 && !values.includes("*"), "must be a nonempty comma list without wildcard");

const baseConfigSchema = z.object({
  /** HTTP待受ポート（公開エンドポイント。既定8080） */
  PORT: z.coerce.number().int().positive().default(8080),
  /** Next.js WebUIの内部ポート（webuiProxyの転送先。既定3100） */
  WEBUI_INTERNAL_PORT: z.coerce.number().int().positive().default(3100),
  /** PostgreSQL接続文字列（DevOps正本DB） */
  DATABASE_URL: z.string().min(1),
  /** PostgreSQL pool max connections. */
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  /** PostgreSQL connection acquisition timeout. */
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  /** PostgreSQL per-statement timeout. */
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** PostgreSQL idle-in-transaction timeout. */
  DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** pino structured log level. */
  LOG_LEVEL: z.string().default("info"),
  /** OpenTelemetry service name. */
  OTEL_SERVICE_NAME: z.string().default("ai-ops-platform-server"),
  /** Prometheus scrape endpointのBearerトークン。未設定時は後方互換のため認証なし。 */
  METRICS_TOKEN: z.string().min(32).optional(),
  /** OTLP base endpoint. 未設定時はtelemetry disabledを明示ログしてno-op。 */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  /** OTLP traces endpoint. 指定時はOTEL_EXPORTER_OTLP_ENDPOINTより優先。 */
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().url().optional(),
  /**
   * Graph change notificationのclientState（ADR-0005）。security-reviewer指摘によりmin(16)
   * から引き上げ。ランダム生成必須（例: `openssl rand -hex 32`）。
   */
  GRAPH_CLIENT_STATE: z.string().min(32),
  /**
   * GitHub webhook署名検証シークレット。security-reviewer指摘: min(8)はGitHub公式推奨
   * （ランダム値・十分な長さ）に対し弱すぎるため引き上げ。ランダム生成必須。
   */
  GITHUB_WEBHOOK_SECRET: z.string().min(32),
  /** Microsoft Graph クライアント認証（client credentials flow） */
  GRAPH_CLIENT_ID: z.string().min(1),
  GRAPH_CLIENT_SECRET: z.string().min(1),
  GRAPH_TENANT_ID: z.string().min(1),
  /** ADR-0005: Graph team/mailbox external operationのアプリ内最終allowlist。 */
  GRAPH_ALLOWED_TEAM_IDS: commaList(),
  GRAPH_ALLOWED_FROM_MAILBOXES: commaList(true).refine(
    (mailboxes) => mailboxes.every((mailbox) => z.string().email().safeParse(mailbox).success),
    "must contain only email addresses",
  ),
  /** 常駐コンテナの公開FQDN（Graph notificationUrl・WebUIディープリンクの生成に使用） */
  PUBLIC_BASE_URL: z.string().url(),
  /** Anthropic APIキー（自由文意図解釈で使用。未設定時はLLMフォールバック無効） */
  ANTHROPIC_API_KEY: z.string().optional(),
  /** ADR-0007: Projects v2 reconcile対象。未設定時はreconcileを監査ログ付きで無効化する。 */
  GITHUB_PROJECT_NODE_ID: z.string().optional(),
  /** ADR-0014: Outlook配信元メールボックス。未設定時はreport deliveryをdisabled+監査にする。 */
  FROM_MAILBOX: z
    .string()
    .trim()
    .email()
    .transform((mailbox) => mailbox.toLowerCase())
    .optional(),
  /** ADR-0014: reportDeliveryTaskの明示有効化フラグ。既定false。 */
  REPORT_DELIVERY_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  /** ADR-0014: report-generation.yml -> /reports/ingest HMAC鍵。未設定時はingest disabled。 */
  REPORT_INGEST_SECRET: z.string().min(32).optional(),
  /** ADR-0008: /xlsx-import/* HMAC鍵。未設定時はxlsx import disabled。 */
  XLSX_IMPORT_SECRET: z.string().min(32).optional(),
  /** ADR-0008: xlsx import executeを許可する owner/repo のカンマ区切りallowlist。 */
  XLSX_IMPORT_ALLOWED_REPOS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((repo) => repo.trim())
            .filter(Boolean)
        : [],
    ),
  /** ADR-0014: report card投稿先の既定Teams channel。未設定時はメールのみ。 */
  DEFAULT_TEAMS_TEAM_ID: z.string().trim().min(1).optional(),
  DEFAULT_TEAMS_CHANNEL_ID: z.string().trim().min(1).optional(),
  /**
   * コーディングタスク関連シークレット（ADR-0006）。二用途で共有する:
   *   (a) confirmToken.ts の HMAC-SHA256鍵（確認リンクtokenの生成・検証）
   *   (b) .github/workflows/coding-task.yml が呼ぶ
   *       POST /internal/coding-tasks/:taskId/callback のBearer認証シークレット
   */
  CODING_TASK_CALLBACK_SECRET: z.string().min(32),
});

const configSchema = baseConfigSchema.superRefine((config, ctx) => {
  if (!config.REPORT_DELIVERY_ENABLED) return;
  if (!config.FROM_MAILBOX || !config.GRAPH_ALLOWED_FROM_MAILBOXES.includes(config.FROM_MAILBOX)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["FROM_MAILBOX"],
      message: "must be in Graph mailbox allowlist",
    });
  }
  if (Boolean(config.DEFAULT_TEAMS_TEAM_ID) !== Boolean(config.DEFAULT_TEAMS_CHANNEL_ID)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DEFAULT_TEAMS_TEAM_ID"],
      message: "team/channel defaults must be configured together",
    });
  }
  if (config.DEFAULT_TEAMS_TEAM_ID && !config.GRAPH_ALLOWED_TEAM_IDS.includes(config.DEFAULT_TEAMS_TEAM_ID)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DEFAULT_TEAMS_TEAM_ID"],
      message: "must be in Graph team allowlist",
    });
  }
});

export type ServerConfig = z.infer<typeof configSchema>;

/**
 * 環境変数をパースする。不足・不正があれば起動時に例外を投げ、
 * 誤設定のまま黙って稼働すること（webhook検証スキップ等）を防ぐ。
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
  warn: (message: string) => void = console.warn,
): ServerConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`E-CFG01: invalid server configuration: ${issues}`);
  }
  if (!parsed.data.METRICS_TOKEN) {
    warn("METRICS_TOKEN is not configured; GET /metrics is unauthenticated");
  }
  return parsed.data;
}
