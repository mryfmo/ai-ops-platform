/**
 * packages/prjops/src/templates/weeklySummaryReport.ts
 *
 * 根拠:
 *   - REQ-040 / SPEC-INT-067 / AC-040-1: 標準報告は共通スキーマに従い、数値はコード算出値を注入し、
 *     LLMは文章スロットのみを担当する。
 */
import { renderEvidenceHeader, type StandardReportSlots, type WeeklySummaryPromptInput } from "@aiops/shared";
import { escapeHtml, numericSpan } from "./reportShell.js";

export interface WeeklySummaryReportData extends WeeklySummaryPromptInput {
  slots: StandardReportSlots;
}

function metricRow(key: string, value: number): string {
  return `<tr><td>${escapeHtml(key)}</td><td>${numericSpan("weekly-summary", key, value)}</td></tr>`;
}

export function renderWeeklySummaryReportBody(data: WeeklySummaryReportData): string {
  const metricRows = Object.entries(data.metrics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => metricRow(key, value))
    .join("\n");

  return `
<section>
  <h2>標準週次サマリー</h2>
  <p>${escapeHtml(renderEvidenceHeader(data.evidenceIds))}</p>
  <p>対象期間: ${escapeHtml(data.periodLabel)}</p>
</section>
<section>
  <h2>コード算出値</h2>
  <table><tbody>${metricRows}</tbody></table>
</section>
<section>
  <h2>結論</h2>
  <p>${escapeHtml(data.slots.conclusion)}</p>
  <h2>リスク要約</h2>
  <p>${escapeHtml(data.slots.riskSummary)}</p>
  <h2>次アクション</h2>
  <p>${escapeHtml(data.slots.nextActions)}</p>
</section>`;
}
