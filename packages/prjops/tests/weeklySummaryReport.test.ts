import { describe, it, expect } from "vitest";
import {
  checkNoExternalReferences,
  checkNoPlaceholders,
  verifyNumericConsistency,
} from "@aiops/shared/html/htmlSanitizeCheck.js";
import { renderWeeklySummaryReportBody } from "../src/templates/index.js";

describe("renderWeeklySummaryReportBody [REQ-040, SPEC-INT-067, AC-040-1]", () => {
  const html = renderWeeklySummaryReportBody({
    evidenceIds: ["REQ-040", "SPEC-INT-067"],
    periodLabel: "2026-W28",
    metrics: { completedItems: 8, blockedItems: 2 },
    slots: {
      conclusion: "今週は主要マイルストーンを維持しています。",
      riskSummary: "外部レビュー待ちが残っています。",
      nextActions: "レビュー待ちを解消します。",
    },
  });

  it("AC-040-1: 根拠ID・コード算出値・文章スロットを同じ本文に出す", () => {
    expect(html).toContain("根拠ID: REQ-040, SPEC-INT-067");
    expect(html).toContain("コード算出値");
    expect(html).toContain("今週は主要マイルストーンを維持しています。");
  });

  it("AC-040-1: 数値はdata-srcで検証でき、外部参照やプレースホルダを含まない", () => {
    expect(checkNoPlaceholders(html).ok).toBe(true);
    expect(checkNoExternalReferences(html).ok).toBe(true);
    const result = verifyNumericConsistency(html, (path, field) => {
      if (path === "weekly-summary" && field === "completedItems") return "8";
      if (path === "weekly-summary" && field === "blockedItems") return "2";
      return undefined;
    });
    expect(result.ok).toBe(true);
  });
});
