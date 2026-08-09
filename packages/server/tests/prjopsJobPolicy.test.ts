/** 根拠: PrjOps:SPEC-INT-040 / PrjOps:REQ-006 / PrjOps:REQ-009 */
import { describe, expect, it } from "vitest";
import { buildHolidayCalendar } from "@aiops/shared";
import { isDailyTrackingDue, isWeeklyAnalysisDue, isSameJstDate } from "../src/lib/prjopsJobPolicy.js";

describe("prjopsJobPolicy [PrjOps:SPEC-INT-040 / PrjOps:REQ-009]", () => {
  const calendar = buildHolidayCalendar([{ date: "2026-07-20", name_ja: "海の日", verified: true }]);

  it("月曜06:00 JSTだけをweekly analysis slotにする", () => {
    expect(isWeeklyAnalysisDue(new Date("2026-07-19T21:00:00Z"))).toBe(true);
    expect(isWeeklyAnalysisDue(new Date("2026-07-19T20:59:00Z"))).toBe(false);
    expect(isWeeklyAnalysisDue(new Date("2026-07-20T21:00:00Z"))).toBe(false);
  });

  it("営業日09:00 JSTだけをdaily tracking slotにする", () => {
    expect(isDailyTrackingDue(calendar, new Date("2026-07-21T00:00:00Z"))).toBe(true);
    expect(isDailyTrackingDue(calendar, new Date("2026-07-20T00:00:00Z"))).toBe(false);
    expect(isDailyTrackingDue(calendar, new Date("2026-07-21T00:01:00Z"))).toBe(false);
  });

  it("UTC境界を跨いでもJST日付で同日判定する", () => {
    expect(isSameJstDate("2026-07-20T15:30:00Z", "2026-07-21")).toBe(true);
  });
});
