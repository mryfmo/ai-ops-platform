/**
 * packages/server/src/lib/prjopsJobPolicy.ts
 *
 * 根拠: PrjOps:SPEC-INT-040 / PrjOps:REQ-006 / PrjOps:REQ-009。
 * 同一job内の10分retryだけをin-memoryで保持する。仕様はprocess restartを跨ぐjob stateを要求せず、
 * 各失敗・retry・escalationはappend-only auditへ残すため、新たな永続job-stateは作らない。
 */
import { decideOnJobFailure } from "@aiops/prjops";
import { dayOfWeek, isBusinessDay, nowJstHHmm, todayJstDateString, type HolidayCalendar } from "@aiops/shared";

export interface RetrySchedule {
  action: "retry" | "escalate";
  nextAttemptNumber?: number;
  nextAttemptAtMs?: number;
}

export function isWeeklyAnalysisDue(now: Date): boolean {
  const date = todayJstDateString(now);
  return dayOfWeek(date) === 1 && nowJstHHmm(now) === "06:00";
}

export function isDailyTrackingDue(calendar: HolidayCalendar, now: Date): boolean {
  const date = todayJstDateString(now);
  return isBusinessDay(calendar, date) && nowJstHHmm(now) === "09:00";
}

export function isSameJstDate(instant: string, date: string): boolean {
  const parsed = new Date(instant);
  return Number.isFinite(parsed.getTime()) && todayJstDateString(parsed) === date;
}

export function failureSchedule(attemptNumber: number, now: Date): RetrySchedule {
  const decision = decideOnJobFailure({ jobName: "prjops-scheduled-job", attemptNumber });
  if (decision.action === "retry") {
    return {
      action: "retry",
      nextAttemptNumber: attemptNumber + 1,
      nextAttemptAtMs: now.getTime() + decision.delayMinutes * 60_000,
    };
  }
  return { action: "escalate" };
}
