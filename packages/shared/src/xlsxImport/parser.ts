/**
 * packages/shared/src/xlsxImport/parser.ts
 *
 * 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。
 * Excelインポート入力を検証し、GitHub APIに渡す前に既知シークレットをサニタイズする。
 */
import ExcelJS from "exceljs";
import { sanitizeSecrets } from "../secretSanitizer.js";
import { XLSX_IMPORT_TEMPLATE, type SheetName } from "./template.js";

export interface ImportValidationError {
  sheet: SheetName;
  row: number;
  column?: string;
  message: string;
}

export interface IssueImportRow {
  kind: "issue";
  sourceKey: string;
  title: string;
  body: string;
  labels: string[];
  milestone?: string;
}

export interface ProjectItemImportRow {
  kind: "project_item";
  sourceKey: string;
  projectNodeId: string;
  contentNodeId: string;
  fieldNodeId: string;
  fieldType: string;
  value: string;
}

export interface MilestoneImportRow {
  kind: "milestone";
  sourceKey: string;
  title: string;
  dueOn?: string;
  description: string;
}

export type XlsxImportRow = IssueImportRow | ProjectItemImportRow | MilestoneImportRow;

export interface ParsedXlsxImport {
  rows: XlsxImportRow[];
  errors: ImportValidationError[];
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value) return String((value as { text?: unknown }).text ?? "").trim();
  return String(value).trim();
}

function cleanText(value: unknown): string {
  return sanitizeSecrets(asText(value)).sanitized;
}

function parseCsv(value: unknown): string[] {
  return cleanText(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = asText(value);
  if (!text) return "";
  const datePart = /^(\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
  if (datePart) return datePart;
  return text;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): Record<string, unknown> {
  const header = sheet.getRow(1);
  const row = sheet.getRow(rowNumber);
  const out: Record<string, unknown> = {};
  header.eachCell((cell, colNumber) => {
    const key = cleanText(cell.value);
    if (key) out[key] = row.getCell(colNumber).value;
  });
  return out;
}

function validateHeaders(sheet: ExcelJS.Worksheet, sheetName: SheetName, errors: ImportValidationError[]): void {
  const expected = new Set(XLSX_IMPORT_TEMPLATE[sheetName].map((column) => column.key));
  sheet.getRow(1).eachCell((cell) => {
    const key = cleanText(cell.value);
    if (key && !expected.has(key)) errors.push({ sheet: sheetName, row: 1, column: key, message: "unknown column" });
  });
}

function hasAnyData(values: Record<string, unknown>): boolean {
  return Object.values(values).some((value) => asText(value).length > 0);
}

function validateRequired(
  sheetName: SheetName,
  rowNumber: number,
  values: Record<string, unknown>,
  errors: ImportValidationError[],
): void {
  for (const column of XLSX_IMPORT_TEMPLATE[sheetName]) {
    if (column.required && asText(values[column.key]).length === 0) {
      errors.push({ sheet: sheetName, row: rowNumber, column: column.key, message: "required value missing" });
    }
  }
}

function validateDateFormat(
  sheetName: SheetName,
  rowNumber: number,
  values: Record<string, unknown>,
  errors: ImportValidationError[],
): void {
  if (sheetName !== "milestones" || values.due_on instanceof Date || asText(values.due_on).length === 0) return;
  if (!/^\d{4}-\d{2}-\d{2}/.test(asText(values.due_on))) {
    errors.push({ sheet: sheetName, row: rowNumber, column: "due_on", message: "invalid date format" });
  }
}

function toImportRow(sheetName: SheetName, values: Record<string, unknown>): XlsxImportRow {
  if (sheetName === "issues") {
    return {
      kind: "issue",
      sourceKey: cleanText(values.source_key),
      title: cleanText(values.title),
      body: cleanText(values.body),
      labels: parseCsv(values.labels),
      milestone: cleanText(values.milestone) || undefined,
    };
  }
  if (sheetName === "project_items") {
    return {
      kind: "project_item",
      sourceKey: cleanText(values.source_key),
      projectNodeId: cleanText(values.project_node_id),
      contentNodeId: cleanText(values.content_node_id),
      fieldNodeId: cleanText(values.field_node_id),
      fieldType: cleanText(values.field_type),
      value: cleanText(values.value),
    };
  }
  return {
    kind: "milestone",
    sourceKey: cleanText(values.source_key),
    title: cleanText(values.title),
    dueOn: normalizeDate(values.due_on) || undefined,
    description: cleanText(values.description),
  };
}

export async function parseXlsxImport(buffer: Buffer): Promise<ParsedXlsxImport> {
  const workbook = new ExcelJS.Workbook();
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as Parameters<
    typeof workbook.xlsx.load
  >[0];
  await workbook.xlsx.load(data);
  const errors: ImportValidationError[] = [];
  const rows: XlsxImportRow[] = [];
  const seenSourceKeys = new Map<string, { sheet: SheetName; row: number }>();

  for (const sheetName of Object.keys(XLSX_IMPORT_TEMPLATE) as SheetName[]) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      errors.push({ sheet: sheetName, row: 1, message: "sheet missing" });
      continue;
    }
    validateHeaders(sheet, sheetName, errors);
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const values = rowValues(sheet, rowNumber);
      if (!hasAnyData(values)) continue;
      validateRequired(sheetName, rowNumber, values, errors);
      validateDateFormat(sheetName, rowNumber, values, errors);
      const sourceKey = cleanText(values.source_key);
      if (sourceKey) {
        const previous = seenSourceKeys.get(sourceKey);
        if (previous) {
          errors.push({
            sheet: sheetName,
            row: rowNumber,
            column: "source_key",
            message: `duplicate source_key also used at ${previous.sheet}:${previous.row}`,
          });
        } else {
          seenSourceKeys.set(sourceKey, { sheet: sheetName, row: rowNumber });
        }
      }
      rows.push(toImportRow(sheetName, values));
    }
  }

  const validRows = errors.length === 0 ? rows : [];
  return { rows: validRows, errors };
}
