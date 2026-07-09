"use client";

/**
 * packages/web/src/components/views/InvestorReportView.tsx
 *
 * 根拠: REQ-039 / SPEC-INT-066 / AC-039-1 / ADR-0011 / AC-010-3。
 */
import { toMetricBarData } from "../charts/chartData";
import { MetricHorizontalBars } from "../charts/RechartsPanels";
import { Card } from "../ui/Card";
import { ChartContainer } from "../ui/ChartContainer";
import { DataTable, type DataTableColumn } from "../ui/DataTable";

export interface InvestorMetricValue {
  metricId: string;
  label: string;
  unit: string;
  value: number | null;
  source: "financial-input" | "github-derived";
}

export interface InvestorReportData {
  highlights: string[];
  kpis: InvestorMetricValue[];
  milestones: Array<{ projectId: string; name: string; delayDays: number }>;
  risks: Array<{ projectId: string; name: string; highSeverityOpenIssueCount: number }>;
}

export function InvestorReportView({ data }: { data: InvestorReportData }) {
  const kpiColumns: DataTableColumn<InvestorMetricValue>[] = [
    { key: "label", header: "KPI", render: (row) => row.label },
    {
      key: "value",
      header: "値",
      render: (row) => <span className="tabular">{row.value === null ? "未入力" : row.value}</span>,
    },
    { key: "unit", header: "単位", render: (row) => row.unit },
    { key: "source", header: "ソース", render: (row) => row.source },
  ];
  const milestoneColumns: DataTableColumn<InvestorReportData["milestones"][number]>[] = [
    { key: "projectId", header: "ID", render: (row) => row.projectId },
    { key: "name", header: "会社/案件", render: (row) => row.name },
    { key: "delayDays", header: "遅延日数", render: (row) => <span className="tabular">{row.delayDays}</span> },
  ];
  const riskColumns: DataTableColumn<InvestorReportData["risks"][number]>[] = [
    { key: "projectId", header: "ID", render: (row) => row.projectId },
    { key: "name", header: "会社/案件", render: (row) => row.name },
    {
      key: "risk",
      header: "高重大度リスク",
      render: (row) => <span className="tabular">{row.highSeverityOpenIssueCount}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-dashboard-muted">Investor</p>
        <h1 className="text-2xl font-bold tracking-normal text-dashboard-ink">Investor Report</h1>
      </div>
      <Card title="ハイライト">
        <ul className="list-disc space-y-1 pl-5 text-sm text-dashboard-ink">
          {data.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartContainer title="KPI 現在値" description="主要指標を横断比較">
          <MetricHorizontalBars data={toMetricBarData(data.kpis)} />
        </ChartContainer>
        <Card title="KPI">
          <DataTable columns={kpiColumns} rows={data.kpis} rowKey={(row) => row.metricId} />
        </Card>
        <Card title="マイルストーン">
          <DataTable columns={milestoneColumns} rows={data.milestones} rowKey={(row) => row.projectId} />
        </Card>
        <Card title="リスク">
          <DataTable columns={riskColumns} rows={data.risks} rowKey={(row) => row.projectId} />
        </Card>
      </div>
    </div>
  );
}
