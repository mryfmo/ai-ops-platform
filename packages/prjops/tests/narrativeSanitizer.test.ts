import { describe, it, expect } from "vitest";
import { checkNarrativeHasNoNumbers, stripSentencesWithNumbers } from "../src/lib/narrativeSanitizer.js";

describe("checkNarrativeHasNoNumbers [SPEC-INT-031]", () => {
  it("数値を含まない文章はok", () => {
    expect(checkNarrativeHasNoNumbers("全体は概ね順調に推移しています。").ok).toBe(true);
  });
  it("数値を含む文章はNG", () => {
    const r = checkNarrativeHasNoNumbers("進捗率は62%に達しました。");
    expect(r.ok).toBe(false);
    expect(r.suspiciousNumbers).toContain("62%");
  });
  it("小数も検出する", () => {
    expect(checkNarrativeHasNoNumbers("平均3.5件のリスクが報告された").ok).toBe(false);
  });
});

describe("stripSentencesWithNumbers [安全側フォールバック]", () => {
  it("数値を含む文だけを除去する（日本語）", () => {
    const text = "全体は順調です。進捗率は62%です。追加対応が必要です。";
    const result = stripSentencesWithNumbers(text, "ja");
    expect(result).not.toContain("62%");
    expect(result).toContain("全体は順調です。");
    expect(result).toContain("追加対応が必要です。");
  });
  it("数値を含む文だけを除去する（英語）", () => {
    const text = "Overall progress is good. Progress is at 62%. Further action is needed.";
    const result = stripSentencesWithNumbers(text, "en");
    expect(result).not.toContain("62%");
    expect(result).toContain("Overall progress is good.");
  });
  it("全て数値なしなら元のまま維持される", () => {
    const text = "順調です。";
    expect(stripSentencesWithNumbers(text, "ja")).toBe("順調です。");
  });
});
