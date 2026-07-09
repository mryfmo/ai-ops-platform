"use client";

/**
 * packages/web/src/components/charts/RechartsPanels.tsx
 *
 * 根拠: ADR-0009 / SPEC-INT-064 / AC-010-3。Recharts 3 は client-only のため本ファイルに隔離する。
 */
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BurndownChartPoint, DoraChartPoint, MetricBarPoint, TimeseriesChartPoint } from "./chartData";

const COLORS = {
  opened: "var(--color-chart-1)",
  closed: "var(--color-chart-2)",
  remaining: "var(--color-chart-3)",
  deployments: "var(--color-chart-4)",
  rework: "var(--color-status-red)",
  grid: "var(--color-chart-grid)",
  axis: "var(--color-chart-axis)",
};

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-500">
      {label}
    </div>
  );
}

export function BurndownComposedChart({ data }: { data: BurndownChartPoint[] }) {
  if (data.length === 0) return <EmptyChart label="バーンダウンデータがありません" />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} accessibilityLayer margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="opened" name="新規" fill={COLORS.opened} radius={[4, 4, 0, 0]} />
          <Bar dataKey="resolved" name="解消" fill={COLORS.closed} radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="remaining" name="残件数" stroke={COLORS.remaining} strokeWidth={2.5} dot />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimeseriesAreaChart({ data }: { data: TimeseriesChartPoint[] }) {
  if (data.length === 0) return <EmptyChart label="時系列データがありません" />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} accessibilityLayer margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="remaining"
            name="残件数"
            fill={COLORS.remaining}
            stroke={COLORS.remaining}
            fillOpacity={0.18}
          />
          <Bar dataKey="opened" name="Open" fill={COLORS.opened} radius={[4, 4, 0, 0]} />
          <Bar dataKey="closed" name="Close" fill={COLORS.closed} radius={[4, 4, 0, 0]} />
          <Line
            type="monotone"
            dataKey="deployments"
            name="Deploy"
            stroke={COLORS.deployments}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DoraTrendChart({ data }: { data: DoraChartPoint[] }) {
  if (data.length === 0) return <EmptyChart label="DORAデータがありません" />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} accessibilityLayer margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="projectId" tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="deploymentFrequencyPerWeek"
            name="Deploy/週"
            stroke={COLORS.deployments}
            strokeWidth={2.5}
          />
          <Line
            type="monotone"
            dataKey="changeFailureRatePct"
            name="失敗率%"
            stroke={COLORS.opened}
            strokeWidth={2.5}
          />
          <Line
            type="monotone"
            dataKey="deploymentReworkRatePct"
            name="手戻り率%"
            stroke={COLORS.rework}
            strokeWidth={2.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricHorizontalBars({ data }: { data: MetricBarPoint[] }) {
  if (data.length === 0) return <EmptyChart label="KPI入力データがありません" />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} accessibilityLayer layout="vertical" margin={{ top: 8, right: 12, bottom: 0, left: 24 }}>
          <CartesianGrid stroke={COLORS.grid} horizontal={false} />
          <XAxis type="number" tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={96}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip />
          <Bar dataKey="value" name="値" fill={COLORS.closed} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
