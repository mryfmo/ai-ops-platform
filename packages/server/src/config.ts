/**
 * packages/server/src/config.ts
 *
 * 根拠:
 *   - ADR-0005: 常駐サーバの環境変数はzodで起動時にfail-fastパースする。
 *     GRAPH_CLIENT_STATE（Graph change notificationのclientState検証値）を新設し、
 *     graphClient.tsの固定値ハードコードを廃止する。
 *   - PrjOps:SPEC-INT-060: 外部通信allowlist（api.anthropic.com / graph.microsoft.com / api.github.com）。
 *   - ADR-0006: CODING_TASK_CALLBACK_SECRETは.github/workflows/coding-task.ymlが
 *     POST /internal/coding-tasks/:taskId/callback を呼ぶ際のBearer認証シークレット。
 */
import { isAbsolute } from "node:path";
import { z } from "zod";
import { MAX_MODEL_ID_LENGTH, parseModelPricingUsdPerMtokJson, type ModelPricingUsdPerMtok } from "@aiops/shared";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_ANTHROPIC_ESCALATION_MODEL = "claude-opus-4-8";
const modelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_MODEL_ID_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

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
  ANTHROPIC_DEFAULT_MODEL: modelIdSchema.default(DEFAULT_ANTHROPIC_MODEL),
  ANTHROPIC_ESCALATION_MODEL: modelIdSchema.default(DEFAULT_ANTHROPIC_ESCALATION_MODEL),
  ANTHROPIC_PRICING_USD_PER_MTOK: z.string().optional(),
  /** PrjOps:REQ-002: 関係者マスタYAMLディレクトリ。未設定時はTeamsペルソナ解決を無効化する。 */
  STAKEHOLDERS_DIR: z.string().refine(isAbsolute, "must be an absolute path").optional(),
  /** A046 / DEC-SPEC-001: owner-pinned immutable PrjOps job data snapshot identity。 */
  PRJOPS_DATA_DIR: z.string().refine(isAbsolute, "must be an absolute path").optional(),
  PRJOPS_DATA_COMMIT_SHA: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  PRJOPS_DATA_SOURCE_COMMIT_SHA: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  PRJOPS_DATA_CONTENT_SHA256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  /** A046 / PrjOps:REQ-006: 3回目job failureのPMO通知先。mailbox addressはsecretではない。 */
  PMO_NOTIFY_MAILBOX: z
    .string()
    .trim()
    .email()
    .transform((mailbox) => mailbox.toLowerCase())
    .optional(),
  /** DevOps:SPEC-INT-061: GitHub App認証。App系3変数はsuperRefineでall-or-noneを強制する。 */
  GITHUB_APP_ID: z.string().trim().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().trim().min(1).optional(),
  GITHUB_APP_INSTALLATION_ID: z.string().trim().min(1).optional(),
  /** DevOps:SPEC-INT-061: GitHub App移行までの暫定PAT fallback。 */
  GITHUB_TOKEN: z.string().trim().min(1).optional(),
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
  /** AUD-OPM-009: 配信サイクル成功を外部 dead man's switch へ通知するURL。未設定時はno-op。 */
  HEARTBEAT_URL: z
    .string()
    .url()
    .refine((value) => {
      if (!URL.canParse(value)) return true;
      const url = new URL(value);
      return url.username === "" && url.password === "";
    })
    .optional(),
  /** ADR-0014: report-generation.yml -> /reports/ingest HMAC鍵。未設定時はingest disabled。 */
  REPORT_INGEST_SECRET: z.string().min(32).optional(),
  /** ADR-0008: /xlsx-import/* HMAC鍵。未設定時はxlsx import disabled。 */
  XLSX_IMPORT_SECRET: z.string().min(32).optional(),
  /** AUD-OPM-001: Auth.js検証済みEntra subjectをWeb BFFから受ける署名鍵。未設定時はapprovals disabled。 */
  WEB_BFF_IDENTITY_SECRET: z.string().min(32).optional(),
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
   * 確認リンクtokenのHMAC-SHA256鍵（ADR-0006）。**サーバ内にのみ保持し、外部へ渡さない。**
   *
   * 以前は CODING_TASK_CALLBACK_SECRET を兼用していたが、その値は GitHub Actions の
   * secrets として runner と curl 送信に露出する。露出した値から任意 taskId の確認トークンを
   * 再計算でき、`POST /coding-tasks/:id/confirm` を直接叩けば**人間クリック無しで
   * workflow_dispatch を起動できた**（所見 ADV-SEC-002 / ADV-INT-003）。ADR-0006 の核心が
   * 単一秘密の漏えいで崩れるため、信頼ドメインの異なる 2 用途を別鍵に分ける。
   */
  CODING_TASK_CONFIRM_SECRET: z.string().min(32),
  /**
   * .github/workflows/coding-task.yml が呼ぶ
   * POST /internal/coding-tasks/:taskId/callback のBearer認証シークレット（ADR-0006）。
   * Actions 側へ渡る前提の値なので、確認トークンの署名には使わない。
   */
  CODING_TASK_CALLBACK_SECRET: z.string().min(32),
});

const configSchema = baseConfigSchema.superRefine((config, ctx) => {
  // 2つの鍵を別変数にしても、同じ値を入れられては分離した意味が無い。Actions へ渡る
  // callback 値から確認トークンを再計算でき、人間承認の回避がそのまま復活する
  // （所見 ADV-SEC-002 / ADV-INT-003）。設定層で等値を拒否する。
  if (config.CODING_TASK_CONFIRM_SECRET === config.CODING_TASK_CALLBACK_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CODING_TASK_CONFIRM_SECRET"],
      message: "must differ from CODING_TASK_CALLBACK_SECRET; the callback value is exposed to GitHub Actions",
    });
  }
  if (config.WEB_BFF_IDENTITY_SECRET) {
    const otherSecrets = [
      config.GRAPH_CLIENT_STATE,
      config.GITHUB_WEBHOOK_SECRET,
      config.GRAPH_CLIENT_SECRET,
      config.METRICS_TOKEN,
      config.ANTHROPIC_API_KEY,
      config.GITHUB_APP_PRIVATE_KEY,
      config.GITHUB_TOKEN,
      config.REPORT_INGEST_SECRET,
      config.XLSX_IMPORT_SECRET,
      config.CODING_TASK_CONFIRM_SECRET,
      config.CODING_TASK_CALLBACK_SECRET,
    ];
    if (otherSecrets.some((secret) => secret === config.WEB_BFF_IDENTITY_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WEB_BFF_IDENTITY_SECRET"],
        message: "must differ from every other configured secret",
      });
    }
  }
  const githubAppValues = [config.GITHUB_APP_ID, config.GITHUB_APP_PRIVATE_KEY, config.GITHUB_APP_INSTALLATION_ID];
  const configuredGithubAppValues = githubAppValues.filter(Boolean).length;
  if (configuredGithubAppValues !== 0 && configuredGithubAppValues !== githubAppValues.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["GITHUB_APP_ID"],
      message: "GitHub App ID, private key, and installation ID must be configured together",
    });
  }
  const prjopsSnapshotValues = [
    config.PRJOPS_DATA_DIR,
    config.PRJOPS_DATA_COMMIT_SHA,
    config.PRJOPS_DATA_SOURCE_COMMIT_SHA,
    config.PRJOPS_DATA_CONTENT_SHA256,
  ];
  const configuredPrjopsSnapshotValues = prjopsSnapshotValues.filter(Boolean).length;
  if (configuredPrjopsSnapshotValues !== 0 && configuredPrjopsSnapshotValues !== prjopsSnapshotValues.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PRJOPS_DATA_DIR"],
      message: "PrjOps snapshot directory, accepted/source commits, and content checksum must be configured together",
    });
  }
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

type ParsedServerConfig = z.infer<typeof configSchema>;
export type ServerConfig = Omit<ParsedServerConfig, "ANTHROPIC_PRICING_USD_PER_MTOK"> & {
  ANTHROPIC_PRICING_USD_PER_MTOK: ModelPricingUsdPerMtok;
};

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
    warn("METRICS_TOKEN is not configured; GET /metrics is disabled and returns 503");
  }
  try {
    return {
      ...parsed.data,
      ANTHROPIC_PRICING_USD_PER_MTOK: parseModelPricingUsdPerMtokJson(parsed.data.ANTHROPIC_PRICING_USD_PER_MTOK),
    };
  } catch (error) {
    throw new Error(`E-CFG01: invalid server configuration: ${String(error)}`);
  }
}
