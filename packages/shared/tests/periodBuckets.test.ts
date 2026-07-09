import { describe, expect, it } from "vitest";
import { aggregateTimeseries, buildPeriodBuckets, resolvePeriodRange } from "../src/index.js";

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
