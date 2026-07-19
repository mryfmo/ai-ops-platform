/**
 * packages/web/src/server/reportData/prjopsReportData.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。PrjOpsドメインのダッシュボード表示データ
 *   （経営層セブンキー、マネージャーサマリ+バーンダウン）を組み立てる薄い結線層。
 *
 * 設計: packages/prjops/src/lib/executiveSevenKeys.ts / issueActionBurndown.ts の純粋関数へ
 *   入力データを渡す前に、provider queryへprofile/visibilityを渡す。集約層に全件取得APIを
 *   公開せず、権限条件をデータ取得境界で強制する（設計原則6）。
 *
 * PrjOpsのプロジェクト・Issue/Actionマスタは本リポジトリ外（prjops-dataリポジトリ）にあるため、
 * PrjopsReportDataProvider インターフェースで抽象化する
 * （personaResolver.ts の StakeholderMasterProvider と同じ設計思想）。
 * InMemoryPrjopsReportDataProviderは開発/テスト用fixture、本番実装は
 * pinnedPrjopsReportDataProvider.tsで提供する。
 */
import {
  isProjectInScope,
  canShowPersonalNames,
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
  color: "red" | "yellow" | "green" | "grey";
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

export interface PrjopsReportDataQuery {
  profile: Profile;
  visibility: ProjectVisibilityContext;
}

export interface ScopedPrjopsReportData {
  projects: PrjopsProjectRecord[];
  issuesAndActions: PrjopsIssueActionRecord[];
  sevenKeysMonthlySnapshots: SevenKeysMonthlySnapshot[];
  sevenKeysQuestionnaires: SevenKeysQuestionnaireRecord[];
  investorFinancialInputs: InvestorFinancialInputs;
  investorBoardPackInputs: InvestorBoardPackInputs;
}

/** 全件取得を公開せず、profile/stakeholder/project条件を必須にするreport data境界。 */
export interface PrjopsReportDataProvider {
  query(input: PrjopsReportDataQuery): Promise<ScopedPrjopsReportData>;
}

/**
 * 開発/テスト用のインメモリ実装。filterはprovider内部で行い、集約層へ全件を返さない。
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

  async query(input: PrjopsReportDataQuery): Promise<ScopedPrjopsReportData> {
    const investor = input.profile === "PRF-05";
    const projects = this.projects
      .filter((project) => isProjectInScope(input.profile, project.projectId, input.visibility))
      .map((project) => ({
        ...project,
        ownerName: canShowPersonalNames(input.profile) ? project.ownerName : "",
        ownershipPct: investor ? project.ownershipPct : undefined,
        revenue: investor ? project.revenue : undefined,
        ebitda: investor ? project.ebitda : undefined,
      }));
    const projectIds = new Set(projects.map((project) => project.projectId));
    return {
      projects,
      issuesAndActions: this.issuesAndActions.filter((item) => projectIds.has(item.projectId)),
      sevenKeysMonthlySnapshots:
        input.profile === "PRF-04"
          ? this.sevenKeysMonthlySnapshots.filter((snapshot) => projectIds.has(snapshot.projectId))
          : [],
      sevenKeysQuestionnaires:
        input.profile === "PRF-04"
          ? this.sevenKeysQuestionnaires.filter((questionnaire) => projectIds.has(questionnaire.projectId))
          : [],
      investorFinancialInputs: investor ? this.investorFinancialInputs : {},
      investorBoardPackInputs: investor
        ? {
            ...this.investorBoardPackInputs,
            history: this.investorBoardPackInputs.history?.map((snapshot) => ({
              companies: snapshot.companies.filter((company) => projectIds.has(company.projectId)),
            })),
          }
        : {},
    };
  }
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
  const data = await provider.query({ profile, visibility: ctx });
  const projects = data.projects;
  const questionnaireMonth = new Date().toISOString().slice(0, 7);
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
    .map((input) => applySevenKeysQuestionnaire(input, data.sevenKeysQuestionnaires, questionnaireMonth));
  const summary: ExecutiveSummaryResult = computeExecutiveSevenKeys(inputs);
  summary.monthlySnapshots = data.sevenKeysMonthlySnapshots;
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
  const data = await provider.query({ profile, visibility: ctx });
  const projects = data.projects;
  const burndownInputs: IssueActionBurndownInput[] = data.issuesAndActions.map((i) => ({
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
  const data = await provider.query({ profile, visibility: ctx });
  return data.projects.map((p) => ({ id: p.projectId, name: p.name }));
}

export async function buildInvestorSummary(
  provider: PrjopsReportDataProvider,
  ctx: ProjectVisibilityContext,
): Promise<InvestorReport> {
  const data = await provider.query({ profile: "PRF-05", visibility: ctx });
  return buildInvestorReport(
    data.projects.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      ownershipPct: p.ownershipPct,
      revenue: p.revenue,
      ebitda: p.ebitda,
      milestoneDelayDays: null,
      highSeverityOpenIssueCount: p.highSeverityOpenIssueCount,
    })),
    data.investorFinancialInputs,
    data.investorBoardPackInputs,
  );
}
