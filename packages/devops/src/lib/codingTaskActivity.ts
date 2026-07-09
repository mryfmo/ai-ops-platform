/**
 * packages/devops/src/lib/codingTaskActivity.ts
 *
 * 根拠: ADR-0006（AIコーディングエージェント統合）決定4「可視化は決定的集計のみ
 *   （LLM不使用。AGT-RPT原則の踏襲）: coding_tasksテーブルと...からWebUIのAgentActivityViewと、
 *   AGT-RPTマネージャーレポートの『AI起源PR比率・AI PR変更失敗率』に反映する」に対応する
 *   純粋集計関数。coding_tasksテーブル（packages/devops/src/db/schema.sql、既存）のスナップショットを
 *   受け取り、ステータス別件数・完了成功率・直近生成PR一覧を決定的に算出する。
 *   CLAUDE.md設計原則2（数値・色・表はコード算出、LLMは文章スロットのみ）に従い、LLMは一切使用しない。
 *
 * 残課題（本タスクではスコープ外・虚偽の指標を作らないための明記）:
 *   ADR-0006 決定4が言及する「AI起源PR比率」（リポジトリ全体のPR一覧に対するcoding_tasks由来PRの
 *   割合）および「AI PR変更失敗率」は、リポジトリ全体のPR一覧（GitHub API）とcoding_tasksを
 *   突合するデータモデルが現状存在しないため実装しない（coding_tasks.pr_urlはあるが、
 *   リポジトリ側の全PR一覧をこの関数の入力にしていない）。本モジュールが提供するのは
 *   coding_tasks内で完結する指標（completionSuccessRatePct = coding_tasksの完了件数に対する
 *   pr_created件数の割合）のみである。全PR中のAI起源比率の算出は、GitHub PR一覧取得・
 *   ai-generatedラベル/agent/ブランチプレフィクスとの突合ロジックを別途実装する次フェーズの
 *   残課題とする。
 */

export type CodingTaskStatus = "queued" | "running" | "pr_created" | "failed" | "cancelled";

export interface CodingTaskLike {
  taskId: string;
  projectId: string;
  status: CodingTaskStatus;
  agent: "claude-code" | "droid";
  prUrl: string | null;
  branch: string | null;
  createdAt: string; // ISO 8601
}

export interface CodingTaskActivitySummary {
  countsByStatus: Record<CodingTaskStatus, number>;
  totalCount: number;
  /** 完了(pr_created/failed/cancelled)のうちpr_createdの割合。queued/runningは分母に含めない。完了0件ならnull */
  completionSuccessRatePct: number | null;
  /** pr_createdのみ、createdAt降順、最大10件 */
  recentPullRequests: Array<{
    taskId: string;
    projectId: string;
    prUrl: string;
    branch: string | null;
    createdAt: string;
  }>;
}

const ALL_STATUSES: CodingTaskStatus[] = ["queued", "running", "pr_created", "failed", "cancelled"];
const RECENT_PR_LIMIT = 10;

function emptyCountsByStatus(): Record<CodingTaskStatus, number> {
  return { queued: 0, running: 0, pr_created: 0, failed: 0, cancelled: 0 };
}

/** ステータス別件数を数える（ALL_STATUSES以外の未知値が入力に混入していてもtotalCountには含めるがcountsByStatusは既知5種のみ） */
function countByStatus(tasks: CodingTaskLike[]): Record<CodingTaskStatus, number> {
  const counts = emptyCountsByStatus();
  for (const task of tasks) {
    if (ALL_STATUSES.includes(task.status)) {
      counts[task.status] += 1;
    }
  }
  return counts;
}

/** 完了(pr_created/failed/cancelled)件数のうちpr_created件数の割合(%)。完了0件ならnull */
function calcCompletionSuccessRatePct(counts: Record<CodingTaskStatus, number>): number | null {
  const completedCount = counts.pr_created + counts.failed + counts.cancelled;
  if (completedCount === 0) return null;
  return (counts.pr_created / completedCount) * 100;
}

/** pr_createdのタスクのみを抽出し、createdAt降順で並べて最大10件に絞る */
function selectRecentPullRequests(
  tasks: CodingTaskLike[],
): Array<{ taskId: string; projectId: string; prUrl: string; branch: string | null; createdAt: string }> {
  return tasks
    .filter((t): t is CodingTaskLike & { prUrl: string } => t.status === "pr_created" && t.prUrl !== null)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RECENT_PR_LIMIT)
    .map((t) => ({
      taskId: t.taskId,
      projectId: t.projectId,
      prUrl: t.prUrl,
      branch: t.branch,
      createdAt: t.createdAt,
    }));
}

/** coding_tasksのスナップショットからAIコーディングエージェント稼働可視化のための集計を行う（ADR-0006 4b） */
export function summarizeCodingTaskActivity(tasks: CodingTaskLike[]): CodingTaskActivitySummary {
  const countsByStatus = countByStatus(tasks);
  return {
    countsByStatus,
    totalCount: tasks.length,
    completionSuccessRatePct: calcCompletionSuccessRatePct(countsByStatus),
    recentPullRequests: selectRecentPullRequests(tasks),
  };
}
