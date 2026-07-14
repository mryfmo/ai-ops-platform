/**
 * packages/web/src/components/DashboardClient.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）/
 *   ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。
 *   サーバーコンポーネント（dashboard/page.tsx）が取得した初期ViewSpec/初期データを表示しつつ、
 *   ChatPanelを併設し、ChatPanelがtool結果（ViewSpec）を受け取ったら対応する /api/data/* を
 *   fetchしてビューを再レンダリングする。
 *
 *   数値はすべて /api/data/* （reportData層のコード算出結果）から取得した値をそのまま表示し、
 *   本コンポーネント自体は集計を行わない（CLAUDE.md設計原則2）。
 *
 * basePath: next.config.mjs の basePath "/app" 配下で配信されるため、/api/data/* への
 * fetchは "/app" プレフィクス込みのパスを使用する。
 *
 * agentActivity（ADR-0006 4b: PRF-G専用）は projectList と同様、初期表示のkindとしては
 * 選択されず（dashboard/page.tsxの初期表示はexecutiveSummary/managerSummaryのみ）、
 * チャット経由（showAgentActivity tool）でのみ到達する。
 */
"use client";

import { useCallback, useState } from "react";
import type { PeriodKind, TimeseriesAggregate } from "@aiops/shared";
import { PageAgentPanel } from "./chat/ChatPanel";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { DataTable, type DataTableColumn } from "./ui/DataTable";
import { toTimeseriesChartData } from "./charts/chartData";
import { TimeseriesAreaChart } from "./charts/RechartsPanels";
import { ExecutiveSevenKeysView, type ExecutiveSevenKeysData } from "./views/ExecutiveSevenKeysView";
import { ManagerSummaryView, type ManagerSummaryData } from "./views/ManagerSummaryView";
import { AgentActivityView, type AgentActivityData } from "./views/AgentActivityView";
import { InvestorReportView, type InvestorReportData } from "./views/InvestorReportView";
import { parseViewSpec, type ViewSpec } from "../server/viewSpec";

const API_BASE = "/app/api/data";
const PERIODS: PeriodKind[] = ["week", "month", "quarter", "half", "year"];

interface ProjectListData {
  domain: "prjops" | "devops" | "investor";
  projects: Array<{ id: string; name: string }>;
}

type DashboardData =
  | { kind: "executiveSummary"; data: ExecutiveSevenKeysData }
  | { kind: "managerSummary"; domain: "prjops" | "devops"; data: ManagerSummaryData }
  | { kind: "investorSummary"; data: InvestorReportData }
  | { kind: "projectList"; data: ProjectListData }
  | { kind: "agentActivity"; data: AgentActivityData };

export interface DashboardClientProps {
  initialViewSpec: ViewSpec;
  initialData: DashboardData;
}

async function fetchExecutiveSummary(): Promise<ExecutiveSevenKeysData> {
  const res = await fetch(`${API_BASE}/executive-summary`);
  if (!res.ok) throw new Error(`E-FETCH01: executive-summary fetch failed (${res.status})`);
  return (await res.json()) as ExecutiveSevenKeysData;
}

interface PeriodSelection {
  period: PeriodKind;
  baseDate: string;
}

function clientPeriodRange(selection: PeriodSelection): { start: string; end: string } {
  const base = new Date(`${selection.baseDate}T00:00:00+09:00`);
  const jst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth();
  if (selection.period === "week") {
    const dayNum = (jst.getUTCDay() + 6) % 7;
    const start = new Date(base.getTime() - dayNum * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const startMonth =
    selection.period === "month"
      ? month
      : selection.period === "quarter"
        ? Math.floor(month / 3) * 3
        : selection.period === "half"
          ? Math.floor(month / 6) * 6
          : 0;
  const length =
    selection.period === "month" ? 1 : selection.period === "quarter" ? 3 : selection.period === "half" ? 6 : 12;
  return {
    start: new Date(Date.UTC(year, startMonth, 1) - 9 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.UTC(year, startMonth + length, 1) - 9 * 60 * 60 * 1000).toISOString(),
  };
}

function periodParams(selection: PeriodSelection, persona?: "executive" | "manager" | "investor"): string {
  const range = clientPeriodRange(selection);
  const params = new URLSearchParams({
    period: selection.period,
    baseDate: selection.baseDate,
    periodStart: range.start,
    periodEnd: range.end,
  });
  if (persona) params.set("persona", persona);
  return params.toString();
}

async function fetchManagerSummary(
  periodDays?: 7 | 14 | 28,
  selection?: PeriodSelection,
): Promise<{ domain: "prjops" | "devops"; data: ManagerSummaryData }> {
  const params = new URLSearchParams();
  if (selection) {
    const range = clientPeriodRange(selection);
    params.set("periodStart", range.start);
    params.set("periodEnd", range.end);
  } else if (periodDays) {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);
    params.set("periodStart", periodStart.toISOString());
    params.set("periodEnd", periodEnd.toISOString());
  }
  const query = params.toString();
  const res = await fetch(`${API_BASE}/manager-summary${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(`E-FETCH01: manager-summary fetch failed (${res.status})`);
  const body = (await res.json()) as ManagerSummaryData & { domain: "prjops" | "devops" };
  const { domain, ...data } = body;
  return { domain, data };
}

async function fetchProjectList(): Promise<ProjectListData> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(`E-FETCH01: projects fetch failed (${res.status})`);
  return (await res.json()) as ProjectListData;
}

async function fetchAgentActivity(): Promise<AgentActivityData> {
  const res = await fetch(`${API_BASE}/agent-activity`);
  if (!res.ok) throw new Error(`E-FETCH01: agent-activity fetch failed (${res.status})`);
  return (await res.json()) as AgentActivityData;
}

async function fetchInvestorSummary(): Promise<InvestorReportData> {
  const res = await fetch(`${API_BASE}/investor-summary`);
  if (!res.ok) throw new Error(`E-FETCH01: investor-summary fetch failed (${res.status})`);
  return (await res.json()) as InvestorReportData;
}

async function fetchTimeseries(
  selection: PeriodSelection,
  persona: "executive" | "manager" | "investor",
): Promise<TimeseriesAggregate> {
  const res = await fetch(`${API_BASE}/timeseries?${periodParams(selection, persona)}`);
  if (!res.ok) throw new Error(`E-FETCH01: timeseries fetch failed (${res.status})`);
  return (await res.json()) as TimeseriesAggregate;
}

function ProjectListView({ data }: { data: ProjectListData }) {
  const columns: DataTableColumn<{ id: string; name: string }>[] = [
    { key: "id", header: "ID", render: (r) => r.id },
    { key: "name", header: "プロジェクト名", render: (r) => r.name },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロジェクト一覧</h1>
      <Card
        title={`スコープ内プロジェクト（${
          data.domain === "prjops" ? "PrjOps" : data.domain === "devops" ? "DevOps" : "Investor"
        }）`}
      >
        <DataTable columns={columns} rows={data.projects} rowKey={(r) => r.id} />
      </Card>
    </div>
  );
}

function renderView(view: DashboardData) {
  if (view.kind === "executiveSummary") {
    return <ExecutiveSevenKeysView data={view.data} />;
  }
  if (view.kind === "managerSummary") {
    return <ManagerSummaryView data={view.data} domain={view.domain} />;
  }
  if (view.kind === "agentActivity") {
    return <AgentActivityView data={view.data} />;
  }
  if (view.kind === "investorSummary") {
    return <InvestorReportView data={view.data} />;
  }
  return <ProjectListView data={view.data} />;
}

function personaForView(view: DashboardData): "executive" | "manager" | "investor" {
  if (view.kind === "investorSummary") return "investor";
  if (view.kind === "managerSummary") return "manager";
  return "executive";
}

function TimeseriesPanel({ data }: { data: TimeseriesAggregate }) {
  return (
    <Card title={`時系列スナップショット（${data.range.label}）`} eyebrow="Change over time">
      <div className="space-y-3">
        <TimeseriesAreaChart data={toTimeseriesChartData(data)} />
        <div className="tabular grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          <span>Open {data.totals.opened}</span>
          <span>Close {data.totals.closed}</span>
          <span>遷移 {data.totals.statusTransitions}</span>
          <span>Milestone {data.totals.milestoneCompleted}</span>
          <span>Deploy {data.totals.deployments}</span>
        </div>
      </div>
    </Card>
  );
}

function shiftBaseDate(selection: PeriodSelection, direction: -1 | 1): PeriodSelection {
  const current = new Date(`${selection.baseDate}T00:00:00Z`);
  const next = new Date(current);
  if (selection.period === "week") next.setUTCDate(current.getUTCDate() + direction * 7);
  else if (selection.period === "month") next.setUTCMonth(current.getUTCMonth() + direction);
  else if (selection.period === "quarter") next.setUTCMonth(current.getUTCMonth() + direction * 3);
  else if (selection.period === "half") next.setUTCMonth(current.getUTCMonth() + direction * 6);
  else next.setUTCFullYear(current.getUTCFullYear() + direction);
  return { ...selection, baseDate: next.toISOString().slice(0, 10) };
}

export function DashboardClient({ initialViewSpec, initialData }: DashboardClientProps) {
  const parsedInitialViewSpec = parseViewSpec(initialViewSpec);
  // initialViewSpecは「サーバーコンポーネントが初期表示のために選択したViewSpec」を明示するための
  // propであり、initialDataの取得元根拠として保持する（初期表示のkindとinitialData.kindは常に一致する）。
  // マウント後の再レンダリングはonViewSpecReceived経由のfetch結果（view state）のみに基づく。
  const [view, setView] = useState<DashboardData>(() => {
    if (parsedInitialViewSpec.kind !== initialData.kind) {
      console.warn("E-VIEW01: initialViewSpec.kind does not match initialData.kind");
    }
    return initialData;
  });
  const [currentSpec, setCurrentSpec] = useState<ViewSpec>(parsedInitialViewSpec);
  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(() => ({
    period: "month",
    baseDate: new Date().toISOString().slice(0, 10),
  }));
  const [timeseries, setTimeseries] = useState<TimeseriesAggregate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadView = useCallback(
    (rawSpec: unknown, selection: PeriodSelection, includeTimeseries: boolean) => {
      const spec = parseViewSpec(rawSpec);
      setIsLoading(true);
      setError(null);
      (async () => {
        try {
          if (spec.kind === "timeseries") {
            const nextSelection = { ...selection, period: spec.period };
            setPeriodSelection(nextSelection);
            setTimeseries(await fetchTimeseries(nextSelection, personaForView(view)));
            return;
          }
          let nextView: DashboardData;
          if (spec.kind === "executiveSummary") {
            const data = await fetchExecutiveSummary();
            nextView = { kind: "executiveSummary", data };
          } else if (spec.kind === "managerSummary") {
            const { domain, data } = await fetchManagerSummary(spec.periodDays, selection);
            nextView = { kind: "managerSummary", domain, data };
          } else if (spec.kind === "agentActivity") {
            const data = await fetchAgentActivity();
            nextView = { kind: "agentActivity", data };
          } else if (spec.kind === "investorSummary") {
            const data = await fetchInvestorSummary();
            nextView = { kind: "investorSummary", data };
          } else if (spec.kind === "projectList") {
            const data = await fetchProjectList();
            nextView = { kind: "projectList", data };
          } else {
            throw new Error("E-VIEW02: project board data endpoint is not available");
          }
          setView(nextView);
          setCurrentSpec(spec);
          if (includeTimeseries) {
            setTimeseries(await fetchTimeseries(selection, personaForView(nextView)));
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "表示の切り替えに失敗しました");
        } finally {
          setIsLoading(false);
        }
      })();
    },
    [view],
  );

  const handleViewSpecReceived = useCallback(
    (spec: ViewSpec) => loadView(spec, periodSelection, false),
    [loadView, periodSelection],
  );

  const updatePeriod = useCallback(
    (next: PeriodSelection) => {
      setPeriodSelection(next);
      loadView(currentSpec, next, true);
    },
    [currentSpec, loadView],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="表示期間" eyebrow="Period">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded border px-3 py-1 text-sm"
              type="button"
              onClick={() => updatePeriod(shiftBaseDate(periodSelection, -1))}
            >
              前へ
            </button>
            {PERIODS.map((period) => (
              <button
                key={period}
                className={`rounded border px-3 py-1 text-sm ${periodSelection.period === period ? "bg-dashboard-ink text-dashboard-panel" : ""}`}
                type="button"
                onClick={() => updatePeriod({ ...periodSelection, period })}
              >
                {period}
              </button>
            ))}
            <button
              className="rounded border px-3 py-1 text-sm"
              type="button"
              onClick={() => updatePeriod(shiftBaseDate(periodSelection, 1))}
            >
              次へ
            </button>
          </div>
        </Card>
        {error ? (
          <Card title="エラー" className="border-status-red">
            <p className="text-sm text-status-red">{error}</p>
          </Card>
        ) : null}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          renderView(view)
        )}
        {timeseries ? <TimeseriesPanel data={timeseries} /> : null}
      </div>
      <div className="lg:col-span-1">
        <PageAgentPanel
          onViewSpecReceived={handleViewSpecReceived}
          pageContext={{
            period: periodSelection.period,
            baseDate: periodSelection.baseDate,
            view: currentSpec,
          }}
        />
      </div>
    </div>
  );
}
