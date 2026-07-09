/**
 * packages/web/tests/reportData/projectsHandler.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/projects の
 *   未認証401・権限外403・正当なセッションでのデータ返却（PrjOps/DevOps双方）を検証する。
 */
import { describe, it, expect, vi } from "vitest";
import type { Session } from "next-auth";
import type { PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleProjects } from "../../src/server/reportData/projectsHandler";
import { InMemoryPrjopsReportDataProvider } from "../../src/server/reportData/prjopsReportData";

function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
  return { resolveByEmail: async () => personas };
}

const sessionWithEmail = async (): Promise<Session | null> =>
  ({ user: { email: "user@example.com" }, expires: "2099-01-01T00:00:00.000Z" }) as Session;

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
  it("prjopsペルソナが先頭ならPrjOps側のプロジェクト一覧を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "prjops",
        profile: "PRF-01",
        visibility: {
          recipientStakeholderId: "STK-001",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: ["PRJ-0001"],
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
            projectId: "PRJ-0001",
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
    expect(body).toEqual({ domain: "prjops", projects: [{ id: "PRJ-0001", name: "案件A" }] });
  });

  it("devopsペルソナが先頭ならDevOps側のプロジェクト一覧を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-L",
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: ["PRJ-0002"] },
      },
    ];
    const db: PgQueryable = {
      query: vi.fn().mockResolvedValue({ rows: [{ project_id: "PRJ-0002" }] }),
    };
    const res = await handleProjects({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: db,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ domain: "devops", projects: [{ id: "PRJ-0002", name: "PRJ-0002" }] });
  });

  it("investorペルソナが先頭なら出資対象プロジェクト一覧を返す [REQ-039]", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "investor",
        profile: "investor",
        visibility: {
          recipientStakeholderId: "STK-INV",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: ["PRJ-0003"],
        },
      },
    ];
    const res = await handleProjects({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      prjopsProvider: new InMemoryPrjopsReportDataProvider(
        [
          {
            projectId: "PRJ-0003",
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
    expect(await res.json()).toEqual({ domain: "investor", projects: [{ id: "PRJ-0003", name: "会社C" }] });
  });
});
