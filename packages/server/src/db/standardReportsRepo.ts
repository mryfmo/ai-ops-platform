/**
 * packages/server/src/db/standardReportsRepo.ts
 *
 * 根拠: ADR-0014 / REQ-042 / SPEC-INT-069 / AC-042-1。
 * CIで生成された標準 report.json を検証後に永続化し、再送を冪等に扱う。
 */
import { createHash } from "node:crypto";
import type { PgQueryable, StandardReportPayload } from "@aiops/shared";

export interface StandardReportRecord {
  reportId: string;
  payload: StandardReportPayload;
  reportType: StandardReportPayload["reportType"];
  periodLabel: string;
  generatedAt: string;
  receivedAt: string;
}

export function standardReportId(payload: StandardReportPayload): string {
  const stable = JSON.stringify(payload);
  return `STD-${createHash("sha256").update(stable).digest("hex").slice(0, 16)}`;
}

function toRecord(row: Record<string, unknown>): StandardReportRecord {
  const payload = row.payload as StandardReportPayload;
  return {
    reportId: String(row.report_id),
    payload,
    reportType: payload.reportType,
    periodLabel: payload.period.label,
    generatedAt: payload.period.generatedAt,
    receivedAt: row.received_at instanceof Date ? row.received_at.toISOString() : String(row.received_at),
  };
}

export class StandardReportsRepo {
  constructor(private readonly db: PgQueryable) {}

  async insert(payload: StandardReportPayload, traceId: string): Promise<{ reportId: string; created: boolean }> {
    const reportId = standardReportId(payload);
    const res = await this.db.query(
      `INSERT INTO standard_reports (
         report_id, schema_version, report_type, period_label, generated_at, payload, trace_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (report_id) DO NOTHING`,
      [
        reportId,
        payload.schemaVersion,
        payload.reportType,
        payload.period.label,
        payload.period.generatedAt,
        JSON.stringify(payload),
        traceId,
      ],
    );
    return { reportId, created: (res.rowCount ?? 0) > 0 };
  }

  async listRecent(limit = 20): Promise<StandardReportRecord[]> {
    const res = await this.db.query(
      `SELECT report_id, payload, received_at
       FROM standard_reports
       ORDER BY received_at DESC
       LIMIT $1`,
      [limit],
    );
    return res.rows.map(toRecord);
  }
}
