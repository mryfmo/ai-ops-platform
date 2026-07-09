/**
 * packages/web/src/server/reportData/agentActivityData.ts
 *
 * 根拠: ADR-0006（AIコーディングエージェント統合）決定4「可視化は決定的集計のみ（LLM不使用）」。
 *   coding_tasksテーブル（packages/devops/src/db/schema.sql、既存）から実DB経由でスナップショットを
 *   取得し、summarizeCodingTaskActivity（packages/devops/src/lib/codingTaskActivity.ts）へ渡す結線層。
 *
 * 設計: devopsReportData.tsと同じ設計パターンを踏襲する。
 *   - @aiops/shared の PgQueryable を注入する（テストはネットワーク・実DBなしでモック
 *     PgQueryableを用いて実行できる）。
 *   - isProjectInScope（devops/lib/reportPermissionFilter.js）を必ずクエリ結果に適用してから
 *     summarizeCodingTaskActivityへ渡す（CLAUDE.md設計原則6: 権限フィルタはデータ取得側で強制。
 *     表示層での後付けマスキングは禁止）。
 *
 * 公開範囲: 本タスクではPRF-G（DevOpsマネージャー、全プロジェクト横断）専用の配線として
 *   packages/web/src/app/api/data/agent-activity/route.ts から利用する。PRF-L
 *   （担当プロジェクトのみ）への公開は次フェーズの残課題（本関数自体はisProjectInScopeを
 *   通すためprofile/ctx次第でPRF-Lにも対応できるが、tools.ts/route.ts側でPRF-G専用に絞っている）。
 */
import type { PgQueryable } from "@aiops/shared";
import {
  isProjectInScope,
  summarizeCodingTaskActivity,
  type Profile,
  type DevOpsVisibilityContext,
  type CodingTaskLike,
  type CodingTaskActivitySummary,
} from "@aiops/devops";

interface CodingTaskRow {
  task_id: string;
  project_id: string;
  status: CodingTaskLike["status"];
  agent: CodingTaskLike["agent"];
  pr_url: string | null;
  branch: string | null;
  created_at: string | Date;
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function fetchCodingTasks(db: PgQueryable): Promise<CodingTaskRow[]> {
  const res = await db.query(
    "SELECT task_id, project_id, status, agent, pr_url, branch, created_at FROM coding_tasks",
    [],
  );
  return res.rows as unknown as CodingTaskRow[];
}

/**
 * PRF-G向けAIコーディングエージェント稼働サマリを算出する。project_idがisProjectInScopeを
 * 満たす行のみに絞ってから集計する（CLAUDE.md設計原則6）。
 */
export async function buildAgentActivitySummary(
  db: PgQueryable,
  profile: Profile,
  ctx: DevOpsVisibilityContext,
): Promise<CodingTaskActivitySummary> {
  const rows = await fetchCodingTasks(db);
  const scopedTasks: CodingTaskLike[] = rows
    .filter((r) => isProjectInScope(profile, r.project_id, ctx))
    .map((r) => ({
      taskId: r.task_id,
      projectId: r.project_id,
      status: r.status,
      agent: r.agent,
      prUrl: r.pr_url,
      branch: r.branch,
      createdAt: toIsoString(r.created_at),
    }));

  return summarizeCodingTaskActivity(scopedTasks);
}
