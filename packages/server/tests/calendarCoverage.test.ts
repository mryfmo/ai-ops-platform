/**
 * packages/server/tests/calendarCoverage.test.ts
 *
 * 根拠: ADR-0005 / PrjOps:SPEC-INT-054 / ADV-OPS-010。祝日データ期限の検知境界を検証する。
 */
import { describe, expect, it } from "vitest";
import { updateCalendarCoverageMetric } from "../src/index.js";
import { CALENDAR_COVERAGE_WARNING_DAYS, evaluateCalendarCoverage } from "../src/lib/calendarCoverage.js";
import { MetricsRegistry } from "../src/observability/metrics.js";

const entry = (date: string) => ({ date, name_ja: "祝日", verified: true });

describe("祝日カレンダーcoverage [PrjOps:SPEC-INT-054]", () => {
  it.each([
    ["閾値ちょうど", "2026-01-01T00:00:00+09:00", 180, false],
    ["閾値の1日前", "2026-01-02T00:00:00+09:00", 179, true],
    ["閾値の1日後", "2025-12-31T00:00:00+09:00", 181, false],
    ["期限超過", "2026-07-02T00:00:00+09:00", -2, true],
  ])("%sを判定する [PrjOps:SPEC-INT-054]", (_case, now, remainingDays, shouldWarn) => {
    const result = evaluateCalendarCoverage([entry("2026-01-01"), entry("2026-06-30")], new Date(now));

    expect(result).toEqual({ lastDate: "2026-06-30", remainingDays, shouldWarn, invalidDates: [] });
  });

  it("データ空を警告対象にする [PrjOps:SPEC-INT-054]", () => {
    expect(evaluateCalendarCoverage([], new Date("2026-01-01T00:00:00+09:00"))).toEqual({
      lastDate: null,
      remainingDays: null,
      shouldWarn: true,
      invalidDates: [],
    });
  });

  it.each(["foo", "2027-99-99"])("不正な日付 %s をfail-closedにする [PrjOps:SPEC-INT-054]", (date) => {
    expect(evaluateCalendarCoverage([entry(date)], new Date("2026-01-01T00:00:00+09:00"))).toEqual({
      lastDate: null,
      remainingDays: null,
      shouldWarn: true,
      invalidDates: [date],
    });
  });

  it("有効日と不正日が混在しても警告し、不正値を公開する [PrjOps:SPEC-INT-054]", () => {
    expect(
      evaluateCalendarCoverage(
        [entry("2027-11-23"), entry("foo"), entry("2027-99-99")],
        new Date("2026-01-01T00:00:00+09:00"),
      ),
    ).toEqual({
      lastDate: "2027-11-23",
      remainingDays: 691,
      shouldWarn: true,
      invalidDates: ["foo", "2027-99-99"],
    });
  });

  it("残日数をPrometheus gaugeへ出す [ADR-0005 / PrjOps:SPEC-INT-054]", () => {
    const metrics = new MetricsRegistry();

    metrics.setCalendarCoverageDays(CALENDAR_COVERAGE_WARNING_DAYS);

    expect(metrics.renderPrometheus()).toContain(`aiops_calendar_coverage_days ${CALENDAR_COVERAGE_WARNING_DAYS}`);

    metrics.setCalendarCoverageDays(null);
    expect(metrics.renderPrometheus()).toContain("aiops_calendar_coverage_days -1");
  });

  it("定期refresh時のnowで残日数gaugeを更新する [ADR-0005 / PrjOps:SPEC-INT-054]", () => {
    const metrics = new MetricsRegistry();
    const entries = [entry("2026-06-30")];

    updateCalendarCoverageMetric(metrics, entries, new Date("2026-01-01T00:00:00+09:00"));
    expect(metrics.renderPrometheus()).toContain("aiops_calendar_coverage_days 180");

    updateCalendarCoverageMetric(metrics, entries, new Date("2026-01-02T00:00:00+09:00"));
    expect(metrics.renderPrometheus()).toContain("aiops_calendar_coverage_days 179");
  });

  it("不正日が混在するgaugeをfail-closed値にする [ADR-0005 / PrjOps:SPEC-INT-054]", () => {
    const metrics = new MetricsRegistry();

    updateCalendarCoverageMetric(metrics, [entry("2027-11-23"), entry("foo")], new Date("2026-01-01T00:00:00+09:00"));

    expect(metrics.renderPrometheus()).toContain("aiops_calendar_coverage_days -1");
  });
});
