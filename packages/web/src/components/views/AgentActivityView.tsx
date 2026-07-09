/**
 * packages/web/src/components/views/AgentActivityView.tsx
 *
 * 根拠: ADR-0006（AIコーディングエージェント統合）決定4「可視化は決定的集計のみ（LLM不使用）」。
 *   PRF-G（DevOpsマネージャー）ダッシュボードのAIコーディングエージェント稼働状況
 *   （ステータス別件数・完了成功率・直近生成PR一覧）を表示するビューコンポーネント。
 *   数値はすべてreportData層（packages/web/src/server/reportData/agentActivityData.ts、
 *   コード算出）から渡された値をそのまま表示するのみで、本コンポーネント自体は集計を
 *   行わない（CLAUDE.md設計原則2）。ExecutiveSevenKeysView.tsx/ManagerSummaryView.tsxと
 *   同じスタイルで実装する。
 */
import { Card } from "../ui/Card";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { DataTable, type DataTableColumn } from "../ui/DataTable";

export type AgentActivityStatus = "queued" | "running" | "pr_created" | "failed" | "cancelled";

export interface AgentActivityPullRequestRow {
  taskId: string;
  projectId: string;
  prUrl: string;
  branch: string | null;
  createdAt: string;
}

export interface AgentActivityData {
  countsByStatus: Record<AgentActivityStatus, number>;
  totalCount: number;
  completionSuccessRatePct: number | null;
  recentPullRequests: AgentActivityPullRequestRow[];
}

export interface AgentActivityViewProps {
  data: AgentActivityData;
}

const STATUS_LABEL_JA: Record<AgentActivityStatus, string> = {
  queued: "待機中",
  running: "実行中",
  pr_created: "PR作成済み",
  failed: "失敗",
  cancelled: "取消",
};

const STATUS_BADGE_VARIANT: Record<AgentActivityStatus, BadgeVariant> = {
  queued: "default",
  running: "yellow",
  pr_created: "green",
  failed: "red",
  cancelled: "default",
};

const STATUS_ORDER: AgentActivityStatus[] = ["queued", "running", "pr_created", "failed", "cancelled"];

function pctLabel(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

export function AgentActivityView({ data }: AgentActivityViewProps) {
  const prColumns: DataTableColumn<AgentActivityPullRequestRow>[] = [
    { key: "projectId", header: "プロジェクト", render: (r) => r.projectId },
    {
      key: "prUrl",
      header: "PR",
      render: (r) => (
        <a href={r.prUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          {r.prUrl}
        </a>
      ),
    },
    { key: "branch", header: "ブランチ", render: (r) => r.branch ?? "-" },
    { key: "createdAt", header: "作成日時", render: (r) => r.createdAt },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AIコーディングエージェント稼働状況</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="総タスク数">
          <p className="text-3xl font-bold text-gray-800">{data.totalCount}件</p>
        </Card>

        <Card title="完了成功率（pr_created / 完了件数）">
          {data.completionSuccessRatePct === null ? (
            <Badge variant="default">データなし</Badge>
          ) : (
            <p className="text-3xl font-bold text-gray-800">{pctLabel(data.completionSuccessRatePct)}</p>
          )}
        </Card>

        <Card title="ステータス別件数" className="sm:col-span-2 lg:col-span-1">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_ORDER.map((status) => (
              <Badge key={status} variant={STATUS_BADGE_VARIANT[status]}>
                {STATUS_LABEL_JA[status]}: {data.countsByStatus[status]}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      <Card title="直近の生成PR（最大10件）">
        <DataTable columns={prColumns} rows={data.recentPullRequests} rowKey={(r) => r.taskId} />
      </Card>
    </div>
  );
}
