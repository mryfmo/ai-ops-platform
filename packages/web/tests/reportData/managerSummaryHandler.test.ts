/**
 * packages/web/tests/reportData/managerSummaryHandler.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/manager-summary の
 *   未認証401・権限外403・正当なセッションでのデータ返却（PrjOps/DevOps双方）を検証する。
 */
import { describe, it, expect, vi } from "vitest";
import type { Session } from "next-auth";
import type { PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleManagerSummary } from "../../src/server/reportData/managerSummaryHandler";
import { InMemoryPrjopsReportDataProvider } from "../../src/server/reportData/prjopsReportData";

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

const basePeriod = { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-15T00:00:00.000Z" };

describe("handleManagerSummary（未認証401）", () => {
  it("セッションが無い場合401を返す", async () => {
    const res = await handleManagerSummary({
      getSession: async () => null,
      resolver: resolverWith([]),
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: emptyDb(),
      ...basePeriod,
    });
    expect(res.status).toBe(401);
  });
});

describe("handleManagerSummary（権限外403）", () => {
  it("PRF-03/PRF-Gいずれも無い場合403を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-M",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
      },
    ];
    const res = await handleManagerSummary({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: emptyDb(),
      ...basePeriod,
    });
    expect(res.status).toBe(403);
  });
});

describe("handleManagerSummary（正当なセッション: データ返却）", () => {
  it("PRF-03ペルソナがあればPrjOpsサマリを200で返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "prjops",
        profile: "PRF-03",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: {
          recipientStakeholderId: "STK-001",
          recipientManagedProjectIds: ["PRJ-0001"],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
        },
      },
    ];
    const res = await handleManagerSummary({
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
      ...basePeriod,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.domain).toBe("prjops");
    expect(body.totalProjectCount).toBe(1);
  });

  it("PRF-Gペルソナがあれば（PRF-03が無い場合）DevOpsサマリを200で返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-G",
        scope: { mode: "global", projectId: null },
        visibility: { recipientUserId: "U9", recipientAssignedProjectIds: [] },
      },
    ];
    const db: PgQueryable = {
      query: vi.fn(async (text: string) => {
        if (text.includes("project_channels")) return { rows: [{ project_id: "PRJ-0001" }] };
        return { rows: [] };
      }),
    };
    const res = await handleManagerSummary({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: db,
      ...basePeriod,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.domain).toBe("devops");
    expect(body.totalProjectCount).toBe(1);
  });

  it("PrjOps/DevOps両ペルソナを持つ場合exact selectorでPrjOps(PRF-03)を選ぶ", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-G",
        scope: { mode: "global", projectId: null },
        visibility: { recipientUserId: "U9", recipientAssignedProjectIds: [] },
      },
      {
        domain: "prjops",
        profile: "PRF-03",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: {
          recipientStakeholderId: "STK-001",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
        },
      },
    ];
    const res = await handleManagerSummary({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      prjopsProvider: new InMemoryPrjopsReportDataProvider([], []),
      devopsDb: emptyDb(),
      selectedPersona: "prjops:PRF-03:PJ-001",
      ...basePeriod,
    });
    const body = await res.json();
    expect(body.domain).toBe("prjops");
  });
});
