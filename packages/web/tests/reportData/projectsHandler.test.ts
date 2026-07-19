/**
 * packages/web/tests/reportData/projectsHandler.test.ts
 *
 * 根拠: P010-F02-T10 / DEC-SPEC-008 / ADR-0005（WebUIダッシュボード）。GET /api/data/projects の
 *   未認証401・権限外403・正当なセッションでのデータ返却（PrjOps/DevOps双方）を検証する。
 */
import { describe, it, expect, vi } from "vitest";
import type { Session } from "next-auth";
import type { PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleProjects } from "../../src/server/reportData/projectsHandler";
import { InMemoryPrjopsReportDataProvider } from "../../src/server/reportData/prjopsReportData";

const productionInit = vi.hoisted(() => ({
  auth: vi.fn(),
  loadConfig: vi.fn(() => {
    throw new Error("production DI must not run");
  }),
}));

vi.mock("../../src/auth", () => ({ auth: productionInit.auth }));
vi.mock("../../src/server/config", () => ({ loadWebConfig: productionInit.loadConfig }));

function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
  return { resolveBySubject: async () => personas };
}

const sessionWithEmail = async (): Promise<Session | null> =>
  ({
    user: {
      subject: {
        tenantId: "11111111-1111-1111-1111-111111111111",
        objectId: "22222222-2222-2222-2222-222222222222",
      },
      roles: [],
    },
    expires: "2099-01-01T00:00:00.000Z",
  }) as Session;

function emptyDb(): PgQueryable {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) };
}

describe("handleProjects（未認証401）", () => {
  it("セッションが無い場合401を返す", async () => {
    const res = await handleProjects({
      getSession: async () => null,
      resolver: resolverWith([]),
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: emptyDb(),
    });
    expect(res.status).toBe(401);
  });
});

describe("handleProjects（権限外403）", () => {
  it("該当ペルソナが無い場合403を返す", async () => {
    const res = await handleProjects({
      getSession: sessionWithEmail,
      resolver: resolverWith([]),
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: emptyDb(),
    });
    expect(res.status).toBe(403);
  });
});

describe("handleProjects（正当なセッション: データ返却）", () => {
  it("選択した2番目のペルソナをAPIでも使用する [PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "prjops",
        profile: "PRF-01",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: {
          recipientStakeholderId: "STK-001",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
        },
      },
      {
        domain: "devops",
        profile: "PRF-L",
        scope: { mode: "project", projectId: "PJ-002" },
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: ["PJ-002"], scopeMode: "project" },
      },
    ];
    const res = await handleProjects({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      selectedPersona: "devops:PRF-L:PJ-002",
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: { query: vi.fn().mockResolvedValue({ rows: [{ project_id: "PJ-002" }] }) },
    });
    expect(await res.json()).toEqual({
      domain: "devops",
      projects: [{ id: "PJ-002", name: "PJ-002" }],
      portfolioAllowed: false,
    });
  });

  it("prjopsペルソナが先頭ならPrjOps側のプロジェクト一覧を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "prjops",
        profile: "PRF-01",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: {
          recipientStakeholderId: "STK-001",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: ["PJ-001"],
          investedProjectIds: [],
        },
      },
    ];
    const res = await handleProjects({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      prjopsProvider: new InMemoryPrjopsReportDataProvider(
        [
          {
            projectId: "PJ-001",
            name: "案件A",
            color: "green",
            startDate: "2026-01-01",
            endDate: "2026-03-31",
            progressPct: 50,
            highSeverityOpenIssueCount: 0,
            isOverdue: false,
            periodLabel: "2026-01〜2026-03",
            ownerName: "山田太郎",
          },
        ],
        [],
      ),
      devopsDb: emptyDb(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      domain: "prjops",
      projects: [{ id: "PJ-001", name: "案件A" }],
      portfolioAllowed: false,
    });
  });

  it("devopsペルソナが先頭ならDevOps側のプロジェクト一覧を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-L",
        scope: { mode: "project", projectId: "PJ-002" },
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: ["PJ-002"], scopeMode: "project" },
      },
    ];
    const db: PgQueryable = {
      query: vi.fn().mockResolvedValue({ rows: [{ project_id: "PJ-002" }] }),
    };
    const res = await handleProjects({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: db,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      domain: "devops",
      projects: [{ id: "PJ-002", name: "PJ-002" }],
      portfolioAllowed: false,
    });
  });

  it("investorペルソナが先頭なら出資対象プロジェクト一覧を返す [REQ-039]", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "investor",
        profile: "investor",
        scope: { mode: "project", projectId: "PJ-0001" },
        visibility: {
          recipientStakeholderId: "STK-INV",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: ["PJ-003"],
        },
      },
    ];
    const res = await handleProjects({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      prjopsProvider: new InMemoryPrjopsReportDataProvider(
        [
          {
            projectId: "PJ-003",
            name: "会社C",
            color: "green",
            startDate: "2026-01-01",
            endDate: "2026-03-31",
            progressPct: 50,
            highSeverityOpenIssueCount: 0,
            isOverdue: false,
            periodLabel: "2026-Q1",
            ownerName: "PM",
          },
        ],
        [],
      ),
      devopsDb: emptyDb(),
    });
    expect(await res.json()).toEqual({
      domain: "investor",
      projects: [{ id: "PJ-003", name: "会社C" }],
      portfolioAllowed: false,
    });
  });
});

describe("handleProjects（DEC-SPEC-008: project parameter拒否）", () => {
  it("routeはproduction provider初期化より先にproject parameterを拒否する", async () => {
    const { GET } = await import("../../src/app/api/data/projects/route");
    const res = await GET(new Request("https://dashboard.example/app/api/data/projects?project=PJ-001"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "E-AUTH05: unexpected_project_parameter" });
    expect(productionInit.loadConfig).not.toHaveBeenCalled();
  });

  it.each(["?project=", "?project=PJ-001", "?project=pj-001", "?project=all", "?project=PJ-001&project=PJ-002"])(
    "parameter present %s は400 E-AUTH05かつquery 0",
    async (query) => {
      const getSession = vi.fn(sessionWithEmail);
      const resolver = { resolveBySubject: vi.fn(async () => []) };
      const provider = new InMemoryPrjopsReportDataProvider([], []);
      const db = emptyDb();
      const res = await handleProjects(
        {
          getSession,
          resolver,
          prjopsProvider: provider,
          devopsDb: db,
        },
        new Request(`https://dashboard.example/app/api/data/projects${query}`),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "E-AUTH05: unexpected_project_parameter" });
      expect(getSession).not.toHaveBeenCalled();
      expect(resolver.resolveBySubject).not.toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  it("parameter absentは200でglobal PRF-04だけportfolioAllowedを返す", async () => {
    const persona: ResolvedPersona = {
      domain: "prjops",
      profile: "PRF-04",
      scope: { mode: "global", projectId: null },
      visibility: {
        recipientStakeholderId: "STK-001",
        recipientManagedProjectIds: [],
        recipientAssignedProjectIds: [],
        recipientParticipatingProjectIds: [],
        investedProjectIds: [],
        scopeMode: "global",
      },
    };
    const res = await handleProjects(
      {
        getSession: sessionWithEmail,
        resolver: resolverWith([persona]),
        prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
        devopsDb: emptyDb(),
      },
      new Request("https://dashboard.example/app/api/data/projects"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ domain: "prjops", projects: [], portfolioAllowed: true });
  });
});
