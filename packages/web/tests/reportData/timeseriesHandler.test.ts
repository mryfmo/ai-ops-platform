/**
 * packages/web/tests/reportData/timeseriesHandler.test.ts
 *
 * 根拠: ADR-0007 / REQ-036 / PrjOps:SPEC-INT-062 / DevOps:REQ-031 / SPEC-INT-081。
 */
import { describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleTimeseries } from "../../src/server/reportData/timeseriesHandler";

const sessionWithEmail = async (): Promise<Session | null> =>
  ({ user: { email: "exec@example.com" }, expires: "2099-01-01T00:00:00.000Z" }) as Session;

function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
  return { resolveByEmail: async () => personas };
}

describe("handleTimeseries (ADR-0007)", () => {
  it("REQ-036 / PrjOps:SPEC-INT-062: persona scopeでpm_events/pm_snapshotsを絞って集計する", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "prjops",
        profile: "PRF-03",
        visibility: {
          recipientStakeholderId: "ST-001",
          recipientManagedProjectIds: ["PJ-001"],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
        },
      },
    ];
    const db: PgQueryable = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pm_events")) {
          return {
            rows: [
              {
                event_name: "issues",
                action: "opened",
                project_id: "PJ-001",
                occurred_at: "2026-07-09T00:00:00+09:00",
                from_status: null,
                to_status: null,
              },
              {
                event_name: "issues",
                action: "opened",
                project_id: "PJ-999",
                occurred_at: "2026-07-09T00:00:00+09:00",
                from_status: null,
                to_status: null,
              },
            ],
          };
        }
        return {
          rows: [
            { project_id: "PJ-001", source_type: "issue", state: "open", captured_at: "2026-07-09T00:00:00+09:00" },
          ],
        };
      }),
    };
    const res = await handleTimeseries({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      db,
      period: "week",
      baseDate: "2026-07-09",
      persona: "manager",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals.opened).toBe(1);
    expect(body.buckets.some((bucket: { burndownRemaining: number }) => bucket.burndownRemaining === 1)).toBe(true);
  });

  it("PrjOps:SPEC-INT-062: personaが無ければ403を返す", async () => {
    const res = await handleTimeseries({
      getSession: sessionWithEmail,
      resolver: resolverWith([]),
      db: { query: vi.fn() },
      period: "month",
      baseDate: "2026-07-09",
    });
    expect(res.status).toBe(403);
  });

  it("L1-7: 不正baseDateはクライアントエラーとして400を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "prjops",
        profile: "PRF-03",
        visibility: {
          recipientStakeholderId: "ST-001",
          recipientManagedProjectIds: ["PJ-001"],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
        },
      },
    ];
    const res = await handleTimeseries({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      db: { query: vi.fn() },
      period: "week",
      baseDate: "2026-13-45",
    });
    expect(res.status).toBe(400);
  });

  it("L1b-2: pm_eventsのdeployment_statusをDeploy数として集計する", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-G",
        visibility: {
          recipientUserId: "ST-001",
          recipientAssignedProjectIds: [],
        },
      },
    ];
    const db: PgQueryable = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pm_events")) {
          return {
            rows: [
              {
                event_name: "deployment_status",
                action: "created",
                project_id: null,
                occurred_at: "2026-07-09T00:01:00+09:00",
                from_status: null,
                to_status: null,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const res = await handleTimeseries({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      db,
      period: "week",
      baseDate: "2026-07-09",
      persona: "manager",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ totals: { deployments: 1 } });
  });
});
