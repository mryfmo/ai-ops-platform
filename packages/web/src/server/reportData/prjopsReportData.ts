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
  computeExecutiveSevenKeys,
  type ExecutiveProjectInput,
  type ExecutiveSevenKeysSummary,
  type SevenKeysMonthlySnapshot,
  type SevenKeysQuestionnaireInput,
  type SevenKeysQuestionnaireRecord,
  applySevenKeysQuestionnaire,
  buildInvestorReport,
  type InvestorBoardPackInputs,
  type InvestorFinancialInputs,
  type InvestorReport,
  computeIssueActionBurndown,
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
  scopeChangeCount?: number;
  averageReviewWaitHours?: number;
  activeContributorCount?: number;
  questionnaire?: SevenKeysQuestionnaireInput;
  ownershipPct?: number;
  revenue?: number;
  ebitda?: number;
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
  listSevenKeysMonthlySnapshots?(): Promise<SevenKeysMonthlySnapshot[]>;
  listSevenKeysQuestionnaires?(): Promise<SevenKeysQuestionnaireRecord[]>;
  getInvestorFinancialInputs?(): Promise<InvestorFinancialInputs>;
  getInvestorBoardPackInputs?(): Promise<InvestorBoardPackInputs>;
}

/**
 * 開発/テスト用のインメモリ実装。
 * 残課題: 本番運用では prjops-data リポジトリからの取得実装に差し替える必要がある。
 */
export class InMemoryPrjopsReportDataProvider implements PrjopsReportDataProvider {
  constructor(
    private readonly projects: PrjopsProjectRecord[] = [],
    private readonly issuesAndActions: PrjopsIssueActionRecord[] = [],
    private readonly sevenKeysMonthlySnapshots: SevenKeysMonthlySnapshot[] = [],
    private readonly sevenKeysQuestionnaires: SevenKeysQuestionnaireRecord[] = [],
    private readonly investorFinancialInputs: InvestorFinancialInputs = {},
    private readonly investorBoardPackInputs: InvestorBoardPackInputs = {},
  ) {}

  async listProjects(): Promise<PrjopsProjectRecord[]> {
    return this.projects;
  }

  async listIssuesAndActions(): Promise<PrjopsIssueActionRecord[]> {
    return this.issuesAndActions;
  }

  async listSevenKeysMonthlySnapshots(): Promise<SevenKeysMonthlySnapshot[]> {
    return this.sevenKeysMonthlySnapshots;
  }

  async listSevenKeysQuestionnaires(): Promise<SevenKeysQuestionnaireRecord[]> {
    return this.sevenKeysQuestionnaires;
  }

  async getInvestorFinancialInputs(): Promise<InvestorFinancialInputs> {
    return this.investorFinancialInputs;
  }

  async getInvestorBoardPackInputs(): Promise<InvestorBoardPackInputs> {
    return this.investorBoardPackInputs;
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

export type ExecutiveSummaryResult = ExecutiveSevenKeysSummary & {
  monthlySnapshots?: SevenKeysMonthlySnapshot[];
};

/**
 * PRF-04向け経営層セブンキーを算出する。
 * 定性キーはPrjopsProjectRecord.questionnaireから渡し、GitHub由来キーだけをコードで算出する。
 */
export async function buildExecutiveSummary(
  provider: PrjopsReportDataProvider,
  profile: Profile,
  ctx: ProjectVisibilityContext,
): Promise<ExecutiveSummaryResult> {
  const projects = await scopedProjects(provider, profile, ctx);
  const questionnaireMonth = new Date().toISOString().slice(0, 7);
  const questionnaires = provider.listSevenKeysQuestionnaires ? await provider.listSevenKeysQuestionnaires() : [];
  const inputs: ExecutiveProjectInput[] = projects
    .map((p) => ({
      projectId: p.projectId,
      name: p.name,
      progressPct: p.progressPct,
      startDate: p.startDate,
      endDate: p.endDate,
      asOfDate: new Date().toISOString(),
      highSeverityOpenIssueCount: p.highSeverityOpenIssueCount,
      isOverdue: p.isOverdue,
      scopeChangeCount: p.scopeChangeCount,
      averageReviewWaitHours: p.averageReviewWaitHours,
      activeContributorCount: p.activeContributorCount,
      questionnaire: p.questionnaire,
    }))
    .map((input) => applySevenKeysQuestionnaire(input, questionnaires, questionnaireMonth));
  const summary: ExecutiveSummaryResult = computeExecutiveSevenKeys(inputs);
  if (provider.listSevenKeysMonthlySnapshots) {
    const scopedIds = new Set(projects.map((p) => p.projectId));
    summary.monthlySnapshots = (await provider.listSevenKeysMonthlySnapshots()).filter((s) =>
      scopedIds.has(s.projectId),
    );
  }
  return summary;
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
    totalTicketCount: countItemsActiveInWindow(burndownInputs, periodStart, periodEnd),
    remainingTicketCount: countRemainingItems(burndownInputs, periodEnd),
    burndown: computeIssueActionBurndown(burndownInputs, periodStart, periodEnd),
  };
}

function countItemsActiveInWindow(items: IssueActionBurndownInput[], periodStart: string, periodEnd: string): number {
  const start = Date.parse(periodStart);
  const end = Date.parse(periodEnd);
  return items.filter((item) => {
    const created = Date.parse(item.createdAt);
    const closed = item.closedAt === null ? Number.POSITIVE_INFINITY : Date.parse(item.closedAt);
    return created < end && closed >= start;
  }).length;
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

export async function buildInvestorSummary(
  provider: PrjopsReportDataProvider,
  ctx: ProjectVisibilityContext,
): Promise<InvestorReport> {
  const projects = await scopedProjects(provider, "PRF-05", ctx);
  return buildInvestorReport(
    projects.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      ownershipPct: p.ownershipPct,
      revenue: p.revenue,
      ebitda: p.ebitda,
      milestoneDelayDays: null,
      highSeverityOpenIssueCount: p.highSeverityOpenIssueCount,
    })),
    provider.getInvestorFinancialInputs ? await provider.getInvestorFinancialInputs() : {},
    provider.getInvestorBoardPackInputs ? await provider.getInvestorBoardPackInputs() : {},
  );
}
