/**
 * packages/shared/src/reporting/reportPrompt.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 */
import { STANDARD_REPORT_SLOT_SPECS } from "./reportSchema.js";
import type { StandardReportType } from "./reportSchema.js";

export interface WeeklySummaryPromptInput {
  evidenceIds: string[];
  periodLabel: string;
  metrics: Record<string, number>;
  reportType?: StandardReportType;
}

export function buildWeeklySummaryPrompt(input: WeeklySummaryPromptInput): string {
  const slotRules = STANDARD_REPORT_SLOT_SPECS.map(
    (slot) => `- ${slot.key}: ${slot.title}。${slot.maxChars}文字以内。数値を新しく作らない。`,
  ).join("\n");
  const metricLines = Object.entries(input.metrics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  return [
    "AI Ops標準報告の文章スロットだけを生成する。",
    "数値・構造はコード算出済みのため、入力された数値だけを参照する。",
    `根拠ID: ${input.evidenceIds.join(", ")}`,
    `対象期間: ${input.periodLabel}`,
    "",
    "数値:",
    metricLines,
    "",
    "出力スロット:",
    slotRules,
  ].join("\n");
}
