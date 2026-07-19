/**
 * packages/web/tests/projectSelection.test.ts
 *
 * 根拠: P010-F02-T10 / DEC-SPEC-008 / PrjOps:REQ-041 / DevOps:REQ-041。
 * URL の project 値を scoped project 一覧へ照合し、domain query 前の 200/409/400/403 境界を検証する。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  portfolioAllowedForPersona,
  ProjectSelectionError,
  parseProjectSelection,
  resolveProjectSelection,
} from "../src/server/projectSelection";

const pageMocks = vi.hoisted(() => {
  const projects = [
    { projectId: "PJ-001", name: "案件A" },
    { projectId: "PJ-002", name: "案件B" },
  ];
  const provider = {
    findBySubject: vi.fn(async () => [
      {
        stakeholderId: "ST-001",
        subject: {
          tenantId: "11111111-1111-1111-1111-111111111111",
          objectId: "22222222-2222-2222-2222-222222222222",
        },
        active: true,
        assignmentActive: true,
        domain: "prjops",
        profile: "PRF-04",
        scope: { mode: "global", projectId: null },
      },
    ]),
    query: vi.fn(async () => ({
      projects,
      issuesAndActions: [],
      sevenKeysMonthlySnapshots: [],
      sevenKeysQuestionnaires: [],
      investorFinancialInputs: {},
      investorBoardPackInputs: {},
    })),
  };
  return {
    projects,
    provider,
    auth: vi.fn(async () => ({
      user: {
        subject: {
          tenantId: "11111111-1111-1111-1111-111111111111",
          objectId: "22222222-2222-2222-2222-222222222222",
        },
        roles: [],
      },
      expires: "2099-01-01T00:00:00.000Z",
    })),
  };
});

vi.mock("../src/auth", () => ({ auth: pageMocks.auth }));
vi.mock("../src/server/config", () => ({
  loadWebConfig: () => ({ DATABASE_URL: "postgresql://selection-test" }),
}));
vi.mock("../src/server/db/pool", () => ({
  getPool: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));
vi.mock("../src/server/reportData/pinnedPrjopsReportDataProvider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/server/reportData/pinnedPrjopsReportDataProvider")>()),
  createPinnedPrjopsReportDataProvider: () => pageMocks.provider,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "prjops:PRF-04:global" }) }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { default: DashboardPage } = await import("../src/app/dashboard/page");

const projects = [
  { id: "PJ-002", name: "同名" },
  { id: "PJ-001", name: "同名" },
];

function statusOf(value: string | string[] | undefined, options = projects, portfolioAllowed = false): number {
  try {
    resolveProjectSelection(value, options, portfolioAllowed);
    return 200;
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectSelectionError);
    return (error as ProjectSelectionError).status;
  }
}

describe("project selection parser [PrjOps:REQ-041 / DevOps:REQ-041 / DEC-SPEC-008]", () => {
  it("missing・canonical PJ-*・all を分類する", () => {
    expect(parseProjectSelection(undefined)).toEqual({ kind: "missing" });
    expect(parseProjectSelection("PJ-001")).toEqual({ kind: "project", projectId: "PJ-001" });
    expect(parseProjectSelection("all")).toEqual({ kind: "all" });
  });

  it.each(["", "pj-001", "ＰＪ-００１", "PJ-001/..", "PJ-001%2F..", "PJ-01", "PJ-001 "])(
    "case・Unicode・traversal・非canonical値 %s を400にする",
    (value) => {
      expect(statusOf(value)).toBe(400);
    },
  );

  it("repeated parameterを400にする", () => {
    expect(statusOf(["PJ-001", "PJ-002"])).toBe(400);
  });
});

describe("project selection resolver [PrjOps:REQ-041 / DevOps:REQ-041 / DEC-SPEC-008]", () => {
  it("1件だけなら未指定から自動選択する", () => {
    expect(resolveProjectSelection(undefined, [{ id: "PJ-001", name: "案件A" }], false)).toEqual({
      options: [{ id: "PJ-001", name: "案件A" }],
      selected: "PJ-001",
      autoSelected: true,
    });
  });

  it("複数件未指定は409 E-AUTH04にする", () => {
    expect(statusOf(undefined)).toBe(409);
    expect(() => resolveProjectSelection(undefined, projects, false)).toThrow("E-AUTH04: project_selection_required");
  });

  it("scoped一覧をID・表示名の順で固定し、同名をIDで区別する", () => {
    expect(resolveProjectSelection("PJ-002", projects, false)).toEqual({
      options: [
        { id: "PJ-001", name: "同名" },
        { id: "PJ-002", name: "同名" },
      ],
      selected: "PJ-002",
      autoSelected: false,
    });
  });

  it.each(["PJ-003", "PJ-404"])("unknown・stale・別tenant/persona/scopeの %s を403にする", (value) => {
    expect(statusOf(value)).toBe(403);
  });

  it("allはglobal portfolio権限で明示された場合だけ許可する", () => {
    expect(statusOf("all", projects, false)).toBe(403);
    expect(resolveProjectSelection("all", projects, true)).toEqual({
      options: [
        { id: "PJ-001", name: "同名" },
        { id: "PJ-002", name: "同名" },
      ],
      selected: "all",
      autoSelected: false,
    });
  });

  it("アクセス可能projectが0件ならclient値に関係なく403にする", () => {
    expect(statusOf(undefined, [])).toBe(403);
    expect(statusOf("PJ-001", [])).toBe(403);
  });

  it("非canonicalなscoped optionは自動選択もURL化もしない", () => {
    expect(statusOf(undefined, [{ id: "PRJ-001", name: "legacy" }])).toBe(403);
    expect(statusOf("PJ-001", [{ id: "PRJ-001", name: "legacy" }])).toBe(403);
  });
});

describe("portfolio selection roles [PrjOps:REQ-041 / DevOps:REQ-041 / DEC-SPEC-008]", () => {
  it("active global PRF-04/PRF-Gだけを許可し、project-scoped PRF-Gを拒否する", () => {
    expect(
      portfolioAllowedForPersona({
        domain: "prjops",
        profile: "PRF-04",
        scope: { mode: "global", projectId: null },
        visibility: {
          recipientStakeholderId: "ST-001",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
          scopeMode: "global",
        },
      }),
    ).toBe(true);
    expect(
      portfolioAllowedForPersona({
        domain: "devops",
        profile: "PRF-G",
        scope: { mode: "global", projectId: null },
        visibility: { recipientUserId: "U-001", recipientAssignedProjectIds: [], scopeMode: "global" },
      }),
    ).toBe(true);
    expect(
      portfolioAllowedForPersona({
        domain: "devops",
        profile: "PRF-G",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: { recipientUserId: "U-001", recipientAssignedProjectIds: ["PJ-001"], scopeMode: "project" },
      }),
    ).toBe(false);
  });
});

describe("Dashboard project query boundary [PrjOps:REQ-041 / DevOps:REQ-041 / DEC-SPEC-008]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("malformed URLはscoped/detail data queryを開始しない", async () => {
    await DashboardPage({ searchParams: Promise.resolve({ project: "pj-001" }) });
    expect(pageMocks.provider.query).not.toHaveBeenCalled();
  });

  it("unknown・別persona URLはscoped照合だけで止まりdetail queryを開始しない", async () => {
    await DashboardPage({ searchParams: Promise.resolve({ project: "PJ-404" }) });
    expect(pageMocks.provider.query).toHaveBeenCalledOnce();
  });

  it("複数件未選択はscoped照合だけで409 controlに止まる", async () => {
    await DashboardPage();
    expect(pageMocks.provider.query).toHaveBeenCalledOnce();
  });

  it("scoped一覧にあるexact IDだけがdetail queryへ進む", async () => {
    await DashboardPage({ searchParams: Promise.resolve({ project: "PJ-001" }) });
    expect(pageMocks.provider.query).toHaveBeenCalledTimes(2);
  });
});
