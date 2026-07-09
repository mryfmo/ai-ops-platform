"use client";

/**
 * packages/web/src/components/views/ManagerSummaryView.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。マネージャー層
 *   （PrjOps: PRF-03 / DevOps: PRF-G）ダッシュボードの主指標
 *   （総プロジェクト数・期間・担当・総チケット数・残チケット数・バーンダウンチャート）を
 *   表示するビューコンポーネント。数値はすべてreportData層（コード算出）から渡された値を
 *   そのまま表示するのみで、本コンポーネント自体は集計を行わない
 *   （CLAUDE.md設計原則2: 数値はコード算出、表示層は表示に専任）。
 *
 * ADR-0009 / SPEC-INT-064 / AC-010-3: Web表示チャートはRecharts 3へ移行する。
 */
import { toBurndownChartData, toDoraChartData } from "../charts/chartData";
import { BurndownComposedChart, DoraTrendChart } from "../charts/RechartsPanels";
import { Card } from "../ui/Card";
import { ChartContainer } from "../ui/ChartContainer";
import { DataTable, type DataTableColumn } from "../ui/DataTable";

export interface ManagerSummaryProjectRow {
  projectId: string;
  name: string;
  periodLabel: string;
  ownerName: string;
}

export interface ManagerSummaryBurndownWeek {
  weekLabel: string;
  opened: number;
  resolved: number;
  remaining: number;
}

export interface ManagerSummaryData {
  totalProjectCount: number;
  projects: ManagerSummaryProjectRow[];
  totalTicketCount: number;
  remainingTicketCount: number;
  burndown: ManagerSummaryBurndownWeek[];
  velocity?: { issueThroughput: number; prThroughput: number };
  coveragePct?: number | null;
  dora?: {
    deploymentFrequencyPerWeek: number;
    medianLeadTimeHours: number;
    changeFailureRatePct: number;
    deploymentReworkRatePct: number;
    meanTimeToRestoreHours: number;
  };
  doraByProject?: Array<{ projectId: string; dora: NonNullable<ManagerSummaryData["dora"]> }>;
}

export interface ManagerSummaryViewProps {
  data: ManagerSummaryData;
  /** "prjops" は「チケット」= Issue/Action、"devops" は「チケット」= incidents を指す（表示ラベル切替用） */
  domain: "prjops" | "devops";
}

const TICKET_LABEL: Record<"prjops" | "devops", string> = {
  prjops: "課題・アクション",
  devops: "インシデント",
};

function oneDecimal(value: number): string {
  return value.toFixed(1);
}

export function ManagerSummaryView({ data, domain }: ManagerSummaryViewProps) {
  const columns: DataTableColumn<ManagerSummaryProjectRow>[] = [
    { key: "projectId", header: "ID", render: (r) => r.projectId },
    { key: "name", header: "プロジェクト名", render: (r) => r.name },
    { key: "periodLabel", header: "期間", render: (r) => r.periodLabel },
    { key: "ownerName", header: "担当", render: (r) => r.ownerName },
  ];

  const burndownColumns: DataTableColumn<ManagerSummaryBurndownWeek>[] = [
    { key: "weekLabel", header: "週", render: (r) => r.weekLabel },
    { key: "opened", header: "新規", render: (r) => r.opened },
    { key: "resolved", header: "解消", render: (r) => r.resolved },
    { key: "remaining", header: "残件数", render: (r) => r.remaining },
  ];
  const doraColumns: DataTableColumn<NonNullable<ManagerSummaryData["doraByProject"]>[number]>[] = [
    { key: "projectId", header: "サービス/Repo", render: (r) => r.projectId },
    { key: "deployFreq", header: "デプロイ頻度/週", render: (r) => oneDecimal(r.dora.deploymentFrequencyPerWeek) },
    { key: "leadTime", header: "変更LT(h)", render: (r) => oneDecimal(r.dora.medianLeadTimeHours) },
    { key: "failRate", header: "失敗率(%)", render: (r) => oneDecimal(r.dora.changeFailureRatePct) },
    { key: "reworkRate", header: "手戻り率(%)", render: (r) => oneDecimal(r.dora.deploymentReworkRatePct) },
    { key: "restore", header: "復旧時間(h)", render: (r) => oneDecimal(r.dora.meanTimeToRestoreHours) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-dashboard-muted">
          {domain === "devops" ? "DevOps Manager" : "PrjOps Manager"}
        </p>
        <h1 className="text-2xl font-bold tracking-normal text-dashboard-ink">マネージャーダッシュボード</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="総プロジェクト数">
          <p className="tabular text-3xl font-bold text-dashboard-ink">{data.totalProjectCount}件</p>
        </Card>
        <Card title={`総${TICKET_LABEL[domain]}数`}>
          <p className="tabular text-3xl font-bold text-dashboard-ink">{data.totalTicketCount}件</p>
        </Card>
        <Card title={`残${TICKET_LABEL[domain]}数`}>
          <p className="tabular text-3xl font-bold text-dashboard-ink">{data.remainingTicketCount}件</p>
        </Card>
      </div>

      <Card title="プロジェクト一覧（期間・担当）">
        <DataTable columns={columns} rows={data.projects} rowKey={(r) => r.projectId} />
      </Card>

      {data.velocity || data.dora ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card title="ベロシティ">
            <p className="tabular text-sm text-dashboard-ink">
              Issue {data.velocity?.issueThroughput ?? 0} / PR {data.velocity?.prThroughput ?? 0}
            </p>
          </Card>
          <Card title="テストカバレッジ">
            <p className="tabular text-sm text-dashboard-ink">
              {data.coveragePct === null || data.coveragePct === undefined
                ? "未取得"
                : `${oneDecimal(data.coveragePct)}%`}
            </p>
          </Card>
          <Card title="DORA 5">
            <p className="tabular text-sm text-dashboard-ink">
              DF {oneDecimal(data.dora?.deploymentFrequencyPerWeek ?? 0)} / Rework{" "}
              {oneDecimal(data.dora?.deploymentReworkRatePct ?? 0)}%
            </p>
          </Card>
        </div>
      ) : null}

      <ChartContainer
        title="バーンダウンチャート（残件数の週次推移）"
        description={`${TICKET_LABEL[domain]}の新規/解消/残件数を週次で集計`}
      >
        <BurndownComposedChart data={toBurndownChartData(data.burndown)} />
        <DataTable columns={burndownColumns} rows={data.burndown} rowKey={(r) => r.weekLabel} />
      </ChartContainer>

      {data.doraByProject ? (
        <div className="space-y-4">
          <ChartContainer title="DORA 5 トレンド" description="サービス/Repository別の主要指標">
            <DoraTrendChart data={toDoraChartData(data.doraByProject)} />
          </ChartContainer>
          <Card title="DORA 5（サービス/Repository別）">
            <DataTable columns={doraColumns} rows={data.doraByProject} rowKey={(r) => r.projectId} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
