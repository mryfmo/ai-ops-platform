/**
 * packages/web/src/components/DashboardClient.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）。
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
import { ChatPanel } from "./chat/ChatPanel";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { DataTable, type DataTableColumn } from "./ui/DataTable";
import { ExecutiveSevenKeysView, type ExecutiveSevenKeysData } from "./views/ExecutiveSevenKeysView";
import { ManagerSummaryView, type ManagerSummaryData } from "./views/ManagerSummaryView";
import { AgentActivityView, type AgentActivityData } from "./views/AgentActivityView";
import type { ViewSpec } from "../server/viewSpec";

const API_BASE = "/app/api/data";

interface ProjectListData {
  domain: "prjops" | "devops";
  projects: Array<{ id: string; name: string }>;
}

type DashboardData =
  | { kind: "executiveSummary"; data: ExecutiveSevenKeysData }
  | { kind: "managerSummary"; domain: "prjops" | "devops"; data: ManagerSummaryData }
  | { kind: "projectList"; data: ProjectListData }
  | { kind: "agentActivity"; data: AgentActivityData };

export interface DashboardClientProps {
  initialViewSpec: ViewSpec;
  initialData: DashboardData;
}

async function fetchExecutiveSummary(): Promise<ExecutiveSevenKeysData> {
  const res = await fetch(`${API_BASE}/executive-summary`);
  if (!res.ok) throw new Error(`E-FETCH01: executive-summary fetch failed (${res.status})`);
  const numeric = (await res.json()) as Omit<ExecutiveSevenKeysData, "monthOverMonthDiffText" | "topTopics">;
  return {
    ...numeric,
    monthOverMonthDiffText: "前月比データは準備中です（スタブ表示）。",
    topTopics: [],
  };
}

async function fetchManagerSummary(
  periodDays?: 7 | 14 | 28,
): Promise<{ domain: "prjops" | "devops"; data: ManagerSummaryData }> {
  const params = new URLSearchParams();
  if (periodDays) {
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

function ProjectListView({ data }: { data: ProjectListData }) {
  const columns: DataTableColumn<{ id: string; name: string }>[] = [
    { key: "id", header: "ID", render: (r) => r.id },
    { key: "name", header: "プロジェクト名", render: (r) => r.name },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロジェクト一覧</h1>
      <Card title={`スコープ内プロジェクト（${data.domain === "prjops" ? "PrjOps" : "DevOps"}）`}>
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
  return <ProjectListView data={view.data} />;
}

export function DashboardClient({ initialViewSpec, initialData }: DashboardClientProps) {
  // initialViewSpecは「サーバーコンポーネントが初期表示のために選択したViewSpec」を明示するための
  // propであり、initialDataの取得元根拠として保持する（初期表示のkindとinitialData.kindは常に一致する）。
  // マウント後の再レンダリングはonViewSpecReceived経由のfetch結果（view state）のみに基づく。
  const [view, setView] = useState<DashboardData>(() => {
    if (initialViewSpec.kind !== initialData.kind) {
      console.warn("E-VIEW01: initialViewSpec.kind does not match initialData.kind");
    }
    return initialData;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleViewSpecReceived = useCallback((spec: ViewSpec) => {
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        if (spec.kind === "executiveSummary") {
          const data = await fetchExecutiveSummary();
          setView({ kind: "executiveSummary", data });
        } else if (spec.kind === "managerSummary") {
          const { domain, data } = await fetchManagerSummary(spec.periodDays);
          setView({ kind: "managerSummary", domain, data });
        } else if (spec.kind === "agentActivity") {
          const data = await fetchAgentActivity();
          setView({ kind: "agentActivity", data });
        } else {
          const data = await fetchProjectList();
          setView({ kind: "projectList", data });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "表示の切り替えに失敗しました");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
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
      </div>
      <div className="lg:col-span-1">
        <ChatPanel onViewSpecReceived={handleViewSpecReceived} />
      </div>
    </div>
  );
}
