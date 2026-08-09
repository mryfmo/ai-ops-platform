/** 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / PrjOps:SPEC-EXT-011/012 */
import { describe, expect, it } from "vitest";
import {
  checkCompleteness,
  decideClarificationAction,
  formatClarificationMessage,
  normalizeSelfStatus,
  resolveStatusReportProjectId,
} from "../src/reporting/statusIngestContract.js";

const complete = {
  progress_pct: 62,
  self_status: "yellow" as const,
  achievements: "設計完了",
  plans: "実装着手",
  issues: "なし",
  risks: "なし",
};

describe("status ingest pure contract awaiting A054 [PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030]", () => {
  it("必須6項目を決定的に検証する", () => {
    expect(checkCompleteness(complete)).toEqual({ complete: true, missingFields: [] });
    expect(checkCompleteness({ ...complete, progress_pct: 62.5, achievements: " ", risks: null })).toEqual({
      complete: false,
      missingFields: ["progress_pct", "achievements", "risks"],
    });
  });

  it("聞き返しは3回未満、3回到達後はescalate_incompleteにする", () => {
    const incomplete = checkCompleteness({ ...complete, issues: "" });
    expect(decideClarificationAction(incomplete, { clarifyCount: 2 })).toEqual({ action: "clarify" });
    expect(decideClarificationAction(incomplete, { clarifyCount: 3 })).toEqual({ action: "escalate_incomplete" });
    expect(formatClarificationMessage(["risks", "self_status"])).toBe("不足: ②ステータス, ⑥リスク");
  });

  it("自己申告statusの日本語・英語表記を正規化する", () => {
    expect(normalizeSelfStatus("順調")).toBe("green");
    expect(normalizeSelfStatus("Yellow")).toBe("yellow");
    expect(normalizeSelfStatus("不明")).toBeNull();
  });

  it("project idは件名→本文→sender hintの優先順で解決する", () => {
    expect(resolveStatusReportProjectId({ subject: "PJ-101", body: "PJ-202", projectIdHintFromSender: "PJ-303" })).toBe(
      "PJ-101",
    );
    expect(resolveStatusReportProjectId({ body: "対象 PJ-202", projectIdHintFromSender: "PJ-303" })).toBe("PJ-202");
    expect(resolveStatusReportProjectId({ body: "IDなし", projectIdHintFromSender: "PJ-303" })).toBe("PJ-303");
    expect(resolveStatusReportProjectId({ body: "IDなし" })).toBeNull();
  });
});
