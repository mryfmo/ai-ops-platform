/**
 * packages/server/src/lib/loadThresholds.ts
 *
 * 根拠: PrjOps:REQ-018 / AC-018-1 / PrjOps:REQ-042 / PrjOps:AC-042-1。
 * 負荷測定値とSLA上限の境界判定を、外部I/Oなしの決定的コードとして定義する。
 */

export const DELIVERY_CYCLE_MAX_MS = 2 * 60 * 60 * 1_000;
export const INGEST_TO_DISPATCH_MAX_MS = 5 * 60 * 1_000;

export function isWithinDeliveryCycleSla(elapsedMs: number): boolean {
  return elapsedMs >= 0 && elapsedMs <= DELIVERY_CYCLE_MAX_MS;
}

export function isWithinIngestToDispatchSla(elapsedMs: number): boolean {
  return elapsedMs >= 0 && elapsedMs <= INGEST_TO_DISPATCH_MAX_MS;
}
