import { describe, it, expect } from "vitest";
import {
  checkNoPlaceholders,
  checkFileSizeWithinLimit,
  checkNoExternalReferences,
  verifyNumericConsistency,
} from "@aiops/shared/html/htmlSanitizeCheck.js";
import { composeMemberDailyReport, composeLeaderReport, composeManagerReport } from "../src/templates/index.js";
import { selectTopRiskProjects } from "../src/templates/profileReports.js";
import { buildSubject } from "../src/templates/reportShell.js";

const common = {
  periodLabel: "2026-07-06",
  generatedAtLabel: "2026-07-06 09:00 JST",
  contactLine: "配信停止・宛先変更: devops-support@example.com",
  dateJst: "2026-07-06",
};

describe("buildSubject [DevOps:SPEC-EXT-020]", () => {
  it("件名書式が [DevOpsレポート][種別] YYYY-MM-DD になる", () => {
    expect(buildSubject("メンバー日次", "2026-07-06")).toBe("[DevOpsレポート][メンバー日次] 2026-07-06");
  });
});

describe("composeMemberDailyReport [DevOps:SPEC-EXT-021]", () => {
  it("自己完結・クリーンなHTMLを生成する", () => {
    const { html, subject } = composeMemberDailyReport(common, {
      openPrs: [],
      reviewRequests: [],
      unhandledAlerts: [],
    });
    expect(checkNoPlaceholders(html).ok).toBe(true);
    expect(checkFileSizeWithinLimit(html)).toBe(true);
    expect(checkNoExternalReferences(html).ok).toBe(true);
    expect(subject).toContain("メンバー日次");
  });
  it("0件セクションは「本日はありません」と表示される（セクション自体は省略しない）", () => {
    const { html } = composeMemberDailyReport(common, { openPrs: [], reviewRequests: [], unhandledAlerts: [] });
    expect(html).toContain("本日のあなたのオープンPRとCI状態");
    expect(html.match(/本日はありません/g)?.length).toBe(3);
  });
});

describe("composeLeaderReport [DevOps:SPEC-EXT-022/023]", () => {
  const data = {
    ciSuccessRatePct: 92.5,
    failedWorkflows: ["build-and-test"],
    deploymentsByEnv: { dev: 5, staging: 2, prod: 1 },
    openIncidentsBySeverity: { sev1: 0, sev2: 1, sev3: 2, sev4: 0 },
    pendingApprovals: [{ id: "DEP-0001", kind: "deploy" as const, summary: "v2.3.0 本番デプロイ" }],
    staleTaskCounts: [{ taskType: "レビュー待ち", count: 3 }],
  };

  it("日次レポートは週次トレンドセクションを含まない", () => {
    const { html } = composeLeaderReport(common, data, "PRJ-001", "日次");
    expect(html).not.toContain("週次トレンド");
  });

  it("週次レポートは週次トレンドを含む", () => {
    const { html } = composeLeaderReport(
      common,
      { ...data, weeklyTrend: { ciSuccessRateDeltaPct: 2.5, deploymentCountDelta: 1 } },
      "PRJ-001",
      "週次",
    );
    expect(html).toContain("週次トレンド");
  });

  it("数値がdata-src経由で正本と一致検証できる", () => {
    const { html } = composeLeaderReport(common, data, "PRJ-001", "日次");
    const result = verifyNumericConsistency(html, (path, field) => {
      if (path === "projects/PRJ-001" && field === "ci_success_rate_pct") return "92.5%";
      if (path === "projects/PRJ-001" && field === "deploy_count_prod") return "1";
      return undefined;
    });
    expect(
      result.mismatches.filter((m) => m.field === "ci_success_rate_pct" || m.field === "deploy_count_prod"),
    ).toHaveLength(0);
  });
});

describe("selectTopRiskProjects [DevOps:SPEC-EXT-024(3): 固定選定基準]", () => {
  it("変更失敗率降順でソートされる", () => {
    const result = selectTopRiskProjects([
      { projectId: "PRJ-001", changeFailureRatePct: 10, openSev2Count: 1 },
      { projectId: "PRJ-002", changeFailureRatePct: 30, openSev2Count: 0 },
    ]);
    expect(result[0]?.projectId).toBe("PRJ-002");
  });
  it("同率の場合オープンSev2件数降順", () => {
    const result = selectTopRiskProjects([
      { projectId: "PRJ-001", changeFailureRatePct: 20, openSev2Count: 1 },
      { projectId: "PRJ-002", changeFailureRatePct: 20, openSev2Count: 5 },
    ]);
    expect(result[0]?.projectId).toBe("PRJ-002");
  });
  it("Top5に絞り込まれる", () => {
    const projects = Array.from({ length: 10 }, (_, i) => ({
      projectId: `PRJ-${i}`,
      changeFailureRatePct: i,
      openSev2Count: 0,
    }));
    expect(selectTopRiskProjects(projects)).toHaveLength(5);
  });
});

describe("composeManagerReport [DevOps:SPEC-EXT-024/025]", () => {
  const managerData = {
    dora: {
      deploymentFrequencyPerWeek: 12.5,
      medianLeadTimeHours: 4.2,
      changeFailureRatePct: 8.3,
      failedDeploymentRecoveryTimeHours: 1.5,
      deltaVsPrevWeek: {
        deploymentFrequency: { value: 1, source: "github", as_of: "2026-07-06T00:00:00+09:00" },
        leadTime: { value: -0.5, source: "github", as_of: "2026-07-06T00:00:00+09:00" },
        changeFailureRate: { value: -1.2, source: "github", as_of: "2026-07-06T00:00:00+09:00" },
        mttr: { value: 0, source: "github", as_of: "2026-07-06T00:00:00+09:00" },
      },
    },
    sev1And2: [],
    topRiskProjects: selectTopRiskProjects([{ projectId: "PRJ-001", changeFailureRatePct: 15, openSev2Count: 1 }]),
    expiredApprovalCount: 2,
  };

  it("週次レポートは権限棚卸しを含まない", () => {
    const { html } = composeManagerReport(common, managerData, "週次");
    expect(html).not.toContain("権限棚卸しサマリ");
  });

  it("月次レポートは権限棚卸しサマリを含む（DevOps:REQ-019/023）", () => {
    const { html } = composeManagerReport(
      common,
      { ...managerData, permissionAudit: { totalGrants: 120, revokedThisMonth: 15, externalAccountCount: 8 } },
      "月次",
    );
    expect(html).toContain("権限棚卸しサマリ");
  });

  it("codingTaskActivity未指定のとき、AIコーディングエージェント稼働状況セクションを含まない（ADR-0006 4b: 後方互換）", () => {
    const { html } = composeManagerReport(common, managerData, "週次");
    expect(html).not.toContain("AIコーディングエージェント稼働状況");
  });

  it("codingTaskActivity指定時、AIコーディングエージェント稼働状況セクションを含む（ADR-0006 4b）", () => {
    const { html } = composeManagerReport(
      common,
      {
        ...managerData,
        codingTaskActivity: {
          countsByStatus: { queued: 1, running: 0, pr_created: 3, failed: 1, cancelled: 0 },
          totalCount: 5,
          completionSuccessRatePct: 75,
          recentPullRequests: [],
        },
      },
      "週次",
    );
    expect(html).toContain("AIコーディングエージェント稼働状況");
    expect(html).toContain("75.0%");
  });

  it("codingTaskActivity.completionSuccessRatePctがnullのとき「データなし」と表示する", () => {
    const { html } = composeManagerReport(
      common,
      {
        ...managerData,
        codingTaskActivity: {
          countsByStatus: { queued: 2, running: 0, pr_created: 0, failed: 0, cancelled: 0 },
          totalCount: 2,
          completionSuccessRatePct: null,
          recentPullRequests: [],
        },
      },
      "週次",
    );
    expect(html).toContain("データなし");
  });

  it("DevOps:SPEC-INT-081: unavailable deltaは0/NaN/null文字列でなく固定「未取得」と表示する", () => {
    const unavailable = {
      value: null,
      unavailable_reason: "missing_previous",
      source: "github",
      as_of: "2026-07-13T00:00:00+09:00",
    } as const;
    const { html } = composeManagerReport(
      common,
      {
        ...managerData,
        dora: {
          ...managerData.dora,
          deltaVsPrevWeek: {
            deploymentFrequency: unavailable,
            leadTime: unavailable,
            changeFailureRate: unavailable,
            mttr: unavailable,
          },
        },
      },
      "週次",
    );
    expect(html.match(/<td>未取得<\/td>/g)).toHaveLength(4);
    expect(html).not.toMatch(/<td>(?:0|NaN|null)<\/td>/);
  });

  it("DevOps:SPEC-INT-081: measured型へnon-finite値が混入してもHTMLへ出力しない", () => {
    const invalidMeasured = {
      value: Number.POSITIVE_INFINITY,
      source: "dora",
      as_of: "2026-07-13T00:00:00+09:00",
    };
    const { html } = composeManagerReport(
      common,
      {
        ...managerData,
        dora: {
          ...managerData.dora,
          deploymentFrequencyPerWeek: Number.POSITIVE_INFINITY,
          medianLeadTimeHours: Number.NaN,
          changeFailureRatePct: Number.NEGATIVE_INFINITY,
          failedDeploymentRecoveryTimeHours: Number.POSITIVE_INFINITY,
          deltaVsPrevWeek: {
            deploymentFrequency: invalidMeasured,
            leadTime: invalidMeasured,
            changeFailureRate: invalidMeasured,
            mttr: invalidMeasured,
          },
        },
      },
      "週次",
    );
    expect(html.match(/<td>未取得<\/td>/g)).toHaveLength(8);
    expect(html).not.toContain("Infinity");
    expect(html).not.toContain("NaN");
  });

  it("自己完結・クリーンなHTML", () => {
    const { html } = composeManagerReport(common, managerData, "週次");
    expect(checkNoPlaceholders(html).ok).toBe(true);
    expect(checkFileSizeWithinLimit(html)).toBe(true);
    expect(checkNoExternalReferences(html).ok).toBe(true);
  });
});
