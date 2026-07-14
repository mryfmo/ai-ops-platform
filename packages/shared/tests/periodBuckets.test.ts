import { describe, expect, it } from "vitest";
import {
  aggregateTimeseries,
  buildPeriodBuckets,
  compareWeeklyMetric,
  resolvePeriodRange,
  type WeeklyMetricObservation,
} from "../src/index.js";

describe("periodBuckets (ADR-0007 / REQ-036 / SPEC-INT-062 / REQ-031 / SPEC-INT-081)", () => {
  it("AC-036-1: ISO週をJSTの月曜開始で切る", () => {
    const range = resolvePeriodRange("week", "2026-07-09T12:00:00+09:00");
    expect(range).toEqual({
      start: "2026-07-06T00:00:00+09:00",
      end: "2026-07-13T00:00:00+09:00",
      label: "2026-W28",
    });
    expect(buildPeriodBuckets("week", "2026-07-09").map((b) => b.id)).toHaveLength(7);
  });

  it("AC-031a: quarter/half/yearは月次bucketへ展開する", () => {
    expect(resolvePeriodRange("quarter", "2026-07-09").label).toBe("2026-Q3");
    expect(buildPeriodBuckets("quarter", "2026-07-09").map((b) => b.id)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(resolvePeriodRange("half", "2026-12-31").label).toBe("2026-H2");
    expect(buildPeriodBuckets("year", "2026-07-09")).toHaveLength(12);
  });

  it("不正baseDateは無音集計せず明示エラーにする", () => {
    expect(() => resolvePeriodRange("week", "")).toThrow(/invalid date/i);
    expect(() => aggregateTimeseries({ period: "week", baseDate: "2026-13-45", events: [], snapshots: [] })).toThrow(
      /invalid date/i,
    );
  });

  it("SPEC-INT-062: pm_events/pm_snapshotsから決定的に集計する", () => {
    const result = aggregateTimeseries({
      period: "week",
      baseDate: "2026-07-09",
      events: [
        { occurredAt: "2026-07-06T10:00:00+09:00", kind: "issue", action: "opened" },
        { occurredAt: "2026-07-07T10:00:00+09:00", kind: "pull_request", action: "closed", state: "merged" },
        { occurredAt: "2026-07-08T10:00:00+09:00", kind: "projects_v2_item", fromStatus: "Todo", toStatus: "Done" },
        { occurredAt: "2026-07-09T10:00:00+09:00", kind: "deployment", action: "created" },
      ],
      snapshots: [
        { capturedAt: "2026-07-06T23:00:00+09:00", sourceType: "issue", state: "open" },
        { capturedAt: "2026-07-07T23:00:00+09:00", sourceType: "issue", state: "closed" },
      ],
    });
    expect(result.totals).toMatchObject({ opened: 2, closed: 1, statusTransitions: 1, deployments: 1 });
    expect(result.buckets.find((b) => b.bucket.id === "2026-07-06")?.burndownRemaining).toBe(1);
  });

  it("SPEC-INT-062: nullのfrom/to statusは遷移として数えない", () => {
    const result = aggregateTimeseries({
      period: "week",
      baseDate: "2026-07-09",
      events: [
        {
          occurredAt: "2026-07-08T10:00:00+09:00",
          kind: "projects_v2_item",
          fromStatus: null,
          toStatus: null,
        },
      ],
      snapshots: [],
    });
    expect(result.totals.statusTransitions).toBe(0);
  });
});

describe("compareWeeklyMetric [DevOps:REQ-031 / DevOps:SPEC-INT-081 / DevOps:AC-031a]", () => {
  const selector = { projectId: "PJ-0001", scope: "manager", key: "deploy_frequency", source: "github" };
  const observation = (value: number, observedAt: string, overrides: Partial<WeeklyMetricObservation> = {}) => ({
    ...selector,
    value,
    observedAt,
    ...overrides,
  });

  it("JST月曜のhalf-open週でlast valid finite値を選び、両週がある場合だけdeltaを算出する", () => {
    const result = compareWeeklyMetric({
      baseDate: "2026-07-09",
      selector,
      observations: [
        observation(8, "2026-07-05T23:59:59+09:00"),
        observation(10, "2026-07-12T20:00:00+09:00"),
        observation(Number.NaN, "2026-07-12T21:00:00+09:00"),
        observation(88, "2026-07-12T22:00:00+09:00", { projectId: "PJ-9999" }),
        observation(77, "2026-07-12T22:00:00+09:00", { key: "other_metric" }),
        observation(99, "2026-07-13T00:00:00+09:00"),
      ],
    });

    expect(result.current).toMatchObject({ value: 10, as_of: "2026-07-12T20:00:00+09:00" });
    expect(result.previous).toMatchObject({ value: 8, as_of: "2026-07-05T23:59:59+09:00" });
    expect(result.delta_vs_previous_week).toMatchObject({ value: 2, source: "github" });
  });

  it("JSTはDSTの影響を受けず常に月曜00:00 +09:00で区切る", () => {
    const result = compareWeeklyMetric({ baseDate: "2026-03-09", selector, observations: [] });
    expect(result.period).toEqual({
      current: { start: "2026-03-09T00:00:00+09:00", end: "2026-03-16T00:00:00+09:00" },
      previous: { start: "2026-03-02T00:00:00+09:00", end: "2026-03-09T00:00:00+09:00" },
    });
  });

  it("missing current/previousを0にせず区別する", () => {
    expect(compareWeeklyMetric({ baseDate: "2026-07-09", selector, observations: [] }).current).toMatchObject({
      value: null,
      unavailable_reason: "missing_current",
    });
    expect(
      compareWeeklyMetric({
        baseDate: "2026-07-09",
        selector,
        observations: [observation(10, "2026-07-12T20:00:00+09:00")],
      }).delta_vs_previous_week,
    ).toMatchObject({ value: null, unavailable_reason: "missing_previous" });
  });

  it("各週を[start,end)で独立評価し、隣接週の値を持ち越さない", () => {
    const previousOnly = compareWeeklyMetric({
      baseDate: "2026-07-09",
      selector,
      observations: [observation(8, "2026-07-05T23:59:59+09:00")],
    });
    expect(previousOnly.previous).toMatchObject({ value: 8 });
    expect(previousOnly.current).toMatchObject({ value: null, unavailable_reason: "missing_current" });
    expect(previousOnly.delta_vs_previous_week).toMatchObject({
      value: null,
      unavailable_reason: "missing_current",
    });

    const currentOnly = compareWeeklyMetric({
      baseDate: "2026-07-09",
      selector,
      observations: [observation(10, "2026-07-06T00:00:00+09:00")],
    });
    expect(currentOnly.current).toMatchObject({ value: 10 });
    expect(currentOnly.previous).toMatchObject({ value: null, unavailable_reason: "missing_previous" });
    expect(currentOnly.delta_vs_previous_week).toMatchObject({
      value: null,
      unavailable_reason: "missing_previous",
    });

    const bothWeeks = compareWeeklyMetric({
      baseDate: "2026-07-09",
      selector,
      observations: [observation(8, "2026-07-05T23:59:59+09:00"), observation(10, "2026-07-06T00:00:00+09:00")],
    });
    expect(bothWeeks.delta_vs_previous_week).toMatchObject({ value: 2 });
  });

  it("有限値同士の差分がoverflowした場合はsource_errorへfail closedする", () => {
    const result = compareWeeklyMetric({
      baseDate: "2026-07-09",
      selector,
      observations: [
        observation(-Number.MAX_VALUE, "2026-07-05T23:59:59+09:00"),
        observation(Number.MAX_VALUE, "2026-07-06T00:00:00+09:00"),
      ],
    });
    expect(result.current).toMatchObject({ value: Number.MAX_VALUE });
    expect(result.previous).toMatchObject({ value: -Number.MAX_VALUE });
    expect(result.delta_vs_previous_week).toMatchObject({ value: null, unavailable_reason: "source_error" });
  });

  it("同一週・同一period位置の複数snapshotはasOfが最新の有限値を選ぶ", () => {
    const result = compareWeeklyMetric({
      baseDate: "2026-07-09",
      selector,
      observations: [
        observation(8, "2026-06-29T00:00:00+09:00", { asOf: "2026-07-05T20:00:00+09:00" }),
        observation(10, "2026-07-06T00:00:00+09:00", { asOf: "2026-07-10T20:00:00+09:00" }),
        observation(12, "2026-07-06T00:00:00+09:00", { asOf: "2026-07-12T20:00:00+09:00" }),
      ],
    });
    expect(result.current).toMatchObject({ value: 12, as_of: "2026-07-12T20:00:00+09:00" });
    expect(result.delta_vs_previous_week).toMatchObject({ value: 4 });
  });

  it("同一period_start/asOfの最上位snapshotが競合したら入力順に依存せずsource_errorにする", () => {
    const conflicting = [
      observation(10, "2026-07-06T00:00:00+09:00", { asOf: "2026-07-12T20:00:00+09:00" }),
      observation(12, "2026-07-05T15:00:00Z", { asOf: "2026-07-12T11:00:00Z" }),
    ];
    for (const observations of [conflicting, [...conflicting].reverse()]) {
      expect(compareWeeklyMetric({ baseDate: "2026-07-09", selector, observations }).current).toMatchObject({
        value: null,
        unavailable_reason: "source_error",
      });
    }
  });

  it("scope mismatch、source error、全件non-finiteを明示する", () => {
    expect(
      compareWeeklyMetric({
        baseDate: "2026-07-09",
        selector,
        observations: [observation(10, "2026-07-12T20:00:00+09:00", { scope: "foreign" })],
      }).current,
    ).toMatchObject({ value: null, unavailable_reason: "scope_mismatch" });
    expect(
      compareWeeklyMetric({ baseDate: "2026-07-09", selector, observations: [], sourceError: true }).current,
    ).toMatchObject({ value: null, unavailable_reason: "source_error" });
    expect(
      compareWeeklyMetric({
        baseDate: "2026-07-09",
        selector,
        observations: [observation(Number.POSITIVE_INFINITY, "2026-07-12T20:00:00+09:00")],
      }).current,
    ).toMatchObject({ value: null, unavailable_reason: "source_error" });
  });
});
