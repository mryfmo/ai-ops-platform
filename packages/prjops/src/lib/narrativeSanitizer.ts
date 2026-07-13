/**
 * packages/prjops/src/lib/narrativeSanitizer.ts
 *
 * 根拠: SPEC-INT-031 レポート生成（AGT-04）
 *   「数値・色・表はすべてコードで算出しテンプレートへ埋め込む。LLMは『結論3行』『トピック要約』等の
 *    文章スロットのみ生成し、数値を含む文はLLM出力から採用しない（数値はコード算出値をプレースホルダで
 *    埋める）→ AGT-07の数値一致検証を成立させるための設計判断。」
 *
 * 本モジュールはLLMが生成した文章スロットに数値らしき文字列（コード算出値ではないもの）が
 * 混入していないかを機械的に検査する、決定的なガードである。
 */

const NUMBER_PATTERN = /\p{N}+(?:[.．]\p{N}+)?[%％]?/gu;
// 数量と同じ漢字を含む通常語だけを後続文脈で限定し、それ以外の漢数字はfail-closedで拒否する。
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

/** LLM生成テキストに数値らしき文字列が含まれていないかを検査する（SPEC-INT-031設計原則の機械的強制） */
export function checkNarrativeHasNoNumbers(text: string): NarrativeCheckResult {
  const masked = maskSafeCjkLexemes(text);
  const normalized = maskSafeCjkLexemes(text.normalize("NFKC"));
  const matches = [
    ...new Set([
      ...(masked.match(NUMBER_PATTERN) ?? []),
      ...(masked.match(CJK_NUMBER_PATTERN) ?? []),
      ...(normalized.match(NUMBER_PATTERN) ?? []),
      ...(normalized.match(CJK_NUMBER_PATTERN) ?? []),
    ]),
  ];
  return { ok: matches.length === 0, suspiciousNumbers: matches };
}

/**
 * 数値混入が検出された場合、その文だけを除外する（安全側フォールバック）。
 * レポート生成が完全に停止することを避けつつ、数値の捏造混入は防ぐ。
 */
export function stripSentencesWithNumbers(text: string, lang: "ja" | "en" = "ja"): string {
  const sentenceSeparator = lang === "ja" ? /(?<=[。！？])/ : /(?<=[.!?])\s+/;
  const sentences = text.split(sentenceSeparator).filter((s) => s.trim().length > 0);
  return sentences
    .filter((s) => checkNarrativeHasNoNumbers(s).ok)
    .map((s) => s.normalize("NFKC"))
    .join(lang === "ja" ? "" : " ");
}

/** 数値文を除去し、文章が残らない場合はコード定義の安全な固定文へ置換する。 */
export function sanitizeNarrativeWithFallback(text: string, lang: "ja" | "en", fallback: string): string {
  if (!checkNarrativeHasNoNumbers(fallback).ok) {
    throw new Error("E-NAR01: narrative fallback must not contain numbers");
  }
  const sanitized = stripSentencesWithNumbers(text, lang);
  return sanitized.trim().length > 0 ? sanitized : fallback.normalize("NFKC");
}
