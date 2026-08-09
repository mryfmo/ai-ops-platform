/**
 * packages/server/src/db/reportDeliveryMetricsRepo.ts
 *
 * 根拠: ADR-0016 / AUD-OPS-002。配信周期の監査記録からrolling failure ratioを集計する。
 * audit_logのappend-only契約は書き込みをUPDATE/DELETEしないためのもの。ここでのSELECTはread-onlyで契約を保つ。
 */
import type { PgQueryable } from "@aiops/shared";

export interface ReportDeliveryFailureRatios {
  sevenDay: number | null;
  threeDay: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

function failureRatio(sent: unknown, failed: unknown): number | null {
  const sentCount = Number(sent);
  const failedCount = Number(failed);
  const attempts = sentCount + failedCount;
  return attempts === 0 ? null : failedCount / attempts;
}

export class ReportDeliveryMetricsRepo {
  constructor(private readonly db: PgQueryable) {}

  async failureRatios(now: Date): Promise<ReportDeliveryFailureRatios> {
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * DAY_MS).toISOString();
    const result = await this.db.query(
      `SELECT
         COALESCE(SUM((detail->>'sent')::numeric), 0)::text AS sent_7d,
         COALESCE(SUM((detail->>'failed')::numeric), 0)::text AS failed_7d,
         COALESCE(SUM((detail->>'sent')::numeric) FILTER (WHERE at >= $2), 0)::text AS sent_3d,
         COALESCE(SUM((detail->>'failed')::numeric) FILTER (WHERE at >= $2), 0)::text AS failed_3d
       FROM audit_log
       WHERE retention_class = 'prjops_5y'
         AND action IN ('report_delivery_cycle_completed', 'report_delivery_cycle_failed')
         AND at >= $1 AND at <= $3`,
      [sevenDaysAgo, threeDaysAgo, now.toISOString()],
    );
    const row = result.rows[0] ?? {};
    return {
      sevenDay: failureRatio(row.sent_7d, row.failed_7d),
      threeDay: failureRatio(row.sent_3d, row.failed_3d),
    };
  }
}
