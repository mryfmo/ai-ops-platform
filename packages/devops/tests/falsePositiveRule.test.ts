import { describe, it, expect } from "vitest";
import { evaluateTh006FalsePositiveCandidate, evaluateConfirmationWindow } from "../src/lib/falsePositiveRule.js";

describe("evaluateTh006FalsePositiveCandidate [TH-006, AC-017a]", () => {
  it("3回以上の誤検知履歴＋閾値110%未満で候補化される", () => {
    expect(
      evaluateTh006FalsePositiveCandidate({
        falsePositiveClosuresLast30Days: 3,
        currentMetricValue: 105,
        alertThreshold: 100,
      }),
    ).toBe(true);
  });
  it("誤検知履歴が2回では候補化されない", () => {
    expect(
      evaluateTh006FalsePositiveCandidate({
        falsePositiveClosuresLast30Days: 2,
        currentMetricValue: 105,
        alertThreshold: 100,
      }),
    ).toBe(false);
  });
  it("メトリクス値が110%以上なら候補化されない", () => {
    expect(
      evaluateTh006FalsePositiveCandidate({
        falsePositiveClosuresLast30Days: 5,
        currentMetricValue: 111,
        alertThreshold: 100,
      }),
    ).toBe(false);
  });
  it("110%ちょうどは候補化されない（未満のみ許容、境界値）", () => {
    expect(
      evaluateTh006FalsePositiveCandidate({
        falsePositiveClosuresLast30Days: 5,
        currentMetricValue: 110,
        alertThreshold: 100,
      }),
    ).toBe(false);
  });
});

describe("evaluateConfirmationWindow [AC-017b: 人間確認なしで自動クローズされない]", () => {
  const flaggedAt = "2026-07-01T00:00:00Z";

  it("23時間経過はまだ確認待ち", () => {
    const now = new Date(Date.parse(flaggedAt) + 23 * 60 * 60 * 1000);
    expect(evaluateConfirmationWindow({ candidateFlaggedAt: flaggedAt, now, humanConfirmedClose: false })).toBe(
      "awaiting_confirmation",
    );
  });
  it("24時間経過しても人間確認がなければオープンのまま維持（自動クローズしない）", () => {
    const now = new Date(Date.parse(flaggedAt) + 24 * 60 * 60 * 1000);
    expect(evaluateConfirmationWindow({ candidateFlaggedAt: flaggedAt, now, humanConfirmedClose: false })).toBe(
      "expired_remains_open",
    );
  });
  it("人間が確認すればclosed_by_human", () => {
    const now = new Date(Date.parse(flaggedAt) + 1 * 60 * 60 * 1000);
    expect(evaluateConfirmationWindow({ candidateFlaggedAt: flaggedAt, now, humanConfirmedClose: true })).toBe(
      "closed_by_human",
    );
  });
});
