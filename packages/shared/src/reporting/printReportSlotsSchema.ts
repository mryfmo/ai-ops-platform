/**
 * packages/shared/src/reporting/printReportSlotsSchema.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 * CI報告生成ではLLMに文章slotsだけを生成させ、metricsはコード算出値を注入する。
 */
import { createReportSlotsToolSchema } from "./reportSchema.js";

console.log(JSON.stringify(createReportSlotsToolSchema(), null, 2));
