/**
 * packages/server/src/lib/loadThresholds.ts
 *
 * 根拠: PrjOps:REQ-018 / AC-018-1 / PrjOps:REQ-030 / PrjOps:REQ-042 / PrjOps:AC-042-1。
 * 負荷測定値とSLA上限の境界判定を、外部I/Oなしの決定的コードとして定義する。
 * PrjOps:REQ-030の100案件・2,000受信者はloadBaseline.test.tsで外部I/Oなしのbaselineだけを測定する。
 * 正本取得・受信者解決・全profile・永続化を含む本番同等SLA証拠はP010-F06-T17まで未完了。
 */

export const WEEKLY_PROCESSING_MAX_MS = 2 * 60 * 60 * 1_000;
export const DELIVERY_CYCLE_MAX_MS = 2 * 60 * 60 * 1_000;
export const INGEST_TO_DISPATCH_MAX_MS = 5 * 60 * 1_000;

export function isWithinWeeklyProcessingSla(elapsedMs: number): boolean {
  return elapsedMs >= 0 && elapsedMs <= WEEKLY_PROCESSING_MAX_MS;
}

export function isWithinDeliveryCycleSla(elapsedMs: number): boolean {
  return elapsedMs >= 0 && elapsedMs <= DELIVERY_CYCLE_MAX_MS;
}

export function isWithinIngestToDispatchSla(elapsedMs: number): boolean {
  return elapsedMs >= 0 && elapsedMs <= INGEST_TO_DISPATCH_MAX_MS;
}
