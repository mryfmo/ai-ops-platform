/**
 * @vitest-environment jsdom
 *
 * packages/web/tests/DashboardClient.test.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）。
 *   DashboardClientはfetchでビューを再取得するクライアントコンポーネントのため、
 *   ChatPanel.test.tsxと同様に @vitest-environment jsdom + react-dom/client + act で検証する。
 *   ChatPanel自体はvi.mockしonViewSpecReceivedを直接呼び出すことで、
 *   「ChatPanelからonViewSpecReceivedが呼ばれたら対応する/api/data/*をfetchしてビューを
 *   再レンダリングする」というDashboardClient自体の責務のみを検証する。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// react-dom/testUtils の act() 警告抑止（jsdom環境でのReact 19 act()サポートフラグ）
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let capturedOnViewSpecReceived: ((spec: { kind: string; periodDays?: number }) => void) | null = null;

vi.mock("../src/components/chat/ChatPanel", () => ({
  ChatPanel: (props: { onViewSpecReceived: (spec: { kind: string; periodDays?: number }) => void }) => {
    capturedOnViewSpecReceived = props.onViewSpecReceived;
    return null;
  },
}));

const { DashboardClient } = await import("../src/components/DashboardClient");

function setupContainer(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

const executiveInitialData = {
  kind: "executiveSummary" as const,
  data: {
    projects: [{ projectId: "PRJ-0001", name: "案件A", keys: [] }],
  },
};

beforeEach(() => {
  capturedOnViewSpecReceived = null;
  vi.restoreAllMocks();
});

describe("DashboardClient（ADR-0005: 初期表示）", () => {
  it("initialDataがexecutiveSummaryのとき経営ダッシュボードの見出しを表示する", () => {
    const { container, root } = setupContainer();
    act(() => {
      root.render(
        <DashboardClient initialViewSpec={{ kind: "executiveSummary" }} initialData={executiveInitialData} />,
      );
    });
    expect(container.textContent).toContain("経営ダッシュボード");
    act(() => root.unmount());
  });
});

describe("DashboardClient（ADR-0005: onViewSpecReceivedによる再取得と表示切替）", () => {
  it("kind=managerSummaryを受け取るとmanager-summaryをfetchしマネージャーダッシュボードへ切り替える", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        domain: "prjops",
        totalProjectCount: 1,
        projects: [{ projectId: "PRJ-0001", name: "案件A", periodLabel: "2026-01", ownerName: "山田" }],
        totalTicketCount: 5,
        remainingTicketCount: 2,
        burndown: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container, root } = setupContainer();
    act(() => {
      root.render(
        <DashboardClient initialViewSpec={{ kind: "executiveSummary" }} initialData={executiveInitialData} />,
      );
    });

    expect(capturedOnViewSpecReceived).not.toBeNull();
    await act(async () => {
      capturedOnViewSpecReceived!({ kind: "managerSummary" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/app/api/data/manager-summary"));
    expect(container.textContent).toContain("マネージャーダッシュボード");
    act(() => root.unmount());
  });

  it("kind=projectListを受け取るとprojectsをfetchしプロジェクト一覧へ切り替える", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ domain: "prjops", projects: [{ id: "PRJ-0001", name: "案件A" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container, root } = setupContainer();
    act(() => {
      root.render(
        <DashboardClient initialViewSpec={{ kind: "executiveSummary" }} initialData={executiveInitialData} />,
      );
    });

    await act(async () => {
      capturedOnViewSpecReceived!({ kind: "projectList" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/app/api/data/projects"));
    expect(container.textContent).toContain("プロジェクト一覧");
    expect(container.textContent).toContain("案件A");
    act(() => root.unmount());
  });

  it("kind=agentActivityを受け取るとagent-activityをfetchしAI稼働状況ビューへ切り替える", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        countsByStatus: { queued: 0, running: 1, pr_created: 2, failed: 0, cancelled: 0 },
        totalCount: 3,
        completionSuccessRatePct: 100,
        recentPullRequests: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container, root } = setupContainer();
    act(() => {
      root.render(
        <DashboardClient initialViewSpec={{ kind: "executiveSummary" }} initialData={executiveInitialData} />,
      );
    });

    await act(async () => {
      capturedOnViewSpecReceived!({ kind: "agentActivity" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/app/api/data/agent-activity"));
    expect(container.textContent).toContain("AIコーディングエージェント稼働状況");
    act(() => root.unmount());
  });

  it("kind=investorSummaryを受け取るとinvestor-summaryをfetchしInvestor Reportへ切り替える", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ highlights: ["1 portfolio companies"], kpis: [], milestones: [], risks: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container, root } = setupContainer();
    act(() => {
      root.render(
        <DashboardClient initialViewSpec={{ kind: "executiveSummary" }} initialData={executiveInitialData} />,
      );
    });

    await act(async () => {
      capturedOnViewSpecReceived!({ kind: "investorSummary" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/app/api/data/investor-summary"));
    expect(container.textContent).toContain("Investor Report");
    act(() => root.unmount());
  });

  it("fetchが失敗した場合エラーメッセージを表示する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const { container, root } = setupContainer();
    act(() => {
      root.render(
        <DashboardClient initialViewSpec={{ kind: "executiveSummary" }} initialData={executiveInitialData} />,
      );
    });

    await act(async () => {
      capturedOnViewSpecReceived!({ kind: "projectList" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("エラー");
    act(() => root.unmount());
  });
});

describe("DashboardClient（ADR-0007: 動的期間ダッシュボード）", () => {
  it("期間ボタンを押すと選択期間つきでsummaryとtimeseriesをfetchする", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          domain: "prjops",
          totalProjectCount: 0,
          projects: [],
          totalTicketCount: 0,
          remainingTicketCount: 0,
          burndown: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          period: "week",
          baseDate: "2026-07-09",
          range: { start: "2026-07-06T00:00:00+09:00", end: "2026-07-13T00:00:00+09:00", label: "2026-W28" },
          buckets: [],
          totals: { opened: 1, closed: 0, statusTransitions: 0, milestoneCompleted: 0, deployments: 0 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { container, root } = setupContainer();
    act(() => {
      root.render(
        <DashboardClient
          initialViewSpec={{ kind: "managerSummary" }}
          initialData={{
            kind: "managerSummary",
            domain: "prjops",
            data: { totalProjectCount: 0, projects: [], totalTicketCount: 0, remainingTicketCount: 0, burndown: [] },
          }}
        />,
      );
    });

    await act(async () => {
      container.querySelectorAll("button")[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/app/api/data/manager-summary?"));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/app/api/data/timeseries?"));
    expect(container.textContent).toContain("時系列スナップショット");
    act(() => root.unmount());
  });
});
