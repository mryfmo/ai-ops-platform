/**
 * packages/prjops/src/lib/executiveSevenKeys.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。経営層（PRF-04）ダッシュボードの主指標
 *   「セブンキー」のうち、決定的に算出可能な数値項目（1: ポートフォリオ健康度、
 *   2: 進捗達成率、3: 高リスク課題件数、5: スケジュール遵守率）を算出する純粋関数群。
 *   既存の templates/profileReports.ts ExecutiveReportData（結論文・トップトピック・
 *   前月比＝LLM生成の文章スロット）を拡張し、数値4項目を追加する。
 *
 * CLAUDE.md設計原則2（数値・色・表はコード算出、LLMは文章スロットのみ）に従い、
 * 本モジュールはLLM呼び出しを一切行わない。judgeStatus/computePlanLinePctの結果を
 * 集計するのみで、判定基準自体はREQ-007（statusJudge.ts）に委譲する。
 *
 * 指標4（予算消化率）について: packages/prjops のプロジェクトエンティティには予算フィールドが
 * 存在しない（DOC-03/DOC-05のいずれにも予算スキーマの定義がない）。そのため本タスクでは
 * budgetConsumptionPct を `number | null` 型とし、算出不能な場合は null を返す暫定実装とする。
 * 本番実装（予算マスタとの連携）は残課題として明記する。
 */
import type { ColorDistribution } from "../templates/svgCharts.js";

/**
 * セブンキー算出対象の1プロジェクト分の入力。
 * color/isOverdueはREQ-007のjudgeStatus/computePlanLinePctによる判定結果を呼び出し側で
 * 算出済みの値として渡す想定（本モジュールは判定基準そのものは再計算しない。集計に専念する）。
 */
export interface ExecutiveProjectInput {
  projectId: string;
  color: "red" | "yellow" | "green";
  progressPct: number;
  highSeverityOpenIssueCount: number;
  /** REQ-007の終了予定日超過判定結果（asOfDate > endDateで真） */
  isOverdue: boolean;
}

export interface ExecutiveSevenKeysNumeric {
  /** 1. ポートフォリオ健康度（色分布。既存ExecutiveReportData.colorDistributionと同一形式） */
  colorDistribution: ColorDistribution;
  /** 2. 進捗達成率（%）: 全対象プロジェクトの計画線比進捗率（progressPct - planLinePct + 100想定ではなく
   *    「計画線に対する進捗の達成度」として progressPct の単純平均を採用する。0件時は0。 */
  progressAchievementPct: number;
  /** 3. 高リスク課題件数: 対象プロジェクト群の highSeverityOpenIssueCount の合計 */
  highRiskIssueCount: number;
  /** 4. 予算消化率(%): packages/prjopsに予算フィールドが存在しないため常にnull（データ未整備）。
   *    型としてはnumberも許容し、将来の予算マスタ連携実装に備える。 */
  budgetConsumptionPct: number | null;
  /** 5. スケジュール遵守率(%): 終了予定日を超過していないプロジェクトの割合。0件時は100（該当なし＝遵守とみなす）。 */
  scheduleAdherencePct: number;
}

function toColorDistribution(projects: ExecutiveProjectInput[]): ColorDistribution {
  const dist: ColorDistribution = { green: 0, yellow: 0, red: 0 };
  for (const p of projects) {
    dist[p.color] += 1;
  }
  return dist;
}

/** 指標2: 進捗達成率（%）= 対象プロジェクトのprogressPctの単純平均。0件時は0。 */
export function computeProgressAchievementPct(projects: ExecutiveProjectInput[]): number {
  if (projects.length === 0) return 0;
  const sum = projects.reduce((acc, p) => acc + p.progressPct, 0);
  return sum / projects.length;
}

/** 指標3: 高リスク課題件数 = 対象プロジェクトのhighSeverityOpenIssueCountの合計 */
export function computeHighRiskIssueCount(projects: ExecutiveProjectInput[]): number {
  return projects.reduce((acc, p) => acc + p.highSeverityOpenIssueCount, 0);
}

/** 指標5: スケジュール遵守率(%) = (対象プロジェクト数 - 終了予定日超過件数) / 対象プロジェクト数 × 100。0件時は100。 */
export function computeScheduleAdherencePct(projects: ExecutiveProjectInput[]): number {
  if (projects.length === 0) return 100;
  const overdueCount = projects.filter((p) => p.isOverdue).length;
  return ((projects.length - overdueCount) / projects.length) * 100;
}

/**
 * セブンキーのうち決定的に算出可能な数値4項目（1,2,3,5）をまとめて算出する。
 * 予算消化率（指標4）はデータ未整備のため常にnull（残課題）。
 */
export function computeExecutiveSevenKeysNumeric(projects: ExecutiveProjectInput[]): ExecutiveSevenKeysNumeric {
  return {
    colorDistribution: toColorDistribution(projects),
    progressAchievementPct: computeProgressAchievementPct(projects),
    highRiskIssueCount: computeHighRiskIssueCount(projects),
    budgetConsumptionPct: null,
    scheduleAdherencePct: computeScheduleAdherencePct(projects),
  };
}
