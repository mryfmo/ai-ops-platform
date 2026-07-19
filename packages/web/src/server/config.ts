/**
 * packages/web/src/server/config.ts
 *
 * 根拠: ADR-0005（常駐サーバ + WebUIダッシュボード。環境変数はzodで起動時にfail-fastパースする方針を
 *   packages/server/src/config.ts と同様にWebUI側にも適用する）
 *   - AUTH_SECRET / AUTH_MICROSOFT_ENTRA_ID_*: Auth.js v5 + Microsoft Entra ID SSO（本タスクの主題）
 *   - DATABASE_URL: DevOps正本DB（packages/server と同一PostgreSQL）。personaResolverが
 *     recipientsテーブルをリクエスト毎に照会するために使用する（キャッシュ禁止。CLAUDE.md設計原則6）。
 *   - ANTHROPIC_API_KEY: /api/chat（Vercel AI SDK + Claude）用。任意項目とし、未設定でも
 *     起動・ビルドを妨げない（/api/chat route.ts側が未設定を検知し503を返す。#14）。
 *
 * 注意: このモジュールを import しただけで即座に環境変数を要求しない（loadConfig()呼び出し時に
 * 初めて検証する）。next.config.mjs の方針（ビルド時に秘匿情報を要求しない）と整合させるため、
 * ビルド時に評価されうるモジュールのトップレベルでは loadConfig() を呼ばないこと。
 */
import { z } from "zod";
import { isAbsolute } from "node:path";
import { MAX_MODEL_ID_LENGTH, parseModelPricingUsdPerMtokJson, type ModelPricingUsdPerMtok } from "@aiops/shared";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const modelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_MODEL_ID_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const webConfigSchema = z
  .object({
    /** Auth.js v5 セッション暗号化に使用する秘密鍵（必須） */
    AUTH_SECRET: z.string().min(1),
    /** Microsoft Entra ID アプリ登録の クライアントID */
    AUTH_MICROSOFT_ENTRA_ID_ID: z.string().min(1),
    /** Microsoft Entra ID アプリ登録の クライアントシークレット */
    AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().min(1),
    /** Microsoft Entra ID テナントID */
    AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: z.string().min(1),
    /** PostgreSQL接続文字列（DevOps正本DB。recipientsテーブル照会用） */
    DATABASE_URL: z.string().min(1),
    /** 同一コンテナ内Honoサーバー。Excel取込のサーバーサイド転送専用。 */
    AIOPS_SERVER_INTERNAL_URL: z.string().url().default("http://127.0.0.1:8080"),
    /** ブラウザからの状態変更リクエストで許可する公開origin。 */
    PUBLIC_BASE_URL: z.string().url(),
    /** Excel取込のHMAC鍵。ブラウザへ公開せずRoute Handlerのみで使用する。 */
    XLSX_IMPORT_SECRET: z.string().min(32).optional(),
    /** Anthropic APIキー（/api/chat用。未設定時はチャット機能を503で無効化する） */
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_DEFAULT_MODEL: modelIdSchema.default(DEFAULT_ANTHROPIC_MODEL),
    ANTHROPIC_PRICING_USD_PER_MTOK: z.string().optional(),
    /** immutable prjops-data checkoutのabsolute export root。T08 compositionでfactoryへ渡す。 */
    PRJOPS_DATA_DIR: z.string().refine(isAbsolute, "must be an absolute path").optional(),
    /** protected environmentが受理したimmutable commit SHA。 */
    PRJOPS_DATA_COMMIT_SHA: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .optional(),
    /** snapshot publisherが付与した実checkout commit provenance。 */
    PRJOPS_DATA_SOURCE_COMMIT_SHA: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .optional(),
    /** owner承認済みcanonical manifest SHA-256。 */
    PRJOPS_DATA_CONTENT_SHA256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    /** ページエージェントの最大toolステップ数（PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068）。未指定時は5。 */
    PAGE_AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(10).optional(),
    /** Anthropic extended thinkingのtoken budget（PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068）。未指定時は12000。 */
    PAGE_AGENT_THINKING_BUDGET_TOKENS: z.coerce.number().int().min(1024).max(64000).optional(),
  })
  .superRefine((config, context) => {
    const snapshotConfig = [
      config.PRJOPS_DATA_DIR,
      config.PRJOPS_DATA_COMMIT_SHA,
      config.PRJOPS_DATA_SOURCE_COMMIT_SHA,
      config.PRJOPS_DATA_CONTENT_SHA256,
    ];
    if (snapshotConfig.some((value) => value !== undefined) && snapshotConfig.some((value) => value === undefined)) {
      context.addIssue({
        code: "custom",
        message: "PrjOps data directory, accepted/source commits, and checksum must be configured together",
      });
    }
  });

type ParsedWebConfig = z.infer<typeof webConfigSchema>;
export type WebConfig = Omit<ParsedWebConfig, "ANTHROPIC_PRICING_USD_PER_MTOK"> & {
  ANTHROPIC_PRICING_USD_PER_MTOK: ModelPricingUsdPerMtok;
};

/**
 * 環境変数をパースする。不足・不正があれば起動時に例外を投げ、
 * 誤設定のまま黙って稼働すること（認証スキップ等）を防ぐ。
 */
export function loadWebConfig(env: Record<string, string | undefined> = process.env): WebConfig {
  const parsed = webConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`E-CFG02: invalid web configuration: ${issues}`);
  }
  try {
    return {
      ...parsed.data,
      ANTHROPIC_PRICING_USD_PER_MTOK: parseModelPricingUsdPerMtokJson(parsed.data.ANTHROPIC_PRICING_USD_PER_MTOK),
    };
  } catch (error) {
    throw new Error(`E-CFG02: invalid web configuration: ${String(error)}`);
  }
}
