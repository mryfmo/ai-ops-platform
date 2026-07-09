import { describe, it, expect } from "vitest";
import { buildHolidayCalendar, type HolidayEntry } from "@aiops/shared/calendar/businessCalendar.js";
import { computeReminderSchedule, isPreDueReminderDay, decideReminderAction } from "../src/lib/actionReminder.js";

const holidays: HolidayEntry[] = [{ date: "2026-01-01", name_ja: "元日", verified: true }];
const cal = buildHolidayCalendar(holidays);

describe("computeReminderSchedule [REQ-009 AC-009-1: 超過当日/+2営業日/+5営業日]", () => {
  it("平日期限なら翌営業日が超過当日", () => {
    // 2026-07-06(月)が期限 → 翌営業日は2026-07-07(火)
    const s = computeReminderSchedule(cal, "2026-07-06");
    expect(s.overdueDay).toBe("2026-07-07");
  });
  it("+2営業日/+5営業日が超過当日から正しく計算される", () => {
    const s = computeReminderSchedule(cal, "2026-07-06");
    // overdueDay=07-07(火)から+2営業日=07-09(木), +5営業日=07-14(火)
    expect(s.plus2BusinessDays).toBe("2026-07-09");
    expect(s.plus5BusinessDays).toBe("2026-07-14");
  });
});

describe("isPreDueReminderDay [REQ-009(a): 期限3営業日前の事前通知]", () => {
  it("期限3営業日前はtrue", () => {
    // 07-09(木)の3営業日前 = 07-06(月)
    expect(isPreDueReminderDay(cal, "2026-07-09", "2026-07-06")).toBe(true);
  });
  it("それ以外の日はfalse", () => {
    expect(isPreDueReminderDay(cal, "2026-07-09", "2026-07-07")).toBe(false);
  });
});

describe("decideReminderAction [REQ-009 AC-009-1/2]", () => {
  const due = "2026-07-06"; // 月, overdueDay=07-07, +2=07-09, +5=07-14

  it("完了済みアクションは督促しない", () => {
    const r = decideReminderAction(cal, { due, status: "done", remindersSentCount: 0, todayJst: "2026-07-07" });
    expect(r.shouldRemind).toBe(false);
    expect(r.shouldEscalate).toBe(false);
  });

  it("超過当日(07-07)に1回目の督促", () => {
    const r = decideReminderAction(cal, { due, status: "open", remindersSentCount: 0, todayJst: "2026-07-07" });
    expect(r.shouldRemind).toBe(true);
    expect(r.reminderNumber).toBe(1);
  });

  it("超過当日より前は督促しない", () => {
    const r = decideReminderAction(cal, { due, status: "open", remindersSentCount: 0, todayJst: "2026-07-06" });
    expect(r.shouldRemind).toBe(false);
  });

  it("+2営業日(07-09)に2回目の督促", () => {
    const r = decideReminderAction(cal, { due, status: "open", remindersSentCount: 1, todayJst: "2026-07-09" });
    expect(r.shouldRemind).toBe(true);
    expect(r.reminderNumber).toBe(2);
  });

  it("+5営業日(07-14)に3回目の督促", () => {
    const r = decideReminderAction(cal, { due, status: "open", remindersSentCount: 2, todayJst: "2026-07-14" });
    expect(r.shouldRemind).toBe(true);
    expect(r.reminderNumber).toBe(3);
  });

  it("3回送付済みでまだopenならエスカレーション（AC-009-2）、督促はしない", () => {
    const r = decideReminderAction(cal, { due, status: "open", remindersSentCount: 3, todayJst: "2026-07-20" });
    expect(r.shouldRemind).toBe(false);
    expect(r.shouldEscalate).toBe(true);
  });

  it("週末はバッチが走らないため督促しない", () => {
    // 07-11(土)
    const r = decideReminderAction(cal, { due, status: "open", remindersSentCount: 1, todayJst: "2026-07-11" });
    expect(r.shouldRemind).toBe(false);
  });

  it("ジョブが遅延しキャッチアップする場合も正しい回次で送付される", () => {
    // 07-09を過ぎて07-10(金)に初めてバッチが走っても2回目として送付
    const r = decideReminderAction(cal, { due, status: "open", remindersSentCount: 1, todayJst: "2026-07-10" });
    expect(r.shouldRemind).toBe(true);
    expect(r.reminderNumber).toBe(2);
  });
});
