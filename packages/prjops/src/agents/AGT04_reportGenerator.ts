/**
 * packages/prjops/src/agents/AGT04_reportGenerator.ts
 *
 * 根拠: REQ-010〜016 プロファイル別レポート生成 / SPEC-INT-031
 *   数値・色・表はコード算出、LLMは文章スロット（結論3行・トピック要約等）のみ生成する。
 *   LLM出力に数値が混入した場合は採用しない（narrativeSanitizer.tsで機械的に強制）。
 *
 * 本ファイルはPRF-04（経営陣）向け「結論3行」生成を例に、LLM文章生成とガードの結線パターンを示す。
 * 他プロファイルの文章スロット（PRF-03のトピック要約等）も同一パターンで実装する。
 */
import type { AnthropicStructuredClient } from "@aiops/shared/clients/anthropicClient.js";
import { checkNarrativeHasNoNumbers, stripSentencesWithNumbers } from "../lib/narrativeSanitizer.js";
import { composeExecutiveReport, type ComposeCommonOptions } from "../templates/index.js";
import type { ColorDistribution } from "../templates/svgCharts.js";

const CONCLUSION_TOOL_SCHEMA = {
  type: "object",
  properties: {
    lines: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
  },
  required: ["lines"],
} as const;

export interface ExecutiveNarrativeInput {
  colorDistribution: ColorDistribution;
  topRiskProjectSummaries: string[];
}

/**
 * PRF-04「結論3行」をLLMで生成し、数値混入を機械チェックで除去してから返す。
 */
export async function generateExecutiveConclusionLines(
  llmClient: AnthropicStructuredClient,
  input: ExecutiveNarrativeInput,
): Promise<[string, string, string]> {
  const result = await llmClient.call<{ lines: string[] }>({
    agent: "AGT-04",
    purpose: "executive_conclusion",
    system:
      "あなたはPMOの経営報告アシスタントです。与えられた材料から、経営陣向け「結論」を必ず3行、" +
      "各行40〜60文字程度の日本語で生成してください。**数値・パーセンテージ・件数は一切書かないでください**" +
      "（数値は別途コードが表示します）。個人名は書かないでください。",
    user: `Redプロジェクトの状況: ${input.topRiskProjectSummaries.join(" / ") || "特筆すべき懸念なし"}`,
    toolName: "emit_conclusion",
    toolDescription: "経営陣向け結論3行を返す",
    inputSchema: CONCLUSION_TOOL_SCHEMA,
    parse: (raw) => raw as { lines: string[] },
    maxAttempts: 2,
  });

  const cleaned = result.value.lines.map((line) => {
    const check = checkNarrativeHasNoNumbers(line);
    return check.ok ? line : stripSentencesWithNumbers(line, "ja");
  });

  while (cleaned.length < 3) cleaned.push("特筆すべき事項はありません。");

  return [cleaned[0]!, cleaned[1]!, cleaned[2]!];
}

/** PRF-04向けレポート生成の呼び出し例（結論生成 + テンプレート合成） */
export async function generateExecutiveReport(
  llmClient: AnthropicStructuredClient,
  common: ComposeCommonOptions,
  narrativeInput: ExecutiveNarrativeInput,
  topTopics: Array<{ title: string; lines: [string, string] }>,
  monthOverMonthDiffText: string,
): Promise<string> {
  const conclusionLines = await generateExecutiveConclusionLines(llmClient, narrativeInput);
  return composeExecutiveReport(common, {
    conclusionLines,
    colorDistribution: narrativeInput.colorDistribution,
    topTopics,
    monthOverMonthDiffText,
  });
}
