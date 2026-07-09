/**
 * packages/server/tests/schedulerPolicy.test.ts
 *
 * 根拠: ADR-0005（常駐ループのドリフト補正・多重実行ガード）
 */
import { describe, it, expect } from "vitest";
import { decideTick, nextCheckDelayMs, type TickState } from "../src/lib/schedulerPolicy.js";

describe("decideTick (ADR-0005)", () => {
  it("予定時刻前は実行しない", () => {
    const state: TickState = { nextDueAtMs: 10_000, running: false };
    const d = decideTick(state, 9_999, 30_000);
    expect(d.shouldRun).toBe(false);
    expect(d.skipReason).toBe("not_due");
    expect(d.nextDueAtMs).toBe(10_000);
  });

  it("予定時刻到達で実行し、次回予定をinterval分進める", () => {
    const state: TickState = { nextDueAtMs: 10_000, running: false };
    const d = decideTick(state, 10_000, 30_000);
    expect(d.shouldRun).toBe(true);
    expect(d.nextDueAtMs).toBe(40_000);
  });

  it("遅延がintervalを超えた場合、次回予定は現在より未来の最小倍数へ（バースト実行しない）", () => {
    const state: TickState = { nextDueAtMs: 10_000, running: false };
    // 100秒遅延（interval=30秒 → 3周期分スキップ）
    const d = decideTick(state, 110_000, 30_000);
    expect(d.shouldRun).toBe(true);
    expect(d.nextDueAtMs).toBe(130_000); // 10k + 4*30k
    expect(d.nextDueAtMs).toBeGreaterThan(110_000);
  });

  it("前回実行中はスキップする（多重実行ガード）", () => {
    const state: TickState = { nextDueAtMs: 10_000, running: true };
    const d = decideTick(state, 15_000, 30_000);
    expect(d.shouldRun).toBe(false);
    expect(d.skipReason).toBe("previous_still_running");
  });
});

describe("nextCheckDelayMs (ADR-0005)", () => {
  it("残り時間が1秒超なら1秒（ポーリング粒度上限）", () => {
    expect(nextCheckDelayMs(100_000, 10_000)).toBe(1000);
  });
  it("残り時間が1秒未満ならその値", () => {
    expect(nextCheckDelayMs(10_500, 10_000)).toBe(500);
  });
  it("超過していれば最小値10ms", () => {
    expect(nextCheckDelayMs(10_000, 20_000)).toBe(10);
  });
});
