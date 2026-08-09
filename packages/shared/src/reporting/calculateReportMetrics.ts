/**
 * packages/shared/src/reporting/calculateReportMetrics.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 * CI標準報告の数値はLLMではなくコードで生成する。
 */
import type { ReportMetricScope, StandardReportMetric } from "./reportSchema.js";
import { isIsoDateTime } from "./reportValidation.js";
import { isValidId } from "../ids.js";

function envMetric(name: string, asOf: string, scope: ReportMetricScope): StandardReportMetric {
  const raw = process.env[name];
  const source = `env:${name}`;
  if (raw === undefined || raw.trim().length === 0) {
    return { value: null, unavailable_reason: "missing_current", source, as_of: asOf, scope };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`E-RPT04: ${name} must be a finite number`);
  return { value, source, as_of: asOf, scope };
}

const asOf = process.env["REPORT_AS_OF"] ?? new Date().toISOString();
if (!isIsoDateTime(asOf)) throw new Error("E-RPT06: REPORT_AS_OF must be an ISO-8601 date-time with timezone");
const projectIds = (process.env["REPORT_PROJECT_IDS"] ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
if (
  projectIds.length === 0 ||
  new Set(projectIds).size !== projectIds.length ||
  projectIds.some((id) => !isValidId("project", id) && !isValidId("projectDevOps", id))
) {
  throw new Error("E-RPT07: REPORT_PROJECT_IDS must contain unique canonical project IDs");
}
projectIds.sort();
const scope = { kind: "portfolio", projectIds } as const;

const metrics = {
  completed: envMetric("REPORT_COMPLETED", asOf, scope),
  blocked: envMetric("REPORT_BLOCKED", asOf, scope),
};

console.log(JSON.stringify(metrics, null, 2));
