/**
 * packages/server/src/lib/calendarCoverage.ts
 *
 * 根拠: ADR-0005 / PrjOps:SPEC-INT-054 / ADV-OPS-010。祝日データの残存coverageを純粋判定する。
 */
import { todayJstDateString, type HolidayEntry } from "@aiops/shared";

const MS_PER_DAY = 86_400_000;

// 年1回の手動更新PRを、調査・レビュー・本番反映まで半年の余裕をもって開始できる閾値。
export const CALENDAR_COVERAGE_WARNING_DAYS = 180;

export interface CalendarCoverage {
  lastDate: string | null;
  remainingDays: number | null;
  shouldWarn: boolean;
}

function toEpochDay(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / MS_PER_DAY;
}

export function evaluateCalendarCoverage(
  entries: readonly HolidayEntry[],
  now: Date,
  warningDays = CALENDAR_COVERAGE_WARNING_DAYS,
): CalendarCoverage {
  const lastDate = entries.reduce<string | null>(
    (latest, entry) => (latest === null || entry.date > latest ? entry.date : latest),
    null,
  );
  if (lastDate === null) return { lastDate: null, remainingDays: null, shouldWarn: true };

  const remainingDays = toEpochDay(lastDate) - toEpochDay(todayJstDateString(now));
  return { lastDate, remainingDays, shouldWarn: remainingDays < warningDays };
}
