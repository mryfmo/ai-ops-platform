/**
 * 根拠: P010-F02-T08 / ADR-0005 / ADR-0013 / PrjOps:REQ-041 / DevOps:REQ-041
 *
 * production 9 surfaceが共有poolと同じpinned providerを使い、
 * active personaのallow/denyと未設定時のfail-closedを維持することを検証する。
 */
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    records: [] as Array<Record<string, unknown>>,
    devopsRows: [] as Array<Record<string, unknown>>,
  };
  const provider = {
    findBySubject: vi.fn(async () => state.records),
    query: vi.fn(async () => ({
      projects: [],
      issuesAndActions: [],
      sevenKeysMonthlySnapshots: [],
      sevenKeysQuestionnaires: [],
      investorFinancialInputs: {},
      investorBoardPackInputs: {},
    })),
  };
  const pool = {
    query: vi.fn(async (sql: string) => ({
      rows: sql.includes("FROM recipients") ? state.devopsRows : [],
    })),
  };
  return {
    state,
    provider,
    pool,
    auth: vi.fn(),
    getPool: vi.fn(() => pool),
    createProvider: vi.fn(() => provider),
    cookie: "prjops:PRF-04:global",
  };
});

vi.mock("../src/auth", () => ({ auth: mocks.auth }));
vi.mock("../src/server/config", () => ({
  loadWebConfig: () => ({
    DATABASE_URL: "postgresql://composition-test",
    ANTHROPIC_DEFAULT_MODEL: "claude-sonnet-4-6",
    ANTHROPIC_PRICING_USD_PER_MTOK: {},
    PRJOPS_DATA_DIR: "/snapshot",
    PRJOPS_DATA_COMMIT_SHA: "a".repeat(40),
    PRJOPS_DATA_SOURCE_COMMIT_SHA: "a".repeat(40),
    PRJOPS_DATA_CONTENT_SHA256: "b".repeat(64),
  }),
}));
vi.mock("../src/server/db/pool", () => ({ getPool: mocks.getPool }));
vi.mock("../src/server/reportData/pinnedPrjopsReportDataProvider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/server/reportData/pinnedPrjopsReportDataProvider")>()),
  createPinnedPrjopsReportDataProvider: mocks.createProvider,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: mocks.cookie }) }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { PrjopsDataUnavailableError } = await import("../src/server/reportData/pinnedPrjopsReportDataProvider");
const { default: DashboardPage } = await import("../src/app/dashboard/page");
const { POST: postChat } = await import("../src/app/api/chat/route");
const { POST: postPersona } = await import("../src/app/api/persona/route");
const { GET: getExecutive } = await import("../src/app/api/data/executive-summary/route");
const { GET: getManager } = await import("../src/app/api/data/manager-summary/route");
const { GET: getInvestor } = await import("../src/app/api/data/investor-summary/route");
const { GET: getProjects } = await import("../src/app/api/data/projects/route");
const { GET: getTimeseries } = await import("../src/app/api/data/timeseries/route");
const { GET: getAgentActivity } = await import("../src/app/api/data/agent-activity/route");

const subject = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  objectId: "22222222-2222-2222-2222-222222222222",
};

function stakeholder(
  domain: "prjops" | "investor",
  profile: "PRF-02" | "PRF-03" | "PRF-04" | "investor",
  scope: { mode: "project"; projectId: string } | { mode: "global"; projectId: null },
): Record<string, unknown> {
  return {
    stakeholderId: "ST-001",
    subject,
    active: true,
    assignmentActive: true,
    domain,
    profile,
    scope,
  };
}

const prjopsCases = [
  {
    name: "chat",
    record: stakeholder("prjops", "PRF-04", { mode: "global", projectId: null }),
    invoke: () =>
      postChat(
        new Request("https://dashboard.example/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [] }),
        }),
      ),
    allowedStatus: 503,
  },
  {
    name: "persona",
    record: stakeholder("prjops", "PRF-04", { mode: "global", projectId: null }),
    invoke: () =>
      postPersona(
        new Request("https://dashboard.example/app/api/persona", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "https://dashboard.example" },
          body: JSON.stringify({ persona: "prjops:PRF-04:global" }),
        }),
      ),
    allowedStatus: 200,
  },
  {
    name: "executive-summary",
    record: stakeholder("prjops", "PRF-04", { mode: "global", projectId: null }),
    invoke: () => getExecutive(new Request("https://dashboard.example/api/data/executive-summary")),
    allowedStatus: 200,
  },
  {
    name: "manager-summary",
    record: stakeholder("prjops", "PRF-03", { mode: "project", projectId: "PJ-001" }),
    invoke: () => getManager(new Request("https://dashboard.example/api/data/manager-summary")),
    allowedStatus: 200,
  },
  {
    name: "investor-summary",
    record: stakeholder("investor", "investor", { mode: "project", projectId: "PJ-001" }),
    invoke: () => getInvestor(new Request("https://dashboard.example/api/data/investor-summary")),
    allowedStatus: 200,
  },
  {
    name: "projects",
    record: stakeholder("prjops", "PRF-02", { mode: "project", projectId: "PJ-001" }),
    invoke: () => getProjects(new Request("https://dashboard.example/api/data/projects")),
    allowedStatus: 200,
  },
  {
    name: "timeseries",
    record: stakeholder("prjops", "PRF-02", { mode: "project", projectId: "PJ-001" }),
    invoke: () => getTimeseries(new Request("https://dashboard.example/api/data/timeseries?baseDate=2026-07-01")),
    allowedStatus: 200,
  },
] as const;

const apiInvocations = [
  ...prjopsCases.map(({ name, invoke }) => ({ name, invoke })),
  {
    name: "agent-activity",
    invoke: () => getAgentActivity(new Request("https://dashboard.example/api/data/agent-activity")),
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.records = [];
  mocks.state.devopsRows = [];
  mocks.cookie = "prjops:PRF-04:global";
  mocks.createProvider.mockImplementation(() => mocks.provider);
  mocks.auth.mockResolvedValue({
    user: { subject, roles: [] },
    expires: "2099-01-01T00:00:00.000Z",
  });
});

describe("production composition allow/deny matrix [P010-F02-T08]", () => {
  it("dashboardはactive providerを使い、assignment欠如を空の正常データとして扱わない", async () => {
    mocks.state.records = [stakeholder("prjops", "PRF-04", { mode: "global", projectId: null })];
    await DashboardPage();
    expect(mocks.provider.query).toHaveBeenCalledOnce();

    mocks.state.records = [];
    mocks.provider.query.mockClear();
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("表示できるペルソナがありません");
    expect(mocks.provider.query).not.toHaveBeenCalled();
  });

  it.each(prjopsCases)("$nameはactive assignmentを許可し、欠如を403にする", async (testCase) => {
    mocks.state.records = [testCase.record];
    expect((await testCase.invoke()).status).toBe(testCase.allowedStatus);

    mocks.state.records = [];
    expect((await testCase.invoke()).status).toBe(403);
  });

  it("agent-activityはactive DevOps assignmentだけを許可する", async () => {
    mocks.state.devopsRows = [
      {
        user_id: "U1",
        profile: "PRF-G",
        projects: [],
        scope_mode: "global",
        active: true,
        backfill_state: "applied",
      },
    ];
    expect((await getAgentActivity(new Request("https://dashboard.example/api/data/agent-activity"))).status).toBe(200);

    mocks.state.devopsRows = [];
    expect((await getAgentActivity(new Request("https://dashboard.example/api/data/agent-activity"))).status).toBe(403);
  });
});

describe("production composition fail-closed and reuse [P010-F02-T08]", () => {
  it.each(apiInvocations)("$nameはPrjOps data設定欠如を503にする", async ({ invoke }) => {
    mocks.createProvider.mockImplementationOnce(() => {
      throw new PrjopsDataUnavailableError("missing");
    });
    expect((await invoke()).status).toBe(503);
  });

  it("dashboardはPrjOps data設定欠如を明示する", async () => {
    mocks.createProvider.mockImplementationOnce(() => {
      throw new PrjopsDataUnavailableError("missing");
    });
    expect(renderToStaticMarkup(await DashboardPage())).toContain("PrjOps データを利用できません");
  });

  it("9 production surfaceが同じpool/factory policyだけを使う", async () => {
    const files = [
      "src/app/dashboard/page.tsx",
      "src/app/api/chat/route.ts",
      "src/app/api/persona/route.ts",
      "src/app/api/data/executive-summary/route.ts",
      "src/app/api/data/manager-summary/route.ts",
      "src/app/api/data/investor-summary/route.ts",
      "src/app/api/data/projects/route.ts",
      "src/app/api/data/timeseries/route.ts",
      "src/app/api/data/agent-activity/route.ts",
    ];
    for (const file of files) {
      const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
      expect(source).toContain("getPool");
      expect(source).toContain("createPinnedPrjopsReportDataProvider");
      expect(source).not.toMatch(/new InMemory(?:PrjopsReportDataProvider|StakeholderMasterProvider)\(\[\]/);
    }
  });
});
