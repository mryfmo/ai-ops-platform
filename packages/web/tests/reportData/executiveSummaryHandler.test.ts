/**
 * packages/web/tests/reportData/executiveSummaryHandler.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/executive-summary の
 *   未認証401・権限外403・正当なセッションでのデータ返却を検証する。
 */
import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleExecutiveSummary } from "../../src/server/reportData/executiveSummaryHandler";
import {
  InMemoryPrjopsReportDataProvider,
  type PrjopsProjectRecord,
} from "../../src/server/reportData/prjopsReportData";

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

describe("handleExecutiveSummary（未認証401）", () => {
  it("セッションが無い場合401を返す", async () => {
    const res = await handleExecutiveSummary({
      getSession: async () => null,
      resolver: resolverWith([]),
      provider: new InMemoryPrjopsReportDataProvider([], []),
    });
    expect(res.status).toBe(401);
  });
});

describe("handleExecutiveSummary（権限外403）", () => {
  it("prjopsペルソナが無い場合403を返す", async () => {
    const res = await handleExecutiveSummary({
      getSession: sessionWithEmail,
      resolver: resolverWith([]),
      provider: new InMemoryPrjopsReportDataProvider([], []),
    });
    expect(res.status).toBe(403);
  });

  it("prjopsペルソナはあるがPRF-04でない場合403を返す", async () => {
    const personas: ResolvedPersona[] = [
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
    const res = await handleExecutiveSummary({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      provider: new InMemoryPrjopsReportDataProvider([], []),
    });
    expect(res.status).toBe(403);
  });
});

describe("handleExecutiveSummary（正当なセッション: データ返却）", () => {
  it("PRF-04ペルソナがあればセブンキー数値を200で返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "prjops",
        profile: "PRF-04",
        scope: { mode: "global", projectId: null },
        visibility: {
          recipientStakeholderId: "STK-EXEC",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
        },
      },
    ];
    const projects: PrjopsProjectRecord[] = [
      {
        projectId: "PRJ-0001",
        name: "案件A",
        color: "green",
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        progressPct: 80,
        highSeverityOpenIssueCount: 0,
        isOverdue: false,
        scopeChangeCount: 0,
        averageReviewWaitHours: 12,
        activeContributorCount: 2,
        periodLabel: "2026-01〜2026-03",
        ownerName: "山田太郎",
      },
    ];
    const res = await handleExecutiveSummary({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      provider: new InMemoryPrjopsReportDataProvider(projects, []),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].keys).toHaveLength(7);
  });
});
