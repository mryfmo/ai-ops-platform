/**
 * packages/server/src/observability/logger.ts
 *
 * 根拠: ADR-0005（常駐サーバ運用）。pinoでJSONログとlevel設定を統一する。
 */
import pino, { type Logger } from "pino";

/**
 * ログから伏せるパス（所見 ADV-SEC-012）。
 *
 * 現在の呼び出しは安全な値しか渡していないが、`logger.info({ config })` のような誤用が
 * 一度あれば秘密がそのまま構造化ログへ載る。最終防波堤として、名前で秘密と分かるキーを
 * 深さ3まで伏せる。fast-redact の `*` は1階層だけに一致するため、各深さの静的パスを張る。
 * 本番の logger 呼び出し7件はすべてフラットな payload なので、3階層は現状より十分な余裕があり、
 * 再帰 formatter をログのホットパスへ追加せず request.headers.authorization 等も保護できる。
 */
export const REDACT_PATHS = [
  // 実際の設定キー名（SCREAMING_SNAKE）を挙げる。camelCase だけを並べても、想定している
  // `logger.info({ config })` の誤用には一つも当たらない——ServerConfig のプロパティは
  // `GRAPH_CLIENT_SECRET` や `METRICS_TOKEN` であって `secret` や `token` ではない。
  "DATABASE_URL",
  "GRAPH_CLIENT_SECRET",
  "GRAPH_CLIENT_STATE",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_TOKEN",
  "ANTHROPIC_API_KEY",
  "METRICS_TOKEN",
  "REPORT_INGEST_SECRET",
  "XLSX_IMPORT_SECRET",
  "CODING_TASK_CONFIRM_SECRET",
  "CODING_TASK_CALLBACK_SECRET",
  "WEB_BFF_IDENTITY_SECRET",
  "AUTH_SECRET",
  "AUTH_MICROSOFT_ENTRA_ID_SECRET",
  // 一般的な名前も残す。設定以外の構造体を渡す誤用にも効かせるため。
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apiKey",
  "privateKey",
  "connectionString",
].flatMap((name) => Array.from({ length: 4 }, (_, depth) => `${"*.".repeat(depth)}${name}`));

export function createLogger(level = "info", destination?: pino.DestinationStream): Logger {
  const options = { level, base: undefined, redact: { paths: REDACT_PATHS, censor: "[redacted]" } };
  // destination はテストが実際の設定ごと出力を検証するためのもの。省略時は既定の stdout。
  return destination ? pino(options, destination) : pino(options);
}

export type { Logger };
