/**
 * packages/shared/src/reporting/calculateReportMetrics.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 * CI標準報告の数値はLLMではなくコードで生成する。
 */
function envNumber(name: string): number {
  const value = Number(process.env[name] ?? 0);
  if (!Number.isFinite(value)) throw new Error(`E-RPT04: ${name} must be a finite number`);
  return value;
}

const metrics = {
  completed: envNumber("REPORT_COMPLETED"),
  blocked: envNumber("REPORT_BLOCKED"),
};

console.log(JSON.stringify(metrics, null, 2));
