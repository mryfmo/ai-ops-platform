/**
 * packages/web/src/components/charts/chartData.ts
 *
 * 根拠: ADR-0009 / SPEC-INT-064 / AC-010-3。
 * Rechartsへ渡すprops形状を表示層の外で決定する純粋関数。
 */
import type { TimeseriesAggregate } from "@aiops/shared";
import type { ManagerSummaryBurndownWeek, ManagerSummaryData } from "../views/ManagerSummaryView";

export interface BurndownChartPoint {
  label: string;
  opened: number;
  resolved: number;
  remaining: number;
}

export interface TimeseriesChartPoint {
  label: string;
  opened: number;
  closed: number;
  remaining: number;
  deployments: number;
}

export interface DoraChartPoint {
  projectId: string;
  deploymentFrequencyPerWeek: number;
  changeFailureRatePct: number;
  deploymentReworkRatePct: number;
}

export interface MetricBarPoint {
  label: string;
  value: number;
}

export function toBurndownChartData(weeks: ManagerSummaryBurndownWeek[]): BurndownChartPoint[] {
  return weeks.map((week) => ({
    label: week.weekLabel,
    opened: week.opened,
    resolved: week.resolved,
    remaining: week.remaining,
  }));
}

export function toTimeseriesChartData(data: TimeseriesAggregate): TimeseriesChartPoint[] {
  return data.buckets.map((bucket) => ({
    label: bucket.bucket.label,
    opened: bucket.opened,
    closed: bucket.closed,
    remaining: bucket.burndownRemaining,
    deployments: bucket.deployments,
  }));
}

export function toDoraChartData(rows: NonNullable<ManagerSummaryData["doraByProject"]> = []): DoraChartPoint[] {
  return rows.map((row) => ({
    projectId: row.projectId,
    deploymentFrequencyPerWeek: row.dora.deploymentFrequencyPerWeek,
    changeFailureRatePct: row.dora.changeFailureRatePct,
    deploymentReworkRatePct: row.dora.deploymentReworkRatePct,
  }));
}

export function toMetricBarData(metrics: Array<{ label: string; value: number | null }>): MetricBarPoint[] {
  return metrics.flatMap((metric) => (metric.value === null ? [] : [{ label: metric.label, value: metric.value }]));
}
