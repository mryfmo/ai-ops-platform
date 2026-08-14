/**
 * packages/server/src/config.ts
 *
 * 根拠:
 *   - ADR-0005: 常駐サーバの環境変数はzodで起動時にfail-fastパースする。
 *     GRAPH_CLIENT_STATE（Graph change notificationのclientState検証値）を新設し、
 *     graphClient.tsの固定値ハードコードを廃止する。
 *   - PrjOps:SPEC-INT-060: 外部通信allowlist（Anthropic API / graph.microsoft.com / api.github.com。
 *     Anthropic の direct host 文字列は shared transport factory だけが知る — fitness test が強制）。
 *   - ADR-0006: CODING_TASK_CALLBACK_SECRETは.github/workflows/coding-task.ymlが
 *     POST /internal/coding-tasks/:taskId/callback を呼ぶ際のBearer認証シークレット。
 */
import { isAbsolute } from "node:path";
import { z } from "zod";
import {
  MAX_MODEL_ID_LENGTH,
  parseModelPricingUsdPerMtokJson,
  resolveMigrationFlags,
  type MigrationFlagStates,
  type ModelPricingUsdPerMtok,
} from "@aiops/shared";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_ANTHROPIC_ESCALATION_MODEL = "claude-opus-4-8";
// 根拠: FinalArch:LLM-001 / ADR-0022（P2-T06）。gateway モードの model は LiteLLM の
// logical alias のみ（正本: deploy/litellm/model-aliases.yaml application_aliases。
// fitness test が正本との一致を機械検証する）。capability の実体は proxy 側の
// *_MODEL_ID env binding が担う。
export const GATEWAY_MODEL_ALIASES: ReadonlySet<string> = new Set([
  "claude-governed",
  "claude-standard",
  "claude-native",
  "claude-code",
  "claude-fast",
]);
const DEFAULT_GATEWAY_MODEL = "claude-standard";
// Owner 裁定（2026-08-12、P2-T06-REVIEW owner_decision）: claude-governed を構造化出力
// 連続失敗時の正式な capability 昇格先とする。proxy 側 BEDROCK_CLAUDE_GOVERNED_MODEL_ID
// には最上位 capability model（opus 相当）を bind する運用規約（deployment binding）。
const DEFAULT_GATEWAY_ESCALATION_MODEL = "claude-governed";
export const LITELLM_FLAG_NAME = "inference.litellm.enabled";
// direct provider egress は security+ai-platform 所有の正典 flag が唯一のゲート
// （requires: classification<=internal / explicit-provider-allow。kill switch 有効）。
export const DIRECT_FALLBACK_FLAG_NAME = "inference.anthropic_direct_fallback.enabled";

// 根拠: FinalArch:FR-CP-008 / WBS P3-T10。Temporal への段階的 cutover。
export const TEMPORAL_FLAG_NAME = "control.temporal.enabled";
export const LEGACY_SCHEDULER_FLAG_NAME = "control.legacy_scheduler.enabled";

/**
 * legacy scheduler の 15 登録名（P3-T09 shadow harness の
 * EXPECTED_SCHEDULER_REGISTRATIONS と CI テストで完全一致を強制する正本鏡）。
 * 追加・削除は harness 側と同一 PR で行うこと。
 */
export const TEMPORAL_CUTOVER_TASK_NAMES = [
  "createHealthcheckTask",
  "inline:capability-metrics-refresh-30s",
  "createReportDeliveryMetricsTask",
  "createApprovedDeployTask",
  "createProdMonitorTask",
  "createJitRevocationTask",
  "createCodingTaskReaperTask",
  "createSubscriptionRenewalTask",
  "createChannelPollingTask",
  "createEventsPollingTask",
  "createPmSnapshotReconcileTask",
  "createSevenKeysMonthlySnapshotTask",
  "createPrjopsWeeklyAnalyzeTask",
  "createPrjopsDailyTrackerTask",
  "createReportDeliveryTask",
] as const;

export type TemporalCutoverTaskName = (typeof TEMPORAL_CUTOVER_TASK_NAMES)[number];

/**
 * per-workflow cutover の決定的 selector（WBS P3-T10）。
 * - temporal が false/shadow: 抑止なし（旧経路完全維持）。cutover list は不活性として
 *   無視する — kill switch（stage→false）が env 1 つで全復帰になることを優先
 * - limited: list 記載 task のみ legacy 実行を抑止（残りは soak として legacy 継続）。
 *   list 空・未知名・重複は E-CFG07
 * - primary: 全 task 抑止（正本の mutually-exclusive 規則により legacy flag は
 *   off が前提。resolveMigrationFlags 側の検証と二重化）
 * kill switch（AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL=1）は resolveMigrationFlags が
 * temporal を "false" へ落とすため、本 selector は自動的に「抑止なし」へ復帰する。
 */
/**
 * server 側 writer 制約（P3-T10-001/006）。本関数が保証するのは
 * 「server 内で zero-writer 構成を拒否し、kill switch で legacy 側を復元する」
 * ことまでで、Temporal 側 writer（登録済み schedule の executionMode）は
 * 制御しない。primary からの rollback は runbook の順序
 * （1. Temporal schedule を pause/shadow → 2. KILL=1 + restart）に従うこと。
 * 順序を誤ると overlap 窓で両 writer が生じ得る（各 workflow の TMP-003
 * 冪等台帳が二重外部 write の最終防壁）。
 * - temporal=primary: legacy flag は正本の相互排他により false 必須（E-CFG08）
 * - temporal!=primary: persisted legacy=false は zero-writer として E-CFG08。
 *   ただし kill switch 発動時は legacy を effective true へ復元
 * 返り値: legacy scheduler を起動すべきか。
 */
export function resolveLegacySchedulerEffective(
  temporalStage: string,
  legacyFlagValue: string,
  killActive: boolean,
): boolean {
  if (temporalStage === "primary") {
    // 正本の mutually-exclusive 規則（resolveMigrationFlags）で legacy=false が
    // 保証されるが、二重化して zero/dual-writer を遮断する。
    if (legacyFlagValue !== "false") {
      throw new Error(`E-CFG08: ${LEGACY_SCHEDULER_FLAG_NAME} must be false when ${TEMPORAL_FLAG_NAME}=primary`);
    }
    return false;
  }
  if (legacyFlagValue === "false") {
    if (killActive) {
      // primary 構成に KILL=1 だけを足した緊急 rollback: legacy を復元する。
      return true;
    }
    throw new Error(
      `E-CFG08: ${LEGACY_SCHEDULER_FLAG_NAME}=false requires ${TEMPORAL_FLAG_NAME}=primary ` +
        "(zero-writer configuration rejected)",
    );
  }
  return true;
}

export function resolveTemporalCutover(
  temporalStage: string,
  cutoverTasksRaw: string | undefined,
): ReadonlySet<TemporalCutoverTaskName> {
  const raw = cutoverTasksRaw?.trim() ?? "";
  if (temporalStage === "false" || temporalStage === "shadow") {
    // kill switch（.._KILL=1）は stage を "false" へ落とす。このとき cutover list が
    // 残っていても「env 1 つで旧経路へ全復帰」を成立させるため、list は不活性として
    // 無視する（エラーにしない）。soak 手順は runbooks/temporal-cutover.md。
    return new Set();
  }
  if (temporalStage === "primary") {
    if (raw !== "") {
      throw new Error("E-CFG07: AIOPS_TEMPORAL_CUTOVER_TASKS must be unset at primary (all tasks are cut over)");
    }
    return new Set(TEMPORAL_CUTOVER_TASK_NAMES);
  }
  if (temporalStage !== "limited") {
    throw new Error(`E-CFG07: unknown ${TEMPORAL_FLAG_NAME} stage: ${temporalStage}`);
  }
  if (raw === "") {
    throw new Error("E-CFG07: AIOPS_TEMPORAL_CUTOVER_TASKS must list at least one task at limited stage");
  }
  const names = raw.split(",").map((n) => n.trim());
  const known: ReadonlySet<string> = new Set(TEMPORAL_CUTOVER_TASK_NAMES);
  const selected = new Set<TemporalCutoverTaskName>();
  for (const name of names) {
    if (!known.has(name)) {
      throw new Error(`E-CFG07: unknown scheduler task in AIOPS_TEMPORAL_CUTOVER_TASKS: ${JSON.stringify(name)}`);
    }
    if (selected.has(name as TemporalCutoverTaskName)) {
      throw new Error(`E-CFG07: duplicate scheduler task in AIOPS_TEMPORAL_CUTOVER_TASKS: ${JSON.stringify(name)}`);
    }
    selected.add(name as TemporalCutoverTaskName);
  }
  return selected;
}

/** 空文字・空白のみを未設定と同一視する optional 文字列（.env.example の空値対策） */
const optionalTrimmed = (schema: z.ZodType<string>) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, schema.optional());
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
  /** P3-T10: limited stage で legacy 実行を抑止する task 名（comma list）。 */
  AIOPS_TEMPORAL_CUTOVER_TASKS: optionalTrimmed(z.string()).optional(),
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
  /** Anthropic APIキー（direct 移行期のみ。gateway モードでは不要・不使用） */
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_DEFAULT_MODEL: modelIdSchema.optional(),
  ANTHROPIC_ESCALATION_MODEL: modelIdSchema.optional(),
  ANTHROPIC_PRICING_USD_PER_MTOK: z.string().optional(),
  /** LiteLLM gateway（FinalArch:LLM-001 / ADR-0022）。inference.litellm.enabled が
   * off 以外のとき必須。virtual key は Secrets 経由で注入する。空文字は未設定扱い。 */
  LITELLM_BASE_URL: optionalTrimmed(z.string().url()),
  LITELLM_VIRTUAL_KEY: optionalTrimmed(z.string().min(1)),
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
  const scheduledMailEnabled = config.REPORT_DELIVERY_ENABLED || Boolean(config.PMO_NOTIFY_MAILBOX);
  if (
    scheduledMailEnabled &&
    (!config.FROM_MAILBOX || !config.GRAPH_ALLOWED_FROM_MAILBOXES.includes(config.FROM_MAILBOX))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["FROM_MAILBOX"],
      message: "is required and must be in the Graph mailbox allowlist when scheduled mail is enabled",
    });
  }
  if (!config.REPORT_DELIVERY_ENABLED) return;
  if (!config.STAKEHOLDERS_DIR) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["STAKEHOLDERS_DIR"],
      message: "is required when report delivery is enabled",
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
export type ServerConfig = Omit<
  ParsedServerConfig,
  "ANTHROPIC_PRICING_USD_PER_MTOK" | "ANTHROPIC_DEFAULT_MODEL" | "ANTHROPIC_ESCALATION_MODEL"
> & {
  ANTHROPIC_PRICING_USD_PER_MTOK: ModelPricingUsdPerMtok;
  /** mode 別既定を解決済み（gateway: logical alias / direct: provider model ID） */
  ANTHROPIC_DEFAULT_MODEL: string;
  ANTHROPIC_ESCALATION_MODEL: string;
  /** 根拠: FinalArch:LLM-001（P2-T06）。inference.litellm.enabled が off 以外なら true */
  LLM_GATEWAY_ENABLED: boolean;
  /** 根拠: FinalArch:LLM-001。正典 direct fallback flag（kill switch 込み）の解決結果 */
  LLM_DIRECT_FALLBACK_ENABLED: boolean;
  /** 根拠: FinalArch:FR-CP-008 / FinalArch:GOV-005。移行 flag 状態（fail closed で解決済み） */
  MIGRATION_FLAGS: MigrationFlagStates;
  /** P3-T10: legacy scheduler で実行を抑止する task 名集合（cutover 済み）。 */
  TEMPORAL_CUTOVER_SUPPRESSED: ReadonlySet<TemporalCutoverTaskName>;
  /** P3-T10-001/006: server 側 writer 制約適用後の legacy scheduler 起動可否。 */
  LEGACY_SCHEDULER_EFFECTIVE: boolean;
  /** P3-T10-006: kill switch 発動中（Temporal 側 pause の要確認を index が警告）。 */
  TEMPORAL_KILL_SWITCH_ACTIVE: boolean;
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
  const migrationFlags = resolveMigrationFlags(env);
  if (migrationFlags.errors.length > 0) {
    throw new Error(`E-CFG01: invalid server configuration: ${migrationFlags.errors.join("; ")}`);
  }

  // 根拠: FinalArch:LLM-001 / ADR-0022（P2-T06）。gateway が既定経路。
  // flag が off 以外なら LiteLLM 構成を必須とし、model は logical alias に限定する。
  const llmGatewayEnabled = (migrationFlags.states.get(LITELLM_FLAG_NAME) ?? "false") !== "false";
  // direct provider egress は正典 flag の明示 enable が唯一の入口（kill switch は
  // resolveMigrationFlags が反映済み）。provider key の存在だけでは有効化しない。
  const llmDirectFallbackEnabled = (migrationFlags.states.get(DIRECT_FALLBACK_FLAG_NAME) ?? "false") !== "false";
  let defaultModel = parsed.data.ANTHROPIC_DEFAULT_MODEL;
  let escalationModel = parsed.data.ANTHROPIC_ESCALATION_MODEL;
  if (llmGatewayEnabled) {
    if (!parsed.data.LITELLM_BASE_URL || !parsed.data.LITELLM_VIRTUAL_KEY) {
      throw new Error(
        `E-CFG01: invalid server configuration: ${LITELLM_FLAG_NAME} requires LITELLM_BASE_URL and LITELLM_VIRTUAL_KEY`,
      );
    }
    defaultModel ??= DEFAULT_GATEWAY_MODEL;
    escalationModel ??= DEFAULT_GATEWAY_ESCALATION_MODEL;
    for (const [field, model] of [
      ["ANTHROPIC_DEFAULT_MODEL", defaultModel],
      ["ANTHROPIC_ESCALATION_MODEL", escalationModel],
    ] as const) {
      if (!GATEWAY_MODEL_ALIASES.has(model)) {
        throw new Error(
          `E-CFG01: invalid server configuration: ${field} must be a LiteLLM logical alias in gateway mode (got ${model})`,
        );
      }
    }
  } else {
    defaultModel ??= DEFAULT_ANTHROPIC_MODEL;
    escalationModel ??= DEFAULT_ANTHROPIC_ESCALATION_MODEL;
  }

  try {
    return {
      ...parsed.data,
      ANTHROPIC_PRICING_USD_PER_MTOK: parseModelPricingUsdPerMtokJson(parsed.data.ANTHROPIC_PRICING_USD_PER_MTOK),
      ANTHROPIC_DEFAULT_MODEL: defaultModel,
      ANTHROPIC_ESCALATION_MODEL: escalationModel,
      LLM_GATEWAY_ENABLED: llmGatewayEnabled,
      LLM_DIRECT_FALLBACK_ENABLED: llmDirectFallbackEnabled,
      MIGRATION_FLAGS: migrationFlags.states,
      TEMPORAL_CUTOVER_SUPPRESSED: resolveTemporalCutover(
        migrationFlags.states.get(TEMPORAL_FLAG_NAME) ?? "false",
        parsed.data.AIOPS_TEMPORAL_CUTOVER_TASKS,
      ),
      LEGACY_SCHEDULER_EFFECTIVE: resolveLegacySchedulerEffective(
        migrationFlags.states.get(TEMPORAL_FLAG_NAME) ?? "false",
        migrationFlags.states.get(LEGACY_SCHEDULER_FLAG_NAME) ?? "true",
        (env.AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL ?? "").trim() === "1",
      ),
      TEMPORAL_KILL_SWITCH_ACTIVE: (env.AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL ?? "").trim() === "1",
    };
  } catch (error) {
    throw new Error(`E-CFG01: invalid server configuration: ${String(error)}`);
  }
}
