import { describe, it, expect } from "vitest";
import {
  evaluateCondition5xxMovingAverage,
  evaluateConditionLatencySustained,
  evaluateTh003Rollback,
  selectRollbackTarget,
} from "../src/lib/deployMonitor.js";

describe("evaluateCondition5xxMovingAverage [TH-003(a): 5分移動平均5%超]", () => {
  it("5xx率が常に低ければfalse", () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({
      atSecondsFromDeploy: i * 30,
      http5xxRatePct: 1,
      p95LatencyMs: 100,
    }));
    expect(evaluateCondition5xxMovingAverage(samples)).toBe(false);
  });
  it("5分移動平均が5%を超えればtrue", () => {
    const samples = [
      { atSecondsFromDeploy: 0, http5xxRatePct: 10, p95LatencyMs: 100 },
      { atSecondsFromDeploy: 60, http5xxRatePct: 10, p95LatencyMs: 100 },
      { atSecondsFromDeploy: 120, http5xxRatePct: 10, p95LatencyMs: 100 },
    ];
    expect(evaluateCondition5xxMovingAverage(samples)).toBe(true);
  });
  it("複数サンプルの単純平均が5%を超えた場合にtrue（各点は超えていなくても平均で超える）", () => {
    const samples = [
      { atSecondsFromDeploy: 0, http5xxRatePct: 4, p95LatencyMs: 100 },
      { atSecondsFromDeploy: 60, http5xxRatePct: 4, p95LatencyMs: 100 },
      { atSecondsFromDeploy: 120, http5xxRatePct: 10, p95LatencyMs: 100 }, // (4+4+10)/3=6 > 5
    ];
    expect(evaluateCondition5xxMovingAverage(samples)).toBe(true);
  });
});

describe("evaluateConditionLatencySustained [TH-003(b): 200%超が10分継続]", () => {
  const baseline = 100;
  it("一時的なスパイク（10分未満）はfalse", () => {
    const samples = [
      { atSecondsFromDeploy: 0, http5xxRatePct: 0, p95LatencyMs: 300 },
      { atSecondsFromDeploy: 300, http5xxRatePct: 0, p95LatencyMs: 300 },
      { atSecondsFromDeploy: 330, http5xxRatePct: 0, p95LatencyMs: 50 },
    ];
    expect(evaluateConditionLatencySustained(samples, baseline)).toBe(false);
  });
  it("200%超が10分(600秒)以上継続すればtrue", () => {
    const samples = [
      { atSecondsFromDeploy: 0, http5xxRatePct: 0, p95LatencyMs: 300 },
      { atSecondsFromDeploy: 300, http5xxRatePct: 0, p95LatencyMs: 300 },
      { atSecondsFromDeploy: 600, http5xxRatePct: 0, p95LatencyMs: 300 },
    ];
    expect(evaluateConditionLatencySustained(samples, baseline)).toBe(true);
  });
  it("途中で回復すると連続カウントがリセットされる", () => {
    const samples = [
      { atSecondsFromDeploy: 0, http5xxRatePct: 0, p95LatencyMs: 300 },
      { atSecondsFromDeploy: 300, http5xxRatePct: 0, p95LatencyMs: 50 },
      { atSecondsFromDeploy: 330, http5xxRatePct: 0, p95LatencyMs: 300 },
      { atSecondsFromDeploy: 600, http5xxRatePct: 0, p95LatencyMs: 300 },
    ];
    expect(evaluateConditionLatencySustained(samples, baseline)).toBe(false);
  });
});

describe("evaluateTh003Rollback [AC-012a]", () => {
  it("両条件とも非該当ならロールバックしない", () => {
    const samples = [{ atSecondsFromDeploy: 0, http5xxRatePct: 1, p95LatencyMs: 100 }];
    const r = evaluateTh003Rollback({ samples, baselineP95Ms: 100 });
    expect(r.shouldRollback).toBe(false);
  });
  it("条件(a)のみ該当", () => {
    const samples = [
      { atSecondsFromDeploy: 0, http5xxRatePct: 10, p95LatencyMs: 100 },
      { atSecondsFromDeploy: 60, http5xxRatePct: 10, p95LatencyMs: 100 },
    ];
    const r = evaluateTh003Rollback({ samples, baselineP95Ms: 100 });
    expect(r.shouldRollback).toBe(true);
    expect(r.matchedConditions).toEqual(["a"]);
  });
  it("条件(b)のみ該当", () => {
    const samples = [
      { atSecondsFromDeploy: 0, http5xxRatePct: 0, p95LatencyMs: 300 },
      { atSecondsFromDeploy: 600, http5xxRatePct: 0, p95LatencyMs: 300 },
    ];
    const r = evaluateTh003Rollback({ samples, baselineP95Ms: 100 });
    expect(r.matchedConditions).toEqual(["b"]);
  });
});

describe("selectRollbackTarget [AC-012c: 直前に15分以上安定稼働したバージョン]", () => {
  it("15分未満の候補は除外される", () => {
    const target = selectRollbackTarget([
      { version: "v1", stableSince: "2026-07-01T00:00:00Z", stableDurationMinutesAsOfFailure: 10 },
    ]);
    expect(target).toBe(null);
  });
  it("複数の適格候補から最も新しいものを選ぶ", () => {
    const target = selectRollbackTarget([
      { version: "v1", stableSince: "2026-07-01T00:00:00Z", stableDurationMinutesAsOfFailure: 100 },
      { version: "v2", stableSince: "2026-07-02T00:00:00Z", stableDurationMinutesAsOfFailure: 20 },
    ]);
    expect(target?.version).toBe("v2");
  });
});
