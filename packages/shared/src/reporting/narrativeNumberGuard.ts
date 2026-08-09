/**
 * packages/shared/src/reporting/narrativeNumberGuard.ts
 *
 * 根拠: PrjOps:REQ-010 / PrjOps:SPEC-INT-031 / DEC-SPEC-007。
 * LLM narrative の数値・Unicode 数字・漢数字を決定的に検出する pure guard。
 */

const NUMBER_PATTERN = /\p{N}{1,3}(?:[,，]\p{N}{3})+(?:[.．]\p{N}+)?[%％]?|\p{N}+(?:[.．]\p{N}+)?[%％]?/gu;
const CJK_NUMERAL_CHARS = "〇零一二三四五六七八九十百千万億兆壱壹弌弐弍貳貮参參弎肆伍陸漆捌玖拾佰仟萬亿廿卅卌皕両兩两";
const CJK_NUMBER_PATTERN = new RegExp(`[${CJK_NUMERAL_CHARS}]+`, "gu");
const SAFE_CJK_LEXEME_PATTERN = new RegExp(
  `(?<![${CJK_NUMERAL_CHARS}])(?:` +
    "一方(?=で|では|、|が|を|の)|" +
    "十分(?=な|に|かつ)|" +
    "万全(?=な|に|です|でした|である|を|の|と|、)|" +
    "万一(?=に|の|へ|、|の場合)|" +
    "八百屋(?=との|と|で|へ|を|が|に|の|です|でした|、|$)|" +
    "一時的(?=な|に|です|でした|である|と|、|$)|" +
    "一件落着(?=しました|し|後|です|でした|で|、|$)|" +
    "一人前(?=として|になる|になり)|" +
    "四日市(?=との|と|で|では|市|に|へ|から|です|でした|、)" +
    ")",
  "gu",
);

function maskSafeCjkLexemes(text: string): string {
  return text.replace(SAFE_CJK_LEXEME_PATTERN, (term) => "_".repeat(term.length));
}

export interface NarrativeCheckResult {
  ok: boolean;
  suspiciousNumbers: string[];
}

/** Live validator 用に、原文上の数値 token を重複なしで返す。 */
export function findNarrativeNumberTokens(text: string): string[] {
  const masked = maskSafeCjkLexemes(text);
  return [...new Set([...(masked.match(NUMBER_PATTERN) ?? []), ...(masked.match(CJK_NUMBER_PATTERN) ?? [])])];
}

/** NFKC 後も含め、LLM narrative に数値らしき文字列がないことを検証する。 */
export function checkNarrativeHasNoNumbers(text: string): NarrativeCheckResult {
  const original = findNarrativeNumberTokens(text);
  const normalized = findNarrativeNumberTokens(text.normalize("NFKC"));
  const suspiciousNumbers = [...new Set([...original, ...normalized])];
  return { ok: suspiciousNumbers.length === 0, suspiciousNumbers };
}

/** 数値を含む文だけを安全側で除外する。 */
export function stripSentencesWithNumbers(text: string, lang: "ja" | "en" = "ja"): string {
  const sentenceSeparator = lang === "ja" ? /(?<=[。！？])/ : /(?<=[.!?])\s+/;
  return text
    .split(sentenceSeparator)
    .filter((sentence) => sentence.trim().length > 0 && checkNarrativeHasNoNumbers(sentence).ok)
    .map((sentence) => sentence.normalize("NFKC"))
    .join(lang === "ja" ? "" : " ");
}

/** 全文が除外された場合は、数値を含まない固定文へ置換する。 */
export function sanitizeNarrativeWithFallback(text: string, lang: "ja" | "en", fallback: string): string {
  if (!checkNarrativeHasNoNumbers(fallback).ok) {
    throw new Error("E-NAR01: narrative fallback must not contain numbers");
  }
  const sanitized = stripSentencesWithNumbers(text, lang);
  return sanitized.trim().length > 0 ? sanitized : fallback.normalize("NFKC");
}
