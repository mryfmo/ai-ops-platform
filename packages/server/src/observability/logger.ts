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
 * 深さに関わらず伏せる。`*.` 前置のワイルドカードは任意の階層に対応する。
 */
export const REDACT_PATHS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apiKey",
  "privateKey",
  "connectionString",
  "*.password",
  "*.token",
  "*.secret",
  "*.authorization",
  "*.cookie",
  "*.apiKey",
  "*.privateKey",
  "*.connectionString",
];

export function createLogger(level = "info", destination?: pino.DestinationStream): Logger {
  const options = { level, base: undefined, redact: { paths: REDACT_PATHS, censor: "[redacted]" } };
  // destination はテストが実際の設定ごと出力を検証するためのもの。省略時は既定の stdout。
  return destination ? pino(options, destination) : pino(options);
}

export type { Logger };
