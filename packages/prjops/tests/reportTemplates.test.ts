import { describe, it, expect } from "vitest";
import {
  checkNoPlaceholders,
  checkFileSizeWithinLimit,
  checkNoExternalReferences,
  verifyNumericConsistency,
  checkForbiddenTerms,
} from "@aiops/shared/html/htmlSanitizeCheck.js";
import {
  composeMemberReport,
  composeLeaderReport,
  composeManagerReport,
  composeExecutiveReport,
  composeInvestorReport,
  type ComposeCommonOptions,
} from "../src/templates/index.js";

const common: ComposeCommonOptions = {
  reportId: "RPT-PRF-02-PJ-001-2026-W27-ST-010",
  periodLabel: "2026-06-30 〜 2026-07-06",
  generatedAtLabel: "2026-07-06 07:00 JST",
  dataSnapshotLabel: "2026-07-06 06:00 JST",
  lang: "ja",
  contactLine: "お問い合わせ: prjops-support@example.com",
};

function assertSelfContainedAndClean(html: string, forbiddenTerms: string[] = []) {
  expect(checkNoPlaceholders(html).ok).toBe(true);
  expect(checkFileSizeWithinLimit(html)).toBe(true);
  expect(checkNoExternalReferences(html).ok).toBe(true);
  if (forbiddenTerms.length) {
    expect(checkForbiddenTerms(html, forbiddenTerms).ok).toBe(true);
  }
}

describe("composeMemberReport [PRF-01, SPEC-EXT-021]", () => {
  const html = composeMemberReport(common, {
    actions: [
      { id: "ACT-0001", content: "資料レビュー", due: "2026-07-08", status: "open", overdue: false },
      { id: "ACT-0002", content: "議事録送付", due: "2026-07-01", status: "open", overdue: true },
    ],
    projects: [{ id: "PJ-001", name: "サンプル案件", color: "yellow" }],
  });

  it("自己完結・プレースホルダなし・サイズ制限内", () => {
    assertSelfContainedAndClean(html);
  });
  it("期限超過アクションの行に overdue クラスが付く", () => {
    expect(html).toContain('class="overdue"');
  });
  it("0件セクションでも「本日はありません」が表示される（0件でもセクション省略しない）", () => {
    const emptyHtml = composeMemberReport(common, { actions: [], projects: [] });
    expect(emptyHtml).toContain("本日はありません");
  });
});

describe("composeLeaderReport [PRF-02]", () => {
  const html = composeLeaderReport(common, {
    projects: [
      {
        id: "PJ-001",
        name: "サンプル案件",
        machineColor: "red",
        selfColor: "green",
        progressPct: 40,
        planLinePct: 60,
        reported: true,
      },
      {
        id: "PJ-002",
        name: "未報告案件",
        machineColor: "yellow",
        selfColor: "yellow",
        progressPct: 0,
        planLinePct: 30,
        reported: false,
        previousProgressPct: 55,
      },
    ],
    issuesAndActions: [{ id: "ISSUE-0001", type: "issue", title: "外部連携の遅延", status: "open", severity: "high" }],
  });

  it("自己完結・クリーン", () => {
    assertSelfContainedAndClean(html);
  });
  it("機械判定と自己申告の乖離が併記される（AC-007-2）", () => {
    expect(html).toContain("危険");
    expect(html).toContain("順調");
  });
  it("未報告プロジェクトは前回値ラベル付きで表示される（AC-006-2）", () => {
    expect(html).toContain("(前回値)");
    expect(html).toContain("未報告");
  });
  it("data-src数値が正本データと一致検証できる", () => {
    const result = verifyNumericConsistency(html, (path, field) => {
      if (path === "projects/PJ-001" && field === "progress_pct") return "40%";
      if (path === "projects/PJ-001" && field === "plan_line_pct") return "60.0%";
      if (path === "projects/PJ-002" && field === "progress_pct_prev") return "55%";
      if (path === "projects/PJ-002" && field === "plan_line_pct") return "30.0%";
      return undefined;
    });
    expect(result.ok).toBe(true);
    expect(result.checkedCount).toBeGreaterThanOrEqual(4);
  });
});

describe("composeManagerReport [PRF-03]", () => {
  const html = composeManagerReport(common, {
    heatmapRows: [
      { projectId: "PJ-001", projectName: "サンプル案件", weeklyColors: ["green", "green", "yellow", "red"] },
    ],
    weekLabels: ["W24", "W25", "W26", "W27"],
    redYellowProjects: [{ id: "PJ-001", name: "サンプル案件", color: "red", summaryLines: ["納期遅延の懸念"] }],
    crossIssues: [{ id: "ISSUE-0010", title: "共通基盤の障害", projectIds: ["PJ-001", "PJ-002"] }],
    escalationHistory: [{ date: "2026-07-05", description: "PJ-001が3回目の督促超過によりエスカレーション" }],
    changedThisWeekProjectIds: ["PJ-001"],
  });

  it("自己完結・クリーン", () => {
    assertSelfContainedAndClean(html);
  });
  it("今週の変化が先頭に明示される", () => {
    expect(html).toContain("今週の変化");
  });
});

describe("composeExecutiveReport [PRF-04: 個人名非表示]", () => {
  const html = composeExecutiveReport(common, {
    conclusionLines: ["全体は概ね順調です。", "PJ-003に遅延リスクがあります。", "追加リソース検討が必要です。"],
    colorDistribution: { green: 30, yellow: 15, red: 5 },
    topTopics: [{ title: "PJ-003 遅延", lines: ["外部要因による遅延", "対策検討中"] }],
    monthOverMonthDiffText: "前月比でRedが2件増加",
  });

  it("自己完結・クリーン・個人名を含まない", () => {
    assertSelfContainedAndClean(html, ["田中太郎", "山田花子"]);
  });
  it("ドーナツグラフのSVGが埋め込まれる", () => {
    expect(html).toContain("<svg");
    expect(html).toContain("stroke-dasharray");
  });
  it("色分布の合計値が正本と一致検証できる", () => {
    const result = verifyNumericConsistency(html, (path, field) => {
      if (path === "portfolio" && field === "color_green_count") return "30";
      if (path === "portfolio" && field === "color_yellow_count") return "15";
      if (path === "portfolio" && field === "color_red_count") return "5";
      if (path === "portfolio" && field === "color_total_count") return "50";
      return undefined;
    });
    expect(result.ok).toBe(true);
  });
});

describe("composeInvestorReport [PRF-05: 社内固有情報を含まない, 機密表示]", () => {
  const html = composeInvestorReport(common, {
    coverPeriodLabel: "2026年第2四半期",
    portfolioSummaryLines: ["出資対象3件は全て計画通り進行中です。"],
    projectPages: [
      {
        id: "PJ-002",
        name: "出資対象案件A",
        milestoneStatus: "フェーズ2完了",
        color: "green",
        nextQuarterOutlook: "フェーズ3へ移行予定",
      },
    ],
  });

  it("自己完結・クリーン・社内固有語を含まない", () => {
    assertSelfContainedAndClean(html, ["社内システムX", "田中太郎"]);
  });
  it("機密表示(Confidential — for investor use only相当)が含まれる", () => {
    expect(html).toContain("機密");
  });
});

describe("英語版レポート [ASM-002, AC-016-1: 数値・色判定の日英一致]", () => {
  it("同一データのja/en版で色ラベルと数値が対応する", () => {
    const dataJa = { actions: [], projects: [{ id: "PJ-001", name: "サンプル案件", color: "red" as const }] };
    const htmlJa = composeMemberReport({ ...common, lang: "ja" }, dataJa);
    const htmlEn = composeMemberReport({ ...common, lang: "en" }, dataJa);
    expect(htmlJa).toContain("危険");
    expect(htmlEn).toContain("Red");
    // 同一の色(red)が使われている（数値・色判定が完全一致）
    expect(htmlJa).toContain("#c62828");
    expect(htmlEn).toContain("#c62828");
  });
});
