/**
 * packages/shared/src/xlsxImport/template.ts
 *
 * 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。
 * Excelインポート対象は Issue / Project v2 item / Milestone のみ。PRは対象外。
 */
import ExcelJS from "exceljs";

export type ImportTargetKind = "issue" | "project_item" | "milestone";
export type SheetName = "issues" | "project_items" | "milestones";

export const XLSX_IMPORT_METADATA_SHEET = "_metadata";
export const XLSX_IMPORT_TEMPLATE_VERSION = "1";

export interface ColumnDefinition {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "date" | "csv";
  example: string;
}

export const IMPORT_MARKER_PREFIX = "<!-- import:";

export const XLSX_IMPORT_TEMPLATE: Record<SheetName, ColumnDefinition[]> = {
  issues: [
    { key: "source_key", label: "source_key", required: true, type: "string", example: "ISS-001" },
    { key: "title", label: "title", required: true, type: "string", example: "初期課題" },
    { key: "body", label: "body", required: false, type: "string", example: "課題本文" },
    { key: "labels", label: "labels", required: false, type: "csv", example: "bug,triage" },
    { key: "milestone", label: "milestone", required: false, type: "string", example: "v1" },
  ],
  project_items: [
    { key: "source_key", label: "source_key", required: true, type: "string", example: "PVI-001" },
    { key: "project_node_id", label: "project_node_id", required: true, type: "string", example: "PVT_kw..." },
    { key: "content_node_id", label: "content_node_id", required: true, type: "string", example: "I_kw..." },
    { key: "field_node_id", label: "field_node_id", required: true, type: "string", example: "PVTSSF_l..." },
    { key: "field_type", label: "field_type", required: true, type: "string", example: "text" },
    { key: "value", label: "value", required: true, type: "string", example: "Ready" },
  ],
  milestones: [
    { key: "source_key", label: "source_key", required: true, type: "string", example: "MS-001" },
    { key: "title", label: "title", required: true, type: "string", example: "v1" },
    { key: "due_on", label: "due_on", required: false, type: "date", example: "2026-08-31" },
    { key: "description", label: "description", required: false, type: "string", example: "初回リリース" },
  ],
};

export function importMarker(sourceKey: string): string {
  return `${IMPORT_MARKER_PREFIX}${sourceKey} -->`;
}

export function appendImportMarker(body: string, sourceKey: string): string {
  const marker = importMarker(sourceKey);
  return body.includes(marker) ? body : `${body.trim()}\n\n${marker}`.trim();
}

export async function buildXlsxImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ai-ops-platform";
  workbook.created = new Date("2026-07-09T00:00:00.000Z");

  const metadata = workbook.addWorksheet(XLSX_IMPORT_METADATA_SHEET);
  metadata.addRow(["template_version", XLSX_IMPORT_TEMPLATE_VERSION]);
  metadata.getCell("A1").font = { bold: true };
  metadata.columns = [{ width: 24 }, { width: 16 }];

  for (const [sheetName, columns] of Object.entries(XLSX_IMPORT_TEMPLATE) as Array<[SheetName, ColumnDefinition[]]>) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns.map((column) => ({ header: column.label, key: column.key, width: 24 }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRow(Object.fromEntries(columns.map((column) => [column.key, column.example])));
    for (const [index, column] of columns.entries()) {
      const cell = sheet.getCell(1, index + 1);
      cell.note = `${column.required ? "required" : "optional"} ${column.type}`;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
