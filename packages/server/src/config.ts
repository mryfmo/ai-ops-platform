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

const configSchema = z.object({
  /** HTTP待受ポート（公開エンドポイント。既定8080） */
  PORT: z.coerce.number().int().positive().default(8080),
  /** Next.js WebUIの内部ポート（webuiProxyの転送先。既定3100） */
  WEBUI_INTERNAL_PORT: z.coerce.number().int().positive().default(3100),
  /** PostgreSQL接続文字列（DevOps正本DB） */
  DATABASE_URL: z.string().min(1),
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
  /** 常駐コンテナの公開FQDN（Graph notificationUrl・WebUIディープリンクの生成に使用） */
  PUBLIC_BASE_URL: z.string().url(),
  /** Anthropic APIキー（自由文意図解釈で使用。未設定時はLLMフォールバック無効） */
  ANTHROPIC_API_KEY: z.string().optional(),
  /**
   * コーディングタスク関連シークレット（ADR-0006）。二用途で共有する:
   *   (a) confirmToken.ts の HMAC-SHA256鍵（確認リンクtokenの生成・検証）
   *   (b) .github/workflows/coding-task.yml が呼ぶ
   *       POST /internal/coding-tasks/:taskId/callback のBearer認証シークレット
   */
  CODING_TASK_CALLBACK_SECRET: z.string().min(32),
});

export type ServerConfig = z.infer<typeof configSchema>;

/**
 * 環境変数をパースする。不足・不正があれば起動時に例外を投げ、
 * 誤設定のまま黙って稼働すること（webhook検証スキップ等）を防ぐ。
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`E-CFG01: invalid server configuration: ${issues}`);
  }
  return parsed.data;
}
