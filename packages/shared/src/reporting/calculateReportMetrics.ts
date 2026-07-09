/**
 * packages/shared/src/reporting/calculateReportMetrics.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 * CI標準報告の数値はLLMではなくコードで生成する。
 */
const metrics = {
  completed: Number(process.env["REPORT_COMPLETED"] ?? 0),
  blocked: Number(process.env["REPORT_BLOCKED"] ?? 0),
};

console.log(JSON.stringify(metrics, null, 2));
