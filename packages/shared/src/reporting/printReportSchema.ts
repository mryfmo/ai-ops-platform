/**
 * packages/shared/src/reporting/printReportSchema.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 */
import { STANDARD_REPORT_JSON_SCHEMA } from "./reportSchema.js";

console.log(JSON.stringify(STANDARD_REPORT_JSON_SCHEMA, null, 2));
