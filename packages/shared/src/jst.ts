/**
 * packages/shared/src/jst.ts
 *
 * 根拠: ADR-0005 / PrjOps:SPEC-INT-060（LLM日次上限のJSTリセット）、AUD-REL-007（JST計算の集約）。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const JST_UTC_LABEL = "UTC+9";

/** UTCの瞬間を、UTC getterでJSTの暦要素を読めるDateへ移す。 */
export function toJstClock(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

/** JSTの暦要素を同じ瞬間のUTC Dateへ戻す。monthIndexは0始まり。 */
export function fromJstClock(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day) - JST_OFFSET_MS);
}

/** JSTの「当日」の開始・終了をUTC ISO文字列で返す。 */
export function jstDayRange(now: Date): { startIso: string; endIso: string } {
  const jst = toJstClock(now);
  const start = fromJstClock(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  return {
    startIso: start.toISOString(),
    endIso: new Date(start.getTime() + DAY_MS).toISOString(),
  };
}
