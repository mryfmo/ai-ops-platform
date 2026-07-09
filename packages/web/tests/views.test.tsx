/**
 * packages/web/tests/views.test.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。ExecutiveSevenKeysView / ManagerSummaryView の
 *   React要素を直接呼び出し、propsを検証する軽量テスト（既存ui.test.tsxと同じ方式）。
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { ExecutiveSevenKeysView, type ExecutiveSevenKeysData } from "../src/components/views/ExecutiveSevenKeysView";
import { InvestorReportView, type InvestorReportData } from "../src/components/views/InvestorReportView";
import { ManagerSummaryView, type ManagerSummaryData } from "../src/components/views/ManagerSummaryView";
import { AgentActivityView, type AgentActivityData } from "../src/components/views/AgentActivityView";

function propsOf(el: ReactElement): Record<string, unknown> {
  return el.props as Record<string, unknown>;
}

/** 深さ優先でReact要素ツリーを走査し、条件に合致する最初の要素を返す */
function findElement(el: unknown, predicate: (el: ReactElement) => boolean): ReactElement | null {
  if (el === null || el === undefined || typeof el !== "object") return null;
  if (Array.isArray(el)) {
    for (const child of el) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  const maybeEl = el as ReactElement;
  if (typeof maybeEl.type !== "undefined" && maybeEl.props !== undefined) {
    if (predicate(maybeEl)) return maybeEl;
    const children = (maybeEl.props as Record<string, unknown>)["children"];
    return findElement(children, predicate);
  }
  return null;
}

function findAllElements(
  el: unknown,
  predicate: (el: ReactElement) => boolean,
  out: ReactElement[] = [],
): ReactElement[] {
  if (el === null || el === undefined || typeof el !== "object") return out;
  if (Array.isArray(el)) {
    for (const child of el) findAllElements(child, predicate, out);
    return out;
  }
  const maybeEl = el as ReactElement;
  if (typeof maybeEl.type !== "undefined" && maybeEl.props !== undefined) {
    if (predicate(maybeEl)) out.push(maybeEl);
    const children = (maybeEl.props as Record<string, unknown>)["children"];
    findAllElements(children, predicate, out);
  }
  return out;
}

const executiveData: ExecutiveSevenKeysData = {
  projects: [
    {
      projectId: "PRJ-0001",
      name: "案件A",
      keys: [
        { keyId: "K1", title: "Stakeholders are committed", rag: "grey", basis: "structured questionnaire missing" },
      ],
    },
  ],
};

describe("ExecutiveSevenKeysView（REQ-038: Seven Keys RAGマトリクス）", () => {
  it("AC-038-1: 見出しにセブンキーダッシュボードのタイトルを表示する", () => {
    const el = ExecutiveSevenKeysView({ data: executiveData });
    const heading = findElement(el, (e) => e.type === "h1");
    expect(heading).not.toBeNull();
    expect(propsOf(heading!)["children"]).toBe("経営ダッシュボード（Seven Keys）");
  });

  it("AC-038-1: 未評価RAGを色だけでなくラベル表示する", () => {
    const el = ExecutiveSevenKeysView({ data: executiveData });
    const table = findElement(el, (e) => Array.isArray(propsOf(e)["rows"]));
    expect(propsOf(table!)["rows"]).toEqual(executiveData.projects);
  });

  it("AC-038-1: RAGセルに形状記号とテキストラベルを含める", () => {
    const el = ExecutiveSevenKeysView({ data: executiveData });
    const table = findElement(el, (e) => Array.isArray(propsOf(e)["columns"]));
    const columns = propsOf(table!)["columns"] as Array<{
      key: string;
      render: (row: ExecutiveSevenKeysData["projects"][number]) => ReactElement;
    }>;
    const cell = columns.find((column) => column.key === "K1")!.render(executiveData.projects[0]!);
    const badge = findElement(cell, (e) => propsOf(e)["variant"] === "grey");
    expect(JSON.stringify(propsOf(badge!)["children"])).toContain("◇");
    expect(JSON.stringify(propsOf(badge!)["children"])).toContain("未評価");
  });
});

const investorData: InvestorReportData = {
  highlights: ["1 portfolio companies"],
  kpis: [{ metricId: "revenue", label: "Revenue", unit: "currency", value: 100, source: "financial-input" }],
  milestones: [{ projectId: "PRJ-0001", name: "会社A", delayDays: 0 }],
  risks: [],
};

describe("InvestorReportView（REQ-039: 投資家KPIパッケージ）", () => {
  it("AC-039-1: Investor Report見出しとKPIテーブルを表示する", () => {
    const el = InvestorReportView({ data: investorData });
    const heading = findElement(el, (e) => e.type === "h1");
    expect(propsOf(heading!)["children"]).toBe("Investor Report");
    const table = findElement(el, (e) => Array.isArray(propsOf(e)["rows"]) && propsOf(e)["rows"] === investorData.kpis);
    expect(table).not.toBeNull();
  });

  it("AC-010-3: KPIの数値セルをtabularで表示する", () => {
    const el = InvestorReportView({ data: investorData });
    const table = findElement(el, (e) => Array.isArray(propsOf(e)["rows"]) && propsOf(e)["rows"] === investorData.kpis);
    const columns = propsOf(table!)["columns"] as Array<{
      key: string;
      render: (row: InvestorReportData["kpis"][number]) => ReactElement;
    }>;
    const cell = columns.find((column) => column.key === "value")!.render(investorData.kpis[0]!);
    expect(propsOf(cell)["className"]).toBe("tabular");
  });
});

const managerData: ManagerSummaryData = {
  totalProjectCount: 2,
  projects: [
    { projectId: "PRJ-0001", name: "案件A", periodLabel: "2026-01〜2026-03", ownerName: "山田太郎" },
    { projectId: "PRJ-0002", name: "案件B", periodLabel: "2026-02〜2026-04", ownerName: "鈴木花子" },
  ],
  totalTicketCount: 10,
  remainingTicketCount: 4,
  burndown: [
    { weekLabel: "2026-01-01", opened: 3, resolved: 1, remaining: 2 },
    { weekLabel: "2026-01-08", opened: 2, resolved: 0, remaining: 4 },
  ],
};

describe("ManagerSummaryView（ADR-0005: マネージャーサマリ+バーンダウン）", () => {
  it("AC-010-3: 総プロジェクト数・総チケット数・残チケット数を表示する", () => {
    const el = ManagerSummaryView({ data: managerData, domain: "prjops" });
    // <p>{count}件</p> はJSX上 children=[count, "件"] の配列になる
    const countEls = findAllElements(
      el,
      (e) => Array.isArray(propsOf(e)["children"]) && (propsOf(e)["children"] as unknown[])[1] === "件",
    );
    const counts = countEls.map((e) => (propsOf(e)["children"] as unknown[])[0]);
    expect(counts).toContain(2);
    expect(counts).toContain(10);
    expect(counts).toContain(4);
  });

  it("AC-010-3: domain=prjopsのときチケットラベルが「課題・アクション」になる", () => {
    const el = ManagerSummaryView({ data: managerData, domain: "prjops" });
    const label = findElement(el, (e) => propsOf(e)["title"] === "総課題・アクション数");
    expect(label).not.toBeNull();
  });

  it("AC-010-3: domain=devopsのときチケットラベルが「インシデント」になる", () => {
    const el = ManagerSummaryView({ data: managerData, domain: "devops" });
    const label = findElement(el, (e) => propsOf(e)["title"] === "総インシデント数");
    expect(label).not.toBeNull();
  });

  it("AC-010-3: プロジェクト一覧DataTableに全プロジェクトのrowsを渡す", () => {
    const el = ManagerSummaryView({ data: managerData, domain: "prjops" });
    const table = findElement(
      el,
      (e) =>
        Array.isArray(propsOf(e)["rows"] as unknown[] | undefined) &&
        (propsOf(e)["rows"] as unknown[]).length === 2 &&
        (propsOf(e)["rows"] as Array<{ projectId?: string }>)[0]?.projectId === "PRJ-0001",
    );
    expect(table).not.toBeNull();
  });

  it("AC-010-3: バーンダウンのDataTableにweekLabel/opened/resolved/remainingを持つrowsを渡す", () => {
    const el = ManagerSummaryView({ data: managerData, domain: "prjops" });
    const table = findElement(
      el,
      (e) =>
        Array.isArray(propsOf(e)["rows"] as unknown[] | undefined) &&
        (propsOf(e)["rows"] as Array<{ weekLabel?: string }>)[0]?.weekLabel === "2026-01-01",
    );
    expect(table).not.toBeNull();
    expect(propsOf(table!)["rows"]).toEqual(managerData.burndown);
  });
});

const agentActivityData: AgentActivityData = {
  countsByStatus: { queued: 1, running: 2, pr_created: 3, failed: 1, cancelled: 0 },
  totalCount: 7,
  completionSuccessRatePct: 75,
  recentPullRequests: [
    {
      taskId: "T1",
      projectId: "PRJ-0001",
      prUrl: "https://github.com/org/repo/pull/1",
      branch: "agent/T1",
      createdAt: "2026-07-01T00:00:00Z",
    },
  ],
};

describe("AgentActivityView（ADR-0006 4b: AIコーディングエージェント稼働可視化）", () => {
  it("見出しにAIコーディングエージェント稼働状況のタイトルを表示する", () => {
    const el = AgentActivityView({ data: agentActivityData });
    const heading = findElement(el, (e) => e.type === "h1");
    expect(heading).not.toBeNull();
    expect(propsOf(heading!)["children"]).toBe("AIコーディングエージェント稼働状況");
  });

  it("総タスク数を表示する", () => {
    const el = AgentActivityView({ data: agentActivityData });
    const countEl = findElement(
      el,
      (e) => Array.isArray(propsOf(e)["children"]) && (propsOf(e)["children"] as unknown[])[0] === 7,
    );
    expect(countEl).not.toBeNull();
  });

  it("completionSuccessRatePctが数値のとき%表示になる", () => {
    const el = AgentActivityView({ data: agentActivityData });
    const pctText = findElement(el, (e) => propsOf(e)["children"] === "75.0%");
    expect(pctText).not.toBeNull();
  });

  it("completionSuccessRatePctがnullのとき「データなし」バッジを表示する", () => {
    const el = AgentActivityView({ data: { ...agentActivityData, completionSuccessRatePct: null } });
    const badgeText = findElement(el, (e) => propsOf(e)["children"] === "データなし");
    expect(badgeText).not.toBeNull();
  });

  it("直近PR一覧DataTableにrecentPullRequestsのrowsを渡す", () => {
    const el = AgentActivityView({ data: agentActivityData });
    const table = findElement(
      el,
      (e) =>
        Array.isArray(propsOf(e)["rows"] as unknown[] | undefined) &&
        (propsOf(e)["rows"] as Array<{ taskId?: string }>)[0]?.taskId === "T1",
    );
    expect(table).not.toBeNull();
    expect(propsOf(table!)["rows"]).toEqual(agentActivityData.recentPullRequests);
  });

  it("直近PRが0件のとき空のrowsをDataTableへ渡す", () => {
    const el = AgentActivityView({ data: { ...agentActivityData, recentPullRequests: [] } });
    const table = findElement(
      el,
      (e) => Array.isArray(propsOf(e)["rows"] as unknown[] | undefined) && propsOf(e)["columns"] !== undefined,
    );
    expect(table).not.toBeNull();
  });
});
