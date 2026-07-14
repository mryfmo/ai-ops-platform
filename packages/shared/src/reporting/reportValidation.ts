/**
 * packages/shared/src/reporting/reportValidation.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 */
import {
  LEGACY_STANDARD_REPORT_SCHEMA_VERSION,
  REPORT_METRIC_UNAVAILABLE_REASONS,
  STANDARD_REPORT_SCHEMA_VERSION,
  standardReportSlotKeys,
  standardReportSlotMaxChars,
  type StandardReportPayload,
  type StandardReportSlotKey,
  type StandardReportSlots,
} from "./reportSchema.js";

export interface ReportValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ReportSlotNumericFinding {
  slot: StandardReportSlotKey;
  value: string;
}

const NUMBER_PATTERN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|\d+(?:\.\d+)?%?/g;
const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const REPORT_KEYS = ["schemaVersion", "reportType", "evidenceIds", "period", "metrics", "slots"];
const PERIOD_KEYS = ["label", "generatedAt"];
const MEASURED_METRIC_KEYS = ["value", "source", "as_of"];
const UNAVAILABLE_METRIC_KEYS = ["value", "unavailable_reason", "source", "as_of"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function countChars(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    return Array.from(segmenter.segment(value)).length;
  }
  return Array.from(value.normalize("NFC")).length;
}

function splitChars(value: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (part) => part.segment);
  }
  return Array.from(value.normalize("NFC"));
}

function validateSlots(slots: unknown): ReportValidationResult {
  const errors: string[] = [];
  if (!isRecord(slots)) return { ok: false, errors: ["slots must be an object"] };

  for (const key of standardReportSlotKeys()) {
    const value = slots[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`slots.${key} must be a non-empty string`);
      continue;
    }
    const maxChars = standardReportSlotMaxChars(key);
    if (countChars(value) > maxChars) {
      errors.push(`slots.${key} exceeds ${maxChars} chars`);
    }
  }

  for (const key of Object.keys(slots)) {
    if (!standardReportSlotKeys().includes(key as StandardReportSlotKey)) {
      errors.push(`slots.${key} is not allowed`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function metricNumberStrings(metrics: Record<string, unknown>): Set<string> {
  const values = new Set<string>();
  for (const value of Object.values(metrics)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const numberValue = Number(value);
    values.add(String(numberValue));
    if (Number.isInteger(numberValue)) values.add(String(Math.trunc(numberValue)));
  }
  return values;
}

function normalizeNumberText(value: string): string {
  return (value.endsWith("%") ? value.slice(0, -1) : value).replaceAll(",", "");
}

function extractNumberTexts(text: string): string[] {
  return text.match(NUMBER_PATTERN) ?? [];
}

function stripLiteralText(value: string, literals: Iterable<string>): string {
  let stripped = value;
  for (const literal of literals) {
    if (literal.length === 0) continue;
    stripped = stripped.replaceAll(literal, "");
  }
  return stripped;
}

export function findUngroundedSlotNumbers(
  slots: StandardReportSlots,
  metrics: Record<string, number>,
  ignoredLiterals: Iterable<string> = [],
): ReportSlotNumericFinding[] {
  const allowed = metricNumberStrings(metrics);
  const findings: ReportSlotNumericFinding[] = [];
  for (const key of standardReportSlotKeys()) {
    const matches = extractNumberTexts(stripLiteralText(slots[key], ignoredLiterals));
    for (const raw of matches) {
      const normalized = normalizeNumberText(raw);
      if (!allowed.has(normalized)) findings.push({ slot: key, value: raw });
    }
  }
  return findings;
}

export function parseReportSlots(raw: unknown): StandardReportSlots {
  const result = validateSlotsShapeOnly(raw);
  if (!result.ok) throw new Error(`E-RPT01: invalid report slots: ${result.errors.join("; ")}`);
  return raw as StandardReportSlots;
}

function validateSlotsShapeOnly(slots: unknown): ReportValidationResult {
  const errors: string[] = [];
  if (!isRecord(slots)) return { ok: false, errors: ["slots must be an object"] };

  for (const key of standardReportSlotKeys()) {
    if (typeof slots[key] !== "string" || String(slots[key]).trim().length === 0) {
      errors.push(`slots.${key} must be a non-empty string`);
    }
  }
  for (const key of Object.keys(slots)) {
    if (!standardReportSlotKeys().includes(key as StandardReportSlotKey)) errors.push(`slots.${key} is not allowed`);
  }
  return { ok: errors.length === 0, errors };
}

function validateAllowedKeys(value: Record<string, unknown>, allowed: string[], path: string, errors: string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}${key} is not allowed`);
  }
}

export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE_TIME_PATTERN.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] =
    match.slice(1);
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHourText ?? "0",
    offsetMinuteText ?? "0",
  ].map(Number);
  const calendarDate = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month! - 1 &&
    calendarDate.getUTCDate() === day &&
    hour! <= 23 &&
    minute! <= 59 &&
    second! <= 59 &&
    offsetHour! <= 23 &&
    offsetMinute! <= 59
  );
}

function validateMetric(name: string, metric: unknown): string[] {
  const path = `metrics.${name}`;
  if (!isRecord(metric)) return [`${path} must be a measured or unavailable metric object`];
  const errors: string[] = [];
  const unavailable = metric.value === null;
  validateAllowedKeys(metric, unavailable ? UNAVAILABLE_METRIC_KEYS : MEASURED_METRIC_KEYS, `${path}.`, errors);
  if (!unavailable && (typeof metric.value !== "number" || !Number.isFinite(metric.value))) {
    errors.push(`${path}.value must be a finite number or null`);
  }
  if (unavailable && !REPORT_METRIC_UNAVAILABLE_REASONS.includes(metric.unavailable_reason as never)) {
    errors.push(`${path}.unavailable_reason must be ${REPORT_METRIC_UNAVAILABLE_REASONS.join(", ")}`);
  }
  if (
    typeof metric.source !== "string" ||
    metric.source.trim().length === 0 ||
    metric.source !== metric.source.trim()
  ) {
    errors.push(`${path}.source must be a non-empty stable source id`);
  }
  if (!isIsoDateTime(metric.as_of)) errors.push(`${path}.as_of must be an ISO-8601 date-time with timezone`);
  return errors;
}

function measuredMetricValues(metrics: Record<string, unknown>): Record<string, number> {
  const values: Record<string, number> = {};
  for (const [key, metric] of Object.entries(metrics)) {
    if (isRecord(metric) && typeof metric.value === "number" && Number.isFinite(metric.value))
      values[key] = metric.value;
  }
  return values;
}

export function validateStandardReportPayload(payload: unknown): ReportValidationResult {
  const errors: string[] = [];
  if (!isRecord(payload)) return { ok: false, errors: ["payload must be an object"] };

  validateAllowedKeys(payload, REPORT_KEYS, "", errors);
  if (payload.schemaVersion === LEGACY_STANDARD_REPORT_SCHEMA_VERSION) {
    errors.push("legacy standard-report.v1 numeric metrics are unsupported; regenerate as standard-report.v2");
  } else if (payload.schemaVersion !== STANDARD_REPORT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${STANDARD_REPORT_SCHEMA_VERSION}`);
  }
  if (
    payload.reportType !== "weekly-summary" &&
    payload.reportType !== "manager-weekly" &&
    payload.reportType !== "investor-quarterly"
  ) {
    errors.push("reportType must be weekly-summary, manager-weekly, or investor-quarterly");
  }
  if (
    !Array.isArray(payload.evidenceIds) ||
    payload.evidenceIds.length === 0 ||
    payload.evidenceIds.some((id) => typeof id !== "string" || id.trim().length === 0)
  ) {
    errors.push("evidenceIds must contain at least one non-empty string");
  }

  if (!isRecord(payload.period)) {
    errors.push("period must be an object");
  } else {
    validateAllowedKeys(payload.period, PERIOD_KEYS, "period.", errors);
    if (typeof payload.period.label !== "string" || payload.period.label.trim().length === 0) {
      errors.push("period.label must be a non-empty string");
    }
    if (!isIsoDateTime(payload.period.generatedAt))
      errors.push("period.generatedAt must be an ISO-8601 date-time with timezone");
  }

  if (!isRecord(payload.metrics)) {
    errors.push("metrics must be an object of measured or unavailable metrics");
  } else {
    for (const [name, metric] of Object.entries(payload.metrics)) {
      if (name.trim().length === 0) errors.push("metric name must be non-empty");
      if (typeof metric === "number") {
        errors.push(`metrics.${name} uses a legacy numeric metric; source and as_of evidence are required`);
      } else {
        errors.push(...validateMetric(name, metric));
      }
    }
  }

  const slotResult = validateSlots(payload.slots);
  errors.push(...slotResult.errors);
  if (isRecord(payload.metrics) && validateSlotsShapeOnly(payload.slots).ok) {
    const ignoredLiterals =
      isRecord(payload.period) && typeof payload.period.label === "string" ? [payload.period.label] : [];
    const findings = findUngroundedSlotNumbers(
      payload.slots as StandardReportSlots,
      measuredMetricValues(payload.metrics),
      ignoredLiterals,
    );
    for (const finding of findings) {
      errors.push(`slots.${finding.slot} contains ungrounded numeric value ${finding.value}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidStandardReportPayload(payload: unknown): asserts payload is StandardReportPayload {
  const result = validateStandardReportPayload(payload);
  if (!result.ok) throw new Error(`E-RPT02: invalid standard report: ${result.errors.join("; ")}`);
}

function truncateText(value: string, maxChars: number): string {
  const chars = splitChars(value);
  if (chars.length <= maxChars) return value;
  if (maxChars <= 1) return chars.slice(0, maxChars).join("");
  return `${chars.slice(0, maxChars - 1).join("")}…`;
}

export function truncateReportSlots(slots: StandardReportSlots): {
  slots: StandardReportSlots;
  truncatedKeys: string[];
} {
  const next = { ...slots };
  const truncatedKeys: string[] = [];
  for (const key of standardReportSlotKeys()) {
    const maxChars = standardReportSlotMaxChars(key);
    if (countChars(next[key]) > maxChars) {
      next[key] = truncateText(next[key], maxChars);
      truncatedKeys.push(key);
    }
  }
  return { slots: next, truncatedKeys };
}

export function renderEvidenceHeader(evidenceIds: string[]): string {
  if (evidenceIds.length === 0) throw new Error("E-RPT03: evidenceIds header is required");
  return `根拠ID: ${evidenceIds.join(", ")}`;
}
