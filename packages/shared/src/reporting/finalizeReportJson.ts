/**
 * packages/shared/src/reporting/finalizeReportJson.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 * LLM生成slotsにコード算出metricsを注入し、retry後相当の最終防衛として超過slotを切り詰める。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { buildStandardReportPayloadFromMetrics } from "./reportGenerator.js";
import {
  assertProducerMetricScopes,
  parseReportSlots,
  truncateReportSlots,
  validateStandardReportPayload,
} from "./reportValidation.js";
import type { StandardReportMetric, StandardReportType } from "./reportSchema.js";

const [slotsPath, metricsPath] = process.argv.slice(2);
if (!slotsPath || !metricsPath) {
  throw new Error("usage: finalizeReportJson <slots.json> <metrics.json>");
}

const rawSlots = parseReportSlots(JSON.parse(readFileSync(slotsPath, "utf8")));
const truncated = truncateReportSlots(rawSlots);
if (truncated.truncatedKeys.length > 0) {
  writeFileSync(
    "standard-report.audit.json",
    JSON.stringify({ action: "report_slot_truncated", truncatedKeys: truncated.truncatedKeys }, null, 2),
  );
}

const metrics = JSON.parse(readFileSync(metricsPath, "utf8")) as Record<string, StandardReportMetric>;
const payload = buildStandardReportPayloadFromMetrics(
  {
    evidenceIds: (process.env["REPORT_EVIDENCE_IDS"] ?? "REQ-040").split(",").filter(Boolean),
    periodLabel: process.env["PERIOD_LABEL"] ?? "scheduled weekly period",
    reportType: (process.env["REPORT_TYPE"] as StandardReportType | undefined) ?? "weekly-summary",
    metrics,
  },
  truncated.slots,
  process.env["REPORT_GENERATED_AT"] ?? new Date().toISOString(),
);
const validation = validateStandardReportPayload(payload);
if (!validation.ok) throw new Error(`E-RPT02: invalid finalized report: ${validation.errors.join("; ")}`);
assertProducerMetricScopes(metrics);

console.log(JSON.stringify(payload, null, 2));
