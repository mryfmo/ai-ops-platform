import { describe, it, expect } from "vitest";
import {
  evaluateEscalationTrigger,
  shouldAutoApplyProposal,
  formatSeverityForDisplay,
} from "../src/lib/severityProposal.js";

describe("evaluateEscalationTrigger [REQ-008]", () => {
  it("コスト言及＋複数企業影響で提案対象になる", () => {
    const r = evaluateEscalationTrigger({
      currentSeverity: "medium",
      impactDescription: "追加コストが発生し、A社・B社双方の納品に影響する見込み",
      affectedOrganizationIds: ["ORG-001", "ORG-002"],
    });
    expect(r.shouldPropose).toBe(true);
    expect(r.affectsMultipleOrganizations).toBe(true);
  });

  it("キーワードがあっても単一企業影響なら提案しない", () => {
    const r = evaluateEscalationTrigger({
      currentSeverity: "medium",
      impactDescription: "コスト超過の見込み",
      affectedOrganizationIds: ["ORG-001"],
    });
    expect(r.shouldPropose).toBe(false);
  });

  it("複数企業影響でもキーワードがなければ提案しない", () => {
    const r = evaluateEscalationTrigger({
      currentSeverity: "medium",
      impactDescription: "軽微な表示崩れが確認された",
      affectedOrganizationIds: ["ORG-001", "ORG-002"],
    });
    expect(r.shouldPropose).toBe(false);
  });

  it("すでにhighなら再提案しない", () => {
    const r = evaluateEscalationTrigger({
      currentSeverity: "high",
      impactDescription: "納期遅延と法令違反リスクが複数社に及ぶ",
      affectedOrganizationIds: ["ORG-001", "ORG-002"],
    });
    expect(r.shouldPropose).toBe(false);
  });

  it("英語の記述でもキーワードを検出する", () => {
    const r = evaluateEscalationTrigger({
      currentSeverity: "low",
      impactDescription: "This will cause a schedule delay affecting both partner companies.",
      affectedOrganizationIds: ["ORG-010", "ORG-020"],
    });
    expect(r.shouldPropose).toBe(true);
  });
});

describe("shouldAutoApplyProposal [AC-008-2: 72時間仮適用]", () => {
  const proposal = { value: "high" as const, reason: "test", proposedAt: "2026-07-01T09:00:00+09:00" };

  it("71時間59分経過ではまだ仮適用しない", () => {
    const now = new Date(Date.parse(proposal.proposedAt) + (72 * 60 - 1) * 60 * 1000);
    expect(shouldAutoApplyProposal(proposal, now)).toBe(false);
  });

  it("ちょうど72時間経過で仮適用する", () => {
    const now = new Date(Date.parse(proposal.proposedAt) + 72 * 60 * 60 * 1000);
    expect(shouldAutoApplyProposal(proposal, now)).toBe(true);
  });

  it("72時間超過でも仮適用する", () => {
    const now = new Date(Date.parse(proposal.proposedAt) + 100 * 60 * 60 * 1000);
    expect(shouldAutoApplyProposal(proposal, now)).toBe(true);
  });
});

describe("formatSeverityForDisplay [AC-008-2: 「仮」ラベル]", () => {
  it("通常表示（日本語）", () => {
    expect(formatSeverityForDisplay("high", false, "ja")).toBe("高");
  });
  it("仮適用表示（日本語）", () => {
    expect(formatSeverityForDisplay("high", true, "ja")).toBe("高（仮）");
  });
  it("仮適用表示（英語）", () => {
    expect(formatSeverityForDisplay("high", true, "en")).toBe("High (provisional)");
  });
});
