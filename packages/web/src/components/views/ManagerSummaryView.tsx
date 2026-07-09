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
 * バーンダウンチャートはprjops/templates/svgCharts.tsと同じ「外部ライブラリ非依存の
 * インラインSVGをコードで組み立てる」方針を踏襲し、簡易な折れ線グラフとして描画する。
 */
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
}

export interface ManagerSummaryViewProps {
  data: ManagerSummaryData;
  /** "prjops" は「チケット」= Issue/Action、"devops" は「チケット」= incidents を指す（表示ラベル切替用） */
  domain: "prjops" | "devops";
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 200;
const CHART_PADDING = 24;

/** 外部ライブラリ非依存のインラインSVG折れ線グラフ（残チケット数の週次推移） */
function renderBurndownSvg(weeks: ManagerSummaryBurndownWeek[]): string {
  if (weeks.length === 0) {
    return `<svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <text x="${CHART_WIDTH / 2}" y="${CHART_HEIGHT / 2}" text-anchor="middle" font-size="12" fill="#616161">データがありません</text>
</svg>`;
  }

  const maxRemaining = Math.max(1, ...weeks.map((w) => w.remaining));
  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const stepX = weeks.length > 1 ? innerWidth / (weeks.length - 1) : 0;

  const points = weeks.map((w, i) => {
    const x = CHART_PADDING + i * stepX;
    const y = CHART_PADDING + innerHeight - (w.remaining / maxRemaining) * innerHeight;
    return { x, y, week: w };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const circles = points
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#2e7d32" />`)
    .join("\n");

  return `<svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <line x1="${CHART_PADDING}" y1="${CHART_PADDING}" x2="${CHART_PADDING}" y2="${CHART_HEIGHT - CHART_PADDING}" stroke="#e0e0e0" />
  <line x1="${CHART_PADDING}" y1="${CHART_HEIGHT - CHART_PADDING}" x2="${CHART_WIDTH - CHART_PADDING}" y2="${CHART_HEIGHT - CHART_PADDING}" stroke="#e0e0e0" />
  <polyline points="${polyline}" fill="none" stroke="#2e7d32" stroke-width="2" />
  ${circles}
</svg>`;
}

const TICKET_LABEL: Record<"prjops" | "devops", string> = {
  prjops: "課題・アクション",
  devops: "インシデント",
};

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">マネージャーダッシュボード</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="総プロジェクト数">
          <p className="text-3xl font-bold text-gray-800">{data.totalProjectCount}件</p>
        </Card>
        <Card title={`総${TICKET_LABEL[domain]}数`}>
          <p className="text-3xl font-bold text-gray-800">{data.totalTicketCount}件</p>
        </Card>
        <Card title={`残${TICKET_LABEL[domain]}数`}>
          <p className="text-3xl font-bold text-gray-800">{data.remainingTicketCount}件</p>
        </Card>
      </div>

      <Card title="プロジェクト一覧（期間・担当）">
        <DataTable columns={columns} rows={data.projects} rowKey={(r) => r.projectId} />
      </Card>

      <ChartContainer
        title="バーンダウンチャート（残件数の週次推移）"
        description={`${TICKET_LABEL[domain]}の新規/解消/残件数を週次で集計`}
      >
        {/* 外部ライブラリ非依存のコード生成SVG（svgCharts.tsと同じ方針）。ユーザー入力は含まれない。 */}
        <div
          className="w-full overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: renderBurndownSvg(data.burndown) }}
        />
        <DataTable columns={burndownColumns} rows={data.burndown} rowKey={(r) => r.weekLabel} />
      </ChartContainer>
    </div>
  );
}
