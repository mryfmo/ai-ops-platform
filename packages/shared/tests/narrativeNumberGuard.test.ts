/** 根拠: PrjOps:REQ-010 / PrjOps:SPEC-INT-031 / DEC-SPEC-007 */
import { describe, expect, it } from "vitest";
import {
  checkNarrativeHasNoNumbers,
  sanitizeNarrativeWithFallback,
  stripSentencesWithNumbers,
} from "../src/reporting/narrativeNumberGuard.js";

describe("Unicode narrative number guard [PrjOps:SPEC-INT-031 / DEC-SPEC-007]", () => {
  it.each([
    ["ASCII", "1"],
    ["fullwidth", "１"],
    ["Arabic-Indic", "١"],
    ["circled", "①"],
    ["superscript", "²"],
    ["Roman", "Ⅳ"],
    ["fraction", "½"],
    ["CJK hundred", "百"],
    ["CJK four", "四"],
    ["CJK large", "一億"],
    ["CJK zero", "零"],
    ["CJK twenty with counter", "廿件"],
    ["CJK thirty with counter", "卅件"],
    ["CJK two hundred with counter", "皕件"],
    ["CJK both companies", "両社"],
    ["CJK traditional both companies", "兩社"],
    ["CJK simplified both companies", "两社"],
    ["CJK one generic counter", "一つ"],
    ["CJK four generic counter", "四つ"],
    ["CJK four generic counter particle", "四つの"],
    ["CJK four locations", "四箇所"],
    ["CJK two weeks", "二週間"],
    ["CJK third stage", "第三段階"],
    ["CJK once", "一度"],
    ["CJK three books", "三冊"],
    ["CJK two departments", "二部署"],
    ["CJK four teams", "四チーム"],
    ["CJK one second", "一秒"],
    ["CJK months", "三ヶ月"],
    ["CJK hiragana months", "三か月"],
    ["CJK formal months", "三箇月"],
    ["CJK small katakana months", "三ヵ月"],
    ["CJK katakana months", "三ケ月"],
    ["CJK business days", "二十営業日"],
    ["CJK quarter ordinal", "第五四半期"],
    ["CJK ordinal number", "第三号"],
    ["CJK points", "二点"],
    ["CJK kinds", "三種類"],
    ["CJK comparison", "四以上"],
    ["CJK lower comparison", "五以下"],
    ["CJK exclusive comparison", "六未満"],
    ["CJK bounded comparison", "七以内"],
    ["CJK over comparison", "八超"],
    ["CJK ordinal suffix", "三番目"],
    ["CJK pages", "三ページ"],
    ["CJK sites", "三拠点"],
    ["CJK approximation", "三ほど"],
    ["CJK ambiguous minutes", "十分が経過しました"],
    ["CJK ambiguous serving", "一人前を用意します"],
    ["CJK ambiguous sufficient time", "所要時間は十分です"],
    ["CJK ambiguous serving copula", "料理は約一人前です"],
    ["CJK forty variant", "卌件"],
    ["CJK one variant", "弌件"],
    ["CJK two variant", "弍件"],
    ["CJK three variant", "弎件"],
    ["CJK formal two variant", "貮件"],
  ])("%s numberをUnicode categoryとNFKCで拒否する", (_name, number) => {
    expect(checkNarrativeHasNoNumbers(`安全な文${number}です。`).ok).toBe(false);
    expect(stripSentencesWithNumbers(`安全です。危険${number}です。`, "ja")).toBe("安全です。");
  });

  it.each([
    "一方で対応を進めます。",
    "十分な対策です。",
    "万全な体制です。",
    "万一に備えます。",
    "八百屋との調整を進めます。",
    "一時的な対応です。",
    "一件落着しました。",
    "一人前として任せます。",
    "四日市との調整を進めます。",
    "四日市と調整します。",
    "一方では対応を進めます。",
    "一人前になります。",
    "四日市で調整します。",
  ])("通常語の漢字を数値として誤検知しない: %s", (value) => {
    expect(checkNarrativeHasNoNumbers(value)).toEqual({ ok: true, suspiciousNumbers: [] });
  });

  it("fallback自体に数値があればfail closedにする", () => {
    expect(() => sanitizeNarrativeWithFallback("架空の99件です。", "ja", "固定文1です。")).toThrow("E-NAR01");
  });
});
