/**
 * packages/web/tests/reportData/prjopsReportData.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。CLAUDE.md設計原則6（権限フィルタはデータ取得側で強制）の
 *   検証: InMemoryPrjopsReportDataProviderにスコープ外プロジェクトを含めても、
 *   buildExecutiveSummary/buildManagerSummary/listScopedProjectSummariesの結果に
 *   スコープ外データが一切漏れないことを確認する。
 */
import { describe, it, expect } from "vitest";
import type { ProjectVisibilityContext } from "@aiops/prjops";
import {
  InMemoryPrjopsReportDataProvider,
  buildExecutiveSummary,
  buildInvestorSummary,
  buildManagerSummary,
  listScopedProjectSummaries,
  type PrjopsProjectRecord,
  type PrjopsIssueActionRecord,
} from "../../src/server/reportData/prjopsReportData";

const projects: PrjopsProjectRecord[] = [
  {
    projectId: "PRJ-0001",
    name: "案件A",
    color: "green",
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    progressPct: 50,
    highSeverityOpenIssueCount: 1,
    isOverdue: false,
    scopeChangeCount: 0,
    averageReviewWaitHours: 12,
    activeContributorCount: 2,
    periodLabel: "2026-01〜2026-03",
    ownerName: "山田太郎",
  },
  {
    projectId: "PRJ-0002",
    name: "案件B（管理外）",
    color: "red",
    startDate: "2026-01-01",
    endDate: "2026-02-28",
    progressPct: 10,
    highSeverityOpenIssueCount: 5,
    isOverdue: true,
    scopeChangeCount: 5,
    averageReviewWaitHours: 90,
    activeContributorCount: 1,
    periodLabel: "2026-01〜2026-02",
    ownerName: "鈴木花子",
  },
];

const issuesAndActions: PrjopsIssueActionRecord[] = [
  { projectId: "PRJ-0001", createdAt: "2026-01-05T00:00:00Z", closedAt: null },
  { projectId: "PRJ-0002", createdAt: "2026-01-05T00:00:00Z", closedAt: null },
];

// PRF-03（マネージャー）はrecipientManagedProjectIdsのみを対象範囲とする（PRJ-0002は管理外）
const managerCtx: ProjectVisibilityContext = {
  recipientStakeholderId: "STK-001",
  recipientManagedProjectIds: ["PRJ-0001"],
  recipientAssignedProjectIds: [],
  recipientParticipatingProjectIds: [],
  investedProjectIds: [],
};

describe("buildExecutiveSummary（PRF-04）", () => {
  it("PRF-04は全プロジェクトを対象範囲とする（isProjectInScope: PRF-04は常にtrue）", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(projects, issuesAndActions);
    const emptyCtx: ProjectVisibilityContext = {
      recipientStakeholderId: "STK-EXEC",
      recipientManagedProjectIds: [],
      recipientAssignedProjectIds: [],
      recipientParticipatingProjectIds: [],
      investedProjectIds: [],
    };
    const result = await buildExecutiveSummary(provider, "PRF-04", emptyCtx);
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0]?.keys).toHaveLength(7);
    expect(result.projects[1]?.keys.find((key) => key.keyId === "K3")?.rag).toBe("red");
  });

  it("AC-038-1: 構造化質問票をSeven Keysの定性キーへ渡す", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(
      [projects[0]!],
      issuesAndActions,
      [],
      [
        {
          projectId: "PRJ-0001",
          month: new Date().toISOString().slice(0, 7),
          answers: {
            stakeholdersCommitted: "green",
            businessBenefits: "yellow",
            deliveryOrgBenefits: "red",
          },
        },
      ],
    );
    const emptyCtx: ProjectVisibilityContext = {
      recipientStakeholderId: "STK-EXEC",
      recipientManagedProjectIds: [],
      recipientAssignedProjectIds: [],
      recipientParticipatingProjectIds: [],
      investedProjectIds: [],
    };
    const result = await buildExecutiveSummary(provider, "PRF-04", emptyCtx);
    const keys = new Map(result.projects[0]?.keys.map((key) => [key.keyId, key.rag]));
    expect(keys.get("K1")).toBe("green");
    expect(keys.get("K2")).toBe("yellow");
    expect(keys.get("K7")).toBe("red");
  });

  it("AC-038-1: 月次PDCAスナップショットは権限スコープ内プロジェクトだけ返す", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(projects, issuesAndActions, [
      { month: "2026-07", projectId: "PRJ-0001", name: "案件A", improvedKeys: ["K1"], worsenedKeys: [], keys: [] },
      { month: "2026-07", projectId: "PRJ-999", name: "範囲外", improvedKeys: [], worsenedKeys: ["K3"], keys: [] },
    ]);
    const emptyCtx: ProjectVisibilityContext = {
      recipientStakeholderId: "STK-EXEC",
      recipientManagedProjectIds: [],
      recipientAssignedProjectIds: [],
      recipientParticipatingProjectIds: [],
      investedProjectIds: [],
    };
    const result = await buildExecutiveSummary(provider, "PRF-04", emptyCtx);
    expect(result.monthlySnapshots?.map((snapshot) => snapshot.projectId)).toEqual(["PRJ-0001"]);
  });
});

describe("buildInvestorSummary（investor: 出資対象のみ）", () => {
  it("PRF-05相当のinvestedProjectIdsで投資家KPIを作る", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(projects, issuesAndActions);
    const result = await buildInvestorSummary(provider, {
      recipientStakeholderId: "STK-INV",
      recipientManagedProjectIds: [],
      recipientAssignedProjectIds: [],
      recipientParticipatingProjectIds: [],
      investedProjectIds: ["PRJ-0002"],
    });
    expect(result.highlights[0]).toBe("1 portfolio companies");
    expect(result.risks[0]?.projectId).toBe("PRJ-0002");
  });

  it("board-pack targetを配線し、trendは履歴入力から算出する", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(
      [
        {
          ...projects[0]!,
          ownershipPct: 50,
          revenue: 200,
        },
      ],
      issuesAndActions,
      [],
      [],
      {},
      { targets: { revenue: 80 }, history: [{ revenue: 60 }, { revenue: 90 }] },
    );
    const result = await buildInvestorSummary(provider, {
      recipientStakeholderId: "STK-INV",
      recipientManagedProjectIds: [],
      recipientAssignedProjectIds: [],
      recipientParticipatingProjectIds: [],
      investedProjectIds: ["PRJ-0001"],
    });
    expect(result.kpis.find((kpi) => kpi.metricId === "revenue")).toMatchObject({
      value: 100,
      target: 80,
      variance: 20,
      trend: [60, 90],
    });
  });
});

describe("buildManagerSummary（PRF-03: 権限フィルタ適用確認）", () => {
  it("スコープ外プロジェクト（PRJ-0002）がtotalProjectCount/projectsに含まれない", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(projects, issuesAndActions);
    const result = await buildManagerSummary(provider, "PRF-03", managerCtx, "2026-01-01", "2026-01-15");
    expect(result.totalProjectCount).toBe(1);
    expect(result.projects).toEqual([
      { projectId: "PRJ-0001", name: "案件A", periodLabel: "2026-01〜2026-03", ownerName: "山田太郎" },
    ]);
  });

  it("スコープ外プロジェクトのissue/actionがチケット数・バーンダウンに混入しない", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(projects, issuesAndActions);
    const result = await buildManagerSummary(provider, "PRF-03", managerCtx, "2026-01-01", "2026-01-15");
    // issuesAndActionsには2件あるが、スコープ内(PRJ-0001)は1件のみ
    expect(result.totalTicketCount).toBe(1);
    expect(result.remainingTicketCount).toBe(1);
  });
});

describe("listScopedProjectSummaries（全ペルソナ共通: id/nameのみ、数値なし）", () => {
  it("スコープ内プロジェクトのid/nameのみを返す", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(projects, issuesAndActions);
    const result = await listScopedProjectSummaries(provider, "PRF-03", managerCtx);
    expect(result).toEqual([{ id: "PRJ-0001", name: "案件A" }]);
  });

  it("該当プロジェクトが無い場合は空配列を返す", async () => {
    const provider = new InMemoryPrjopsReportDataProvider(projects, issuesAndActions);
    const emptyCtx: ProjectVisibilityContext = {
      recipientStakeholderId: "STK-999",
      recipientManagedProjectIds: [],
      recipientAssignedProjectIds: [],
      recipientParticipatingProjectIds: [],
      investedProjectIds: [],
    };
    const result = await listScopedProjectSummaries(provider, "PRF-03", emptyCtx);
    expect(result).toEqual([]);
  });
});
