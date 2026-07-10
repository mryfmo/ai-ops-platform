/**
 * packages/server/src/observability/logger.ts
 *
 * 根拠: ADR-0005（常駐サーバ運用）。pinoでJSONログとlevel設定を統一する。
 */
import pino, { type Logger } from "pino";

export function createLogger(level = "info"): Logger {
  return pino({ level, base: undefined });
}

export type { Logger };
