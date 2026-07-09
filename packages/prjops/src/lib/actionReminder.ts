/**
 * packages/prjops/src/lib/actionReminder.ts
 *
 * 根拠: REQ-009 アクション期限管理
 *   毎営業日09:00 JSTに (a) 期限3営業日前の事前通知、(b) 期限超過の督促を担当者へ送付する（TOBE-10）。
 *   AC-009-1: 同一アクションへの督促は最大3回（超過当日、+2営業日、+5営業日）。
 *   AC-009-2: 3回目の督促後も未完了の場合、当該プロジェクトのPRF-03へエスカレーション通知が送られる。
 *
 * 設計上の明示的な解釈（原文の自然言語の曖昧さに対する決定的な補完。DOC-05 §11の実装完了定義に従い
 * ここに明記する）:
 *   「超過当日」を、期限日(due)の翌営業日（＝毎営業日バッチが期限超過を最初に検知できる日）と定義する。
 *   「+2営業日」「+5営業日」はその「超過当日」からの営業日オフセットとする。
 *   （祝日・週末に期限日が重なっても、バッチは営業日にしか走らないため、この定義が
 *     "3営業日前の事前通知"や実運用上の検知タイミングと整合する。）
 */
import { type HolidayCalendar, addBusinessDays, isBusinessDay } from "@aiops/shared/calendar/businessCalendar.js";

export interface ReminderSchedule {
  overdueDay: string; // 超過当日（due+1営業日）
  plus2BusinessDays: string;
  plus5BusinessDays: string;
}

/** REQ-009督促スケジュールを算出する（due=アクション期限日） */
export function computeReminderSchedule(cal: HolidayCalendar, due: string): ReminderSchedule {
  const overdueDay = addBusinessDays(cal, due, 1);
  const plus2BusinessDays = addBusinessDays(cal, overdueDay, 2);
  const plus5BusinessDays = addBusinessDays(cal, overdueDay, 5);
  return { overdueDay, plus2BusinessDays, plus5BusinessDays };
}

/** REQ-009(a): 期限3営業日前の事前通知対象かどうか */
export function isPreDueReminderDay(cal: HolidayCalendar, due: string, todayJst: string): boolean {
  if (!isBusinessDay(cal, todayJst)) return false;
  const threeBusinessDaysBeforeDue = addBusinessDays(cal, due, -3);
  return todayJst === threeBusinessDaysBeforeDue;
}

export interface ReminderDecisionInput {
  due: string;
  status: "open" | "done";
  remindersSentCount: number; // これまでに送付済みの督促回数（0〜3）
  todayJst: string;
}

export interface ReminderDecision {
  shouldRemind: boolean;
  reminderNumber?: 1 | 2 | 3;
  shouldEscalate: boolean; // AC-009-2: 3回目の督促後も未完了ならPRF-03へエスカレーション
}

/** REQ-009(b) + AC-009-1/2: 督促/エスカレーション判定（決定的・LLM不使用） */
export function decideReminderAction(cal: HolidayCalendar, input: ReminderDecisionInput): ReminderDecision {
  if (input.status === "done") {
    return { shouldRemind: false, shouldEscalate: false };
  }
  if (!isBusinessDay(cal, input.todayJst)) {
    return { shouldRemind: false, shouldEscalate: false };
  }

  const schedule = computeReminderSchedule(cal, input.due);
  const milestones: Array<{ date: string; number: 1 | 2 | 3 }> = [
    { date: schedule.overdueDay, number: 1 },
    { date: schedule.plus2BusinessDays, number: 2 },
    { date: schedule.plus5BusinessDays, number: 3 },
  ];

  if (input.remindersSentCount >= 3) {
    // 3回送付済みでまだopen → エスカレーション（AC-009-2）。督促自体はこれ以上送らない（AC-009-1: 最大3回）。
    return { shouldRemind: false, shouldEscalate: true };
  }

  const nextMilestone = milestones[input.remindersSentCount]!;
  // ジョブが祝日等でその日に走れなかった場合に備え、当日以降（>=）でキャッチアップ送信する
  if (input.todayJst >= nextMilestone.date) {
    return { shouldRemind: true, reminderNumber: nextMilestone.number, shouldEscalate: false };
  }
  return { shouldRemind: false, shouldEscalate: false };
}
