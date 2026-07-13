/**
 * packages/server/src/db/pgAuditLog.ts
 *
 * 根拠:
 *   - DevOps SPEC-INT-056 / REQ-028: audit_logテーブルは追記専用（INSERT/SELECTのみ。
 *     UPDATE/DELETE権限はアプリロールに付与しない。schema.sqlのREVOKEコメント参照）。
 *   - ADR-0005: 常駐サーバの監査ログはPostgreSQL実装を正本とする。
 *
 * 設計: shared の AuditLogWriter インターフェースに準拠（append/readAllのみ）。
 *   理由必須検証（validateReasonRequirement）とシークレット混入検査（E-AUD02）は
 *   InMemoryAuditLog / JsonlAuditLog と同一のガードを適用する。
 */
import { sanitizeSecrets, validateReasonRequirement, type AuditLogWriter, type AuditRecord } from "@aiops/shared";
import type { PgQueryable } from "@aiops/shared";

export type AuditRetentionClass = "prjops_5y" | "devops_1y";

export class PgAuditLog implements AuditLogWriter {
  constructor(
    private readonly db: PgQueryable,
    private readonly retentionClass: AuditRetentionClass,
  ) {
    if (retentionClass !== "prjops_5y" && retentionClass !== "devops_1y") {
      throw new Error(`invalid audit retention class: ${String(retentionClass)}`);
    }
  }

  async append(record: Omit<AuditRecord, "log_id">): Promise<AuditRecord> {
    validateReasonRequirement(record.action, record.reason);
    const detailStr = JSON.stringify(record.detail);
    const { redactionCount } = sanitizeSecrets(detailStr);
    if (redactionCount > 0) {
      throw new Error(
        `E-AUD02: refusing to write audit record containing ${redactionCount} secret-like pattern(s). Sanitize before writing (REQ-032/SPEC-INT-070).`,
      );
    }
    const res = await this.db.query(
      "INSERT INTO audit_log (retention_class, trace_id, actor, action, basis, detail, at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING log_id",
      [this.retentionClass, record.trace_id, record.actor, record.action, record.basis, detailStr, record.at],
    );
    return { ...record, log_id: Number(res.rows[0]?.log_id) };
  }

  async readAll(): Promise<AuditRecord[]> {
    const res = await this.db.query(
      "SELECT log_id, trace_id, actor, action, basis, detail, at FROM audit_log ORDER BY log_id",
    );
    return res.rows.map((r) => ({
      log_id: Number(r.log_id),
      trace_id: String(r.trace_id),
      actor: String(r.actor),
      action: String(r.action),
      basis: String(r.basis),
      detail: typeof r.detail === "string" ? JSON.parse(r.detail) : r.detail,
      at: String(r.at),
    }));
  }
}
