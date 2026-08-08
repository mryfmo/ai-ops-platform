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
  invalidDates: string[];
}

function toEpochDay(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epochMs = Date.UTC(year, month - 1, day);
  const normalized = new Date(epochMs);
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
  ) {
    return null;
  }
  return epochMs / MS_PER_DAY;
}

export function evaluateCalendarCoverage(
  entries: readonly HolidayEntry[],
  now: Date,
  warningDays = CALENDAR_COVERAGE_WARNING_DAYS,
): CalendarCoverage {
  const invalidDates: string[] = [];
  let lastDate: string | null = null;
  let lastEpochDay: number | null = null;
  for (const entry of entries) {
    const epochDay = toEpochDay(entry.date);
    if (epochDay === null) {
      invalidDates.push(entry.date);
    } else if (lastEpochDay === null || epochDay > lastEpochDay) {
      lastDate = entry.date;
      lastEpochDay = epochDay;
    }
  }
  if (lastDate === null || lastEpochDay === null) {
    return { lastDate: null, remainingDays: null, shouldWarn: true, invalidDates };
  }

  const todayEpochDay = toEpochDay(todayJstDateString(now))!;
  const remainingDays = lastEpochDay - todayEpochDay;
  return { lastDate, remainingDays, shouldWarn: invalidDates.length > 0 || remainingDays < warningDays, invalidDates };
}
