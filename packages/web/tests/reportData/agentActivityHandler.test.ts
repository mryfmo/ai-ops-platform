/**
 * packages/web/tests/reportData/agentActivityHandler.test.ts
 *
 * 根拠: ADR-0006（AIコーディングエージェント統合）決定4b。GET /api/data/agent-activity の
 *   未認証401・PRF-G以外403・正当なセッションでのデータ返却を検証する。
 */
import { describe, it, expect, vi } from "vitest";
import type { Session } from "next-auth";
import type { PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleAgentActivity } from "../../src/server/reportData/agentActivityHandler";

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

describe("handleAgentActivity（未認証401）", () => {
  it("セッションが無い場合401を返す", async () => {
    const res = await handleAgentActivity({
      getSession: async () => null,
      resolver: resolverWith([]),
      devopsDb: emptyDb(),
    });
    expect(res.status).toBe(401);
  });
});

describe("handleAgentActivity（PRF-G以外403）", () => {
  it("devopsペルソナが無い場合403を返す", async () => {
    const res = await handleAgentActivity({
      getSession: sessionWithEmail,
      resolver: resolverWith([]),
      devopsDb: emptyDb(),
    });
    expect(res.status).toBe(403);
  });

  it("devops PRF-M（PRF-Gではない）の場合403を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-M",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [], scopeMode: "project" },
      },
    ];
    const res = await handleAgentActivity({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      devopsDb: emptyDb(),
    });
    expect(res.status).toBe(403);
  });

  it("devops PRF-L（PRF-Gではない）の場合403を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-L",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: ["PRJ-0001"], scopeMode: "project" },
      },
    ];
    const res = await handleAgentActivity({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      devopsDb: emptyDb(),
    });
    expect(res.status).toBe(403);
  });

  it("prjopsペルソナのみ（devopsが無い）場合403を返す", async () => {
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
    const res = await handleAgentActivity({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      devopsDb: emptyDb(),
    });
    expect(res.status).toBe(403);
  });
});

describe("handleAgentActivity（PRF-G: 正当なセッションでデータ返却）", () => {
  it("PRF-Gペルソナがあれば200でcoding_tasks集計を返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-G",
        scope: { mode: "global", projectId: null },
        visibility: { recipientUserId: "U9", recipientAssignedProjectIds: [], scopeMode: "global" },
      },
    ];
    const db: PgQueryable = {
      query: vi.fn(async (text: string) => {
        if (text.includes("FROM coding_tasks")) {
          return {
            rows: [
              {
                task_id: "T1",
                project_id: "PRJ-0001",
                status: "pr_created",
                agent: "claude-code",
                pr_url: "https://github.com/org/repo/pull/1",
                branch: "agent/T1",
                created_at: "2026-07-01T00:00:00Z",
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const res = await handleAgentActivity({
      getSession: sessionWithEmail,
      resolver: resolverWith(personas),
      devopsDb: db,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCount).toBe(1);
    expect(body.countsByStatus.pr_created).toBe(1);
    expect(body.recentPullRequests).toHaveLength(1);
  });
});
