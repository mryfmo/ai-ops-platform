/**
 * packages/server/src/scheduler/tasks/reportDeliveryMetricsTask.ts
 *
 * 根拠: ADR-0016 / AUD-OPS-002。Azureの2日alert query上限を超えるrolling ratiosをアプリで発行する。
 */
import type { MetricsRegistry } from "../../observability/metrics.js";
import type { ScheduledTask } from "../scheduler.js";
import type { ReportDeliveryFailureRatios } from "../../db/reportDeliveryMetricsRepo.js";

export interface ReportDeliveryMetricsProvider {
  failureRatios(now: Date): Promise<ReportDeliveryFailureRatios>;
}

export function createReportDeliveryMetricsTask(deps: {
  provider: ReportDeliveryMetricsProvider;
  metrics: Pick<MetricsRegistry, "setReportDeliveryFailureRatios">;
}): ScheduledTask {
  return {
    name: "report-delivery-metrics-refresh-60s",
    // Azure alertの1分評価に合わせる。各tickはatで7日に限定され、retention/at partition pruningが効くread-only集計だけを行う。
    intervalMs: 60_000,
    async run(now): Promise<void> {
      try {
        deps.metrics.setReportDeliveryFailureRatios(await deps.provider.failureRatios(now));
      } catch (error) {
        // 前回値を残すとDB障害中もfresh sampleとして再公開されるため、alert対象外のno-dataへ即時無効化する。
        deps.metrics.setReportDeliveryFailureRatios({ sevenDay: null, threeDay: null });
        throw error;
      }
    },
  };
}
