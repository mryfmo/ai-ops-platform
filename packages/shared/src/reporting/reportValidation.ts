/**
 * packages/shared/src/reporting/reportValidation.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 */
import {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function countChars(value: string): number {
  return Array.from(value).length;
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
  return { ok: errors.length === 0, errors };
}

export function validateStandardReportPayload(payload: unknown): ReportValidationResult {
  const errors: string[] = [];
  if (!isRecord(payload)) return { ok: false, errors: ["payload must be an object"] };

  if (payload.schemaVersion !== STANDARD_REPORT_SCHEMA_VERSION) {
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
    if (typeof payload.period.label !== "string" || payload.period.label.trim().length === 0) {
      errors.push("period.label must be a non-empty string");
    }
    if (typeof payload.period.generatedAt !== "string" || payload.period.generatedAt.trim().length === 0) {
      errors.push("period.generatedAt must be a non-empty string");
    }
  }

  if (!isRecord(payload.metrics) || Object.values(payload.metrics).some((value) => typeof value !== "number")) {
    errors.push("metrics must be an object of numbers");
  }

  const slotResult = validateSlots(payload.slots);
  errors.push(...slotResult.errors);

  return { ok: errors.length === 0, errors };
}

export function assertValidStandardReportPayload(payload: unknown): asserts payload is StandardReportPayload {
  const result = validateStandardReportPayload(payload);
  if (!result.ok) throw new Error(`E-RPT02: invalid standard report: ${result.errors.join("; ")}`);
}

function truncateText(value: string, maxChars: number): string {
  const chars = Array.from(value);
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
