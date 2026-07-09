/**
 * packages/server/src/db/reportDeliveryLogRepo.ts
 *
 * 根拠: ADR-0014 / SPEC-INT-069。既存 idempotentDelivery のDeliveryLogStoreをPostgreSQLへ結線する。
 */
import type { DeliveryLogEntry, DeliveryLogStore } from "@aiops/prjops";
import type { PgQueryable } from "@aiops/shared";

export class ReportDeliveryLogRepo implements DeliveryLogStore {
  constructor(private readonly db: PgQueryable) {}

  async exists(reportId: string, recipientId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM report_delivery_log
       WHERE report_id = $1 AND recipient_id = $2 AND status = 'sent'
       LIMIT 1`,
      [reportId, recipientId],
    );
    return res.rows.length > 0;
  }

  async status(reportId: string, recipientId: string): Promise<"pending" | "sent" | null> {
    const res = await this.db.query(
      `SELECT status FROM report_delivery_log
       WHERE report_id = $1 AND recipient_id = $2
       LIMIT 1`,
      [reportId, recipientId],
    );
    const status = res.rows[0]?.status;
    return status === "pending" || status === "sent" ? status : null;
  }

  async record(entry: DeliveryLogEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO report_delivery_log (report_id, recipient_id, delivered_at, status)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (report_id, recipient_id) DO UPDATE
       SET delivered_at = EXCLUDED.delivered_at,
           status = EXCLUDED.status
       WHERE report_delivery_log.status <> 'sent' OR EXCLUDED.status = 'sent'`,
      [entry.reportId, entry.recipientId, entry.deliveredAt, entry.status ?? "sent"],
    );
  }

  async markSent(reportId: string, recipientId: string, deliveredAt: string): Promise<void> {
    await this.db.query(
      `INSERT INTO report_delivery_log (report_id, recipient_id, delivered_at, status)
       VALUES ($1,$2,$3,'sent')
       ON CONFLICT (report_id, recipient_id) DO UPDATE
       SET delivered_at = EXCLUDED.delivered_at,
           status = 'sent'`,
      [reportId, recipientId, deliveredAt],
    );
  }
}
