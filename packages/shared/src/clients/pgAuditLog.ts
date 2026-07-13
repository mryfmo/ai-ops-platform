/**
 * packages/shared/src/clients/pgAuditLog.ts
 *
 * 根拠: DevOps SPEC-INT-056 / REQ-028（PostgreSQL audit_log は追記専用）。
 */
import { sanitizeSecrets } from "../secretSanitizer.js";
import { validateReasonRequirement, type AuditLogWriter, type AuditRecord } from "../auditLog.js";
import type { PgQueryable } from "./pgCostGuard.js";

export class PgAuditLog implements AuditLogWriter {
  constructor(private readonly db: PgQueryable) {}

  async append(record: Omit<AuditRecord, "log_id">): Promise<AuditRecord> {
    validateReasonRequirement(record.action, record.reason);
    const detail = JSON.stringify(record.detail);
    const { redactionCount } = sanitizeSecrets(detail);
    if (redactionCount > 0) {
      throw new Error(
        `E-AUD02: refusing to write audit record containing ${redactionCount} secret-like pattern(s). Sanitize before writing (REQ-032/SPEC-INT-070).`,
      );
    }
    const res = await this.db.query(
      "INSERT INTO audit_log (trace_id, actor, action, basis, detail, at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING log_id",
      [record.trace_id, record.actor, record.action, record.basis, detail, record.at],
    );
    return { ...record, log_id: Number(res.rows[0]?.log_id) };
  }

  async readAll(): Promise<AuditRecord[]> {
    const res = await this.db.query(
      "SELECT log_id, trace_id, actor, action, basis, detail, at FROM audit_log ORDER BY log_id",
    );
    return res.rows.map((row) => ({
      log_id: Number(row.log_id),
      trace_id: String(row.trace_id),
      actor: String(row.actor),
      action: String(row.action),
      basis: String(row.basis),
      detail: typeof row.detail === "string" ? JSON.parse(row.detail) : row.detail,
      at: String(row.at),
    }));
  }
}
