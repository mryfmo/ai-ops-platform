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
      `SELECT 1 FROM report_delivery_log WHERE report_id = $1 AND recipient_id = $2 LIMIT 1`,
      [reportId, recipientId],
    );
    return res.rows.length > 0;
  }

  async record(entry: DeliveryLogEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO report_delivery_log (report_id, recipient_id, delivered_at)
       VALUES ($1,$2,$3)
       ON CONFLICT (report_id, recipient_id) DO NOTHING`,
      [entry.reportId, entry.recipientId, entry.deliveredAt],
    );
  }
}
