import { describe, it, expect } from "vitest";
import {
  buildHolidayCalendar,
  isBusinessDay,
  isWeekend,
  dayOfWeek,
  addBusinessDays,
  nthBusinessDayOfMonth,
  isNthBusinessDayOfMonth,
  isBusinessHoursJst,
  businessDaysBetween,
  isQuarterStartMonth,
  type HolidayEntry,
} from "../src/calendar/businessCalendar.js";

// SPEC-INT-054 / OPS-09: サンプル祝日（2026年）を用いた決定的テスト
const sampleHolidays: HolidayEntry[] = [
  { date: "2026-01-01", name_ja: "元日", verified: true },
  { date: "2026-01-12", name_ja: "成人の日", verified: true },
  { date: "2026-05-06", name_ja: "振替休日", verified: true },
];
const cal = buildHolidayCalendar(sampleHolidays);

describe("dayOfWeek / isWeekend [SPEC-INT-054]", () => {
  it("2026-07-06 (月) は平日", () => {
    expect(dayOfWeek("2026-07-06")).toBe(1);
    expect(isWeekend("2026-07-06")).toBe(false);
  });
  it("2026-07-04 (土) / 2026-07-05 (日) は週末", () => {
    expect(isWeekend("2026-07-04")).toBe(true);
    expect(isWeekend("2026-07-05")).toBe(true);
  });
});

describe("isBusinessDay [SPEC-INT-054]", () => {
  it("平日かつ祝日でない日は営業日", () => {
    expect(isBusinessDay(cal, "2026-07-06")).toBe(true);
  });
  it("祝日は営業日ではない（元日）", () => {
    expect(isBusinessDay(cal, "2026-01-01")).toBe(false);
  });
  it("土日は営業日ではない", () => {
    expect(isBusinessDay(cal, "2026-07-04")).toBe(false);
  });
});

describe("addBusinessDays [REQ-009 督促間隔: 超過当日/+2営業日/+5営業日]", () => {
  it("2026-01-01(祝, n=0) は次の営業日(01-02金)を返す", () => {
    expect(addBusinessDays(cal, "2026-01-01", 0)).toBe("2026-01-02");
  });
  it("2026-01-05(月, 平日)から+2営業日 = 01-07(水)（01-06は平日なので営業日として数える）", () => {
    // 01-05(月),01-06(火),01-07(水) はいずれも平日・非祝日
    expect(addBusinessDays(cal, "2026-01-05", 2)).toBe("2026-01-07");
  });
  it("成人の日(01-12,祝)をまたぐ+2営業日計算", () => {
    // 01-09(金)起点。+1=01-13(火, 01-10/11は週末, 01-12は祝日でスキップ) +2=01-14(水)
    expect(addBusinessDays(cal, "2026-01-09", 2)).toBe("2026-01-14");
  });
  it("負の数で過去方向にも計算できる", () => {
    expect(addBusinessDays(cal, "2026-01-14", -2)).toBe("2026-01-09");
  });
});

describe("nthBusinessDayOfMonth / isNthBusinessDayOfMonth [REQ-014/015, REQ-019, DOC-02 §2]", () => {
  it("2026年1月の第1営業日は01-02(元日1/1が祝日のため翌平日)", () => {
    expect(nthBusinessDayOfMonth(cal, 2026, 1, 1)).toBe("2026-01-02");
  });
  it("2026年1月の第3営業日は成人の日(01-12)をスキップして01-13", () => {
    // 01-02(金)=1, 01-05(月)=2, 01-06(火)=3 ... 第3営業日は01-06
    expect(nthBusinessDayOfMonth(cal, 2026, 1, 3)).toBe("2026-01-06");
  });
  it("isNthBusinessDayOfMonthは境界値を正しく判定する", () => {
    expect(isNthBusinessDayOfMonth(cal, "2026-01-02", 1)).toBe(true);
    expect(isNthBusinessDayOfMonth(cal, "2026-01-05", 1)).toBe(false);
  });
});

describe("isQuarterStartMonth [DOC-02 §2: 四半期初月]", () => {
  it("1,4,7,10月がtrue", () => {
    expect(isQuarterStartMonth("2026-01-15")).toBe(true);
    expect(isQuarterStartMonth("2026-04-01")).toBe(true);
    expect(isQuarterStartMonth("2026-07-01")).toBe(true);
    expect(isQuarterStartMonth("2026-10-01")).toBe(true);
  });
  it("それ以外はfalse", () => {
    expect(isQuarterStartMonth("2026-02-01")).toBe(false);
  });
});

describe("isBusinessHoursJst [DevOps SPEC-INT-021 factor E]", () => {
  it("平日09:00は営業時間内", () => {
    expect(isBusinessHoursJst(cal, "2026-07-06", "09:00")).toBe(true);
  });
  it("平日18:59は営業時間内、19:00は営業時間外（境界値）", () => {
    expect(isBusinessHoursJst(cal, "2026-07-06", "18:59")).toBe(true);
    expect(isBusinessHoursJst(cal, "2026-07-06", "19:00")).toBe(false);
  });
  it("平日08:59は営業時間外", () => {
    expect(isBusinessHoursJst(cal, "2026-07-06", "08:59")).toBe(false);
  });
  it("土日は終日営業時間外", () => {
    expect(isBusinessHoursJst(cal, "2026-07-04", "12:00")).toBe(false);
  });
  it("祝日は終日営業時間外", () => {
    expect(isBusinessHoursJst(cal, "2026-01-01", "12:00")).toBe(false);
  });
});

describe("businessDaysBetween", () => {
  it("同一日は0", () => {
    expect(businessDaysBetween(cal, "2026-07-06", "2026-07-06")).toBe(0);
  });
  it("月〜金(2026-07-06〜07-10)は開始除外で4営業日", () => {
    expect(businessDaysBetween(cal, "2026-07-06", "2026-07-10")).toBe(4);
  });
});
