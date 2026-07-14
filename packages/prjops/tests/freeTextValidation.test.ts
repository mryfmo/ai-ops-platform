import { describe, it, expect } from "vitest";
import {
  checkCompleteness,
  formatClarificationMessage,
  decideClarificationAction,
  normalizeSelfStatus,
} from "../src/lib/freeTextValidation.js";

describe("checkCompleteness [REQ-005 AC-005-1, PrjOps:SPEC-INT-030手順3]", () => {
  const complete = {
    progress_pct: 62,
    self_status: "yellow" as const,
    achievements: "設計完了",
    plans: "実装着手",
    issues: "なし",
    risks: "なし",
  };

  it("6項目すべて揃っていればcomplete", () => {
    expect(checkCompleteness(complete).complete).toBe(true);
  });

  it("進捗率が範囲外ならmissing扱い", () => {
    const r = checkCompleteness({ ...complete, progress_pct: 150 });
    expect(r.missingFields).toContain("progress_pct");
  });

  it("進捗率が小数ならmissing扱い（整数のみ許容）", () => {
    const r = checkCompleteness({ ...complete, progress_pct: 62.5 });
    expect(r.missingFields).toContain("progress_pct");
  });

  it("自己申告ステータスが未設定ならmissing", () => {
    const r = checkCompleteness({ ...complete, self_status: null });
    expect(r.missingFields).toContain("self_status");
  });

  it("課題・リスクは「なし」なら欠落として扱わない", () => {
    const r = checkCompleteness({ ...complete, issues: "なし", risks: "なし" });
    expect(r.missingFields).not.toContain("issues");
    expect(r.missingFields).not.toContain("risks");
  });

  it("課題が空文字なら欠落として扱う", () => {
    const r = checkCompleteness({ ...complete, issues: "" });
    expect(r.missingFields).toContain("issues");
  });

  it("複数項目欠落を同時に検出する", () => {
    const r = checkCompleteness({
      progress_pct: null,
      self_status: null,
      achievements: null,
      plans: "x",
      issues: "なし",
      risks: "なし",
    });
    expect(r.missingFields).toEqual(["progress_pct", "self_status", "achievements"]);
  });
});

describe("formatClarificationMessage [PrjOps:SPEC-EXT-012]", () => {
  it("「不足: ②ステータス, ⑥リスク」形式で出力する", () => {
    const msg = formatClarificationMessage(["self_status", "risks"]);
    expect(msg).toBe("不足: ②ステータス, ⑥リスク");
  });
  it("欠落順序に関わらずFIELD_ORDER順で整形される", () => {
    const msg = formatClarificationMessage(["risks", "progress_pct"]);
    expect(msg).toBe("不足: ①進捗率, ⑥リスク");
  });
});

describe("decideClarificationAction [AC-005-2]", () => {
  it("完全ならaccept", () => {
    const r = decideClarificationAction({ complete: true, missingFields: [] }, { clarifyCount: 0 });
    expect(r.action).toBe("accept");
  });
  it("不完全かつ聞き返し回数が3未満ならclarify", () => {
    const r = decideClarificationAction({ complete: false, missingFields: ["issues"] }, { clarifyCount: 2 });
    expect(r.action).toBe("clarify");
  });
  it("聞き返し3回でも不足ならescalate_incomplete", () => {
    const r = decideClarificationAction({ complete: false, missingFields: ["issues"] }, { clarifyCount: 3 });
    expect(r.action).toBe("escalate_incomplete");
  });
});

describe("normalizeSelfStatus [PrjOps:SPEC-EXT-011 表記ゆれ吸収]", () => {
  it("日本語表記を正規化する", () => {
    expect(normalizeSelfStatus("順調")).toBe("green");
    expect(normalizeSelfStatus("注意")).toBe("yellow");
    expect(normalizeSelfStatus("危険")).toBe("red");
  });
  it("英語表記(大文字小文字問わず)を正規化する", () => {
    expect(normalizeSelfStatus("Green")).toBe("green");
    expect(normalizeSelfStatus("RED")).toBe("red");
  });
  it("不明な表記はnull", () => {
    expect(normalizeSelfStatus("まあまあ")).toBe(null);
    expect(normalizeSelfStatus("unknown")).toBe(null);
  });
});
