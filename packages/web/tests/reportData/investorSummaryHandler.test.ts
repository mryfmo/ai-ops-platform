import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleInvestorSummary } from "../../src/server/reportData/investorSummaryHandler";
import { InMemoryPrjopsReportDataProvider } from "../../src/server/reportData/prjopsReportData";

function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
  return { resolveByEmail: async () => personas };
}

const sessionWithEmail = async (): Promise<Session | null> =>
  ({ user: { email: "investor@example.com" }, expires: "2099-01-01T00:00:00.000Z" }) as Session;

describe("handleInvestorSummary [REQ-039, SPEC-INT-066, AC-039-1]", () => {
  it("AC-039-1: investorペルソナで投資家サマリを返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "investor",
        profile: "investor",
        visibility: {
          recipientStakeholderId: "STK-INV",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: ["PRJ-0001"],
        },
      },
    ];
    const res = await handleInvestorSummary({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      provider: new InMemoryPrjopsReportDataProvider(
        [
          {
            projectId: "PRJ-0001",
            name: "会社A",
            color: "green",
            startDate: "2026-01-01",
            endDate: "2026-03-31",
            progressPct: 80,
            highSeverityOpenIssueCount: 1,
            isOverdue: false,
            periodLabel: "2026-Q1",
            ownerName: "PM",
            revenue: 100,
          },
        ],
        [],
      ),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.find((kpi: { metricId: string }) => kpi.metricId === "revenue").value).toBe(100);
    expect(body.risks).toHaveLength(1);
  });

  it("AC-039-1: investorペルソナが無ければ403を返す", async () => {
    const res = await handleInvestorSummary({
      getSession: sessionWithEmail,
      resolver: resolverWith([
        {
          domain: "prjops",
          profile: "PRF-03",
          visibility: {
            recipientStakeholderId: "STK-MGR",
            recipientManagedProjectIds: ["PRJ-0001"],
            recipientAssignedProjectIds: [],
            recipientParticipatingProjectIds: [],
            investedProjectIds: [],
          },
        },
      ]),
      provider: new InMemoryPrjopsReportDataProvider([], []),
    });
    expect(res.status).toBe(403);
  });
});
