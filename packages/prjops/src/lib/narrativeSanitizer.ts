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

const NUMBER_PATTERN = /\d+(\.\d+)?%?/g;

export interface NarrativeCheckResult {
  ok: boolean;
  suspiciousNumbers: string[];
}

/** LLM生成テキストに数値らしき文字列が含まれていないかを検査する（SPEC-INT-031設計原則の機械的強制） */
export function checkNarrativeHasNoNumbers(text: string): NarrativeCheckResult {
  const matches = text.match(NUMBER_PATTERN) ?? [];
  return { ok: matches.length === 0, suspiciousNumbers: matches };
}

/**
 * 数値混入が検出された場合、その文だけを除外する（安全側フォールバック）。
 * レポート生成が完全に停止することを避けつつ、数値の捏造混入は防ぐ。
 */
export function stripSentencesWithNumbers(text: string, lang: "ja" | "en" = "ja"): string {
  const sentenceSeparator = lang === "ja" ? /(?<=[。！？])/ : /(?<=[.!?])\s+/;
  const sentences = text.split(sentenceSeparator).filter((s) => s.trim().length > 0);
  return sentences.filter((s) => checkNarrativeHasNoNumbers(s).ok).join(lang === "ja" ? "" : " ");
}
