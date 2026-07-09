/**
 * packages/web/src/server/reportData/prjopsReportData.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。PrjOpsドメインのダッシュボード表示データ
 *   （経営層セブンキー、マネージャーサマリ+バーンダウン）を組み立てる薄い結線層。
 *
 * 設計: packages/prjops/src/lib/executiveSevenKeys.ts / issueActionBurndown.ts の純粋関数へ
 *   入力データを渡す前に、必ず isProjectInScope（reportPermissionFilter.js）でプロジェクトを
 *   フィルタする（CLAUDE.md設計原則6: 権限フィルタはデータ取得側で強制。表示層での後付け
 *   マスキングは禁止）。
 *
 * PrjOpsのプロジェクト・Issue/Actionマスタは本リポジトリ外（prjops-dataリポジトリ）にあるため、
 * PrjopsReportDataProvider インターフェースで抽象化する
 * （personaResolver.ts の StakeholderMasterProvider と同じ設計思想）。
 * 本番実装（prjops-dataリポジトリからの取得）は残課題であり、本タスクでは
 * InMemoryPrjopsReportDataProvider という開発/テスト用フィクスチャのみを提供する。
 */
import {
  isProjectInScope,
  type Profile,
  type ProjectVisibilityContext,
  computeExecutiveSevenKeysNumeric,
  type ExecutiveProjectInput,
  computeIssueActionBurndown,
  countTotalItemsInPeriod,
  countRemainingItems,
  type IssueActionBurndownInput,
  type BurndownWeek,
} from "@aiops/prjops";

/** prjops-dataリポジトリのプロジェクトマスタ1件相当 */
export interface PrjopsProjectRecord {
  projectId: string;
  name: string;
  color: "red" | "yellow" | "green";
  startDate: string;
  endDate: string;
  progressPct: number;
  highSeverityOpenIssueCount: number;
  isOverdue: boolean;
  /** 期間（表示用ラベル。マネージャーサマリの「期間」欄に使用） */
  periodLabel: string;
  /** 担当者名（表示用。マネージャーサマリの「担当」欄に使用） */
  ownerName: string;
}

/** Issue/Action相当のレコード（本リポジトリにはprjops-dataの実データが無いための抽象表現） */
export interface PrjopsIssueActionRecord {
  projectId: string;
  createdAt: string;
  closedAt: string | null;
}

/**
 * PrjOpsのプロジェクト・Issue/Actionデータ取得を抽象化するインターフェース。
 * 本番実装（prjops-dataリポジトリのYAML/API取得）は残課題であり、本タスクでは実装しない。
 */
export interface PrjopsReportDataProvider {
  listProjects(): Promise<PrjopsProjectRecord[]>;
  listIssuesAndActions(): Promise<PrjopsIssueActionRecord[]>;
}

/**
 * 開発/テスト用のインメモリ実装。
 * 残課題: 本番運用では prjops-data リポジトリからの取得実装に差し替える必要がある。
 */
export class InMemoryPrjopsReportDataProvider implements PrjopsReportDataProvider {
  constructor(
    private readonly projects: PrjopsProjectRecord[] = [],
    private readonly issuesAndActions: PrjopsIssueActionRecord[] = [],
  ) {}

  async listProjects(): Promise<PrjopsProjectRecord[]> {
    return this.projects;
  }

  async listIssuesAndActions(): Promise<PrjopsIssueActionRecord[]> {
    return this.issuesAndActions;
  }
}

/** スコープ内（isProjectInScope通過）のプロジェクトのみへ絞り込む */
async function scopedProjects(
  provider: PrjopsReportDataProvider,
  profile: Profile,
  ctx: ProjectVisibilityContext,
): Promise<PrjopsProjectRecord[]> {
  const all = await provider.listProjects();
  return all.filter((p) => isProjectInScope(profile, p.projectId, ctx));
}

export interface ExecutiveSummaryResult {
  colorDistribution: { green: number; yellow: number; red: number };
  progressAchievementPct: number;
  highRiskIssueCount: number;
  budgetConsumptionPct: number | null;
  scheduleAdherencePct: number;
}

/**
 * PRF-04向け経営層セブンキー（数値4項目）を算出する。
 * color/isOverdueはPrjopsProjectRecordに保持済みの判定結果（REQ-007 judgeStatus相当）をそのまま使う。
 */
export async function buildExecutiveSummary(
  provider: PrjopsReportDataProvider,
  profile: Profile,
  ctx: ProjectVisibilityContext,
): Promise<ExecutiveSummaryResult> {
  const projects = await scopedProjects(provider, profile, ctx);
  const inputs: ExecutiveProjectInput[] = projects.map((p) => ({
    projectId: p.projectId,
    color: p.color,
    progressPct: p.progressPct,
    highSeverityOpenIssueCount: p.highSeverityOpenIssueCount,
    isOverdue: p.isOverdue,
  }));
  return computeExecutiveSevenKeysNumeric(inputs);
}

export interface ManagerSummaryResult {
  totalProjectCount: number;
  projects: Array<{ projectId: string; name: string; periodLabel: string; ownerName: string }>;
  totalTicketCount: number;
  remainingTicketCount: number;
  burndown: BurndownWeek[];
}

/**
 * PRF-03向けマネージャーサマリ（総プロジェクト数・期間・担当・チケット数・バーンダウン）を算出する。
 * periodStart/periodEndはバーンダウン集計の対象期間（呼び出し側が指定する）。
 */
export async function buildManagerSummary(
  provider: PrjopsReportDataProvider,
  profile: Profile,
  ctx: ProjectVisibilityContext,
  periodStart: string,
  periodEnd: string,
): Promise<ManagerSummaryResult> {
  const projects = await scopedProjects(provider, profile, ctx);
  const scopedProjectIds = new Set(projects.map((p) => p.projectId));

  const allItems = await provider.listIssuesAndActions();
  const items = allItems.filter((i) => scopedProjectIds.has(i.projectId));
  const burndownInputs: IssueActionBurndownInput[] = items.map((i) => ({
    createdAt: i.createdAt,
    closedAt: i.closedAt,
  }));

  return {
    totalProjectCount: projects.length,
    projects: projects.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      periodLabel: p.periodLabel,
      ownerName: p.ownerName,
    })),
    totalTicketCount: countTotalItemsInPeriod(burndownInputs, periodStart, periodEnd),
    remainingTicketCount: countRemainingItems(burndownInputs),
    burndown: computeIssueActionBurndown(burndownInputs, periodStart, periodEnd),
  };
}

/** 全ペルソナ共通: スコープ内プロジェクト一覧（数値なし、id/nameのみ） */
export async function listScopedProjectSummaries(
  provider: PrjopsReportDataProvider,
  profile: Profile,
  ctx: ProjectVisibilityContext,
): Promise<Array<{ id: string; name: string }>> {
  const projects = await scopedProjects(provider, profile, ctx);
  return projects.map((p) => ({ id: p.projectId, name: p.name }));
}
