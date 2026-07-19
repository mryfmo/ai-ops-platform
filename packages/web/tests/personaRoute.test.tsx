/**
 * packages/web/tests/personaRoute.test.tsx
 *
 * 根拠: P010-F02-T08 / ADR-0005 / ADR-0013 / REQ-041 / SPEC-INT-068。
 * ペルソナ選択 route の入力・same-origin・認可と、古いSSR選択時の表示を検証する。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookie: "prjops:PRF-04:global",
  query: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("pg", () => ({
  default: {
    Pool: class {
      query = mocks.query;
    },
  },
}));
vi.mock("../src/auth", () => ({ auth: mocks.auth }));
vi.mock("../src/server/config", () => ({ loadWebConfig: () => ({ DATABASE_URL: "postgres://test" }) }));
vi.mock("../src/server/reportData/pinnedPrjopsReportDataProvider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/server/reportData/pinnedPrjopsReportDataProvider")>()),
  createPinnedPrjopsReportDataProvider: () => ({
    findBySubject: async () => [],
    query: async () => ({
      projects: [],
      issuesAndActions: [],
      sevenKeysMonthlySnapshots: [],
      sevenKeysQuestionnaires: [],
      investorFinancialInputs: {},
      investorBoardPackInputs: {},
    }),
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: mocks.cookie }) }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { POST } = await import("../src/app/api/persona/route");
const { default: DashboardPage } = await import("../src/app/dashboard/page");

const URL = "https://dashboard.example/app/api/persona";

function request(body: string, origin?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin) headers.set("Origin", origin);
  return new Request(URL, { method: "POST", headers, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookie = "prjops:PRF-04:global";
  mocks.auth.mockResolvedValue({
    user: {
      subject: {
        tenantId: "11111111-1111-1111-1111-111111111111",
        objectId: "22222222-2222-2222-2222-222222222222",
      },
      roles: [],
    },
    expires: "2099-01-01T00:00:00.000Z",
  });
  mocks.query.mockResolvedValue({
    rows: [
      {
        user_id: "U1",
        profile: "PRF-G",
        projects: [],
        scope_mode: "global",
        active: true,
        backfill_state: "applied",
      },
    ],
  });
});

describe("POST /api/persona [REQ-041 / SPEC-INT-068]", () => {
  it("malformed・missing・non-string personaを400にする [REQ-041 / SPEC-INT-068]", async () => {
    for (const body of ["{", "{}", '{"persona":1}', '{"persona":""}']) {
      const response = await POST(request(body, "https://dashboard.example"));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "E-PERSONA01: persona must be a non-empty string" });
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("Origin欠落・別サイト・same-site別originを403にする [REQ-041 / SPEC-INT-068]", async () => {
    for (const origin of [undefined, "https://evil.example", "https://other.dashboard.example"]) {
      const response = await POST(request('{"persona":"devops:PRF-G:global"}', origin));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "E-ORIGIN01: same-origin request required" });
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("exact same-originかつ保有中の選択だけを保存する [REQ-041 / SPEC-INT-068]", async () => {
    const response = await POST(request('{"persona":"devops:PRF-G:global"}', "https://dashboard.example"));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("aiops-persona=devops:PRF-G:global");
  });

  it("構文上正しい未保有・古いペルソナは403にする [REQ-041 / SPEC-INT-068]", async () => {
    const response = await POST(request('{"persona":"prjops:PRF-04:PJ-001"}', "https://dashboard.example"));
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("Dashboard SSR [REQ-041 / SPEC-INT-068]", () => {
  it("古いCookie選択ではアクセス拒否を正直に表示しHTTP 403とは表記しない [REQ-041 / SPEC-INT-068]", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("選択したペルソナを利用できません");
    expect(html).not.toContain("403:");
    expect(html).toContain("DevOps PRF-G");
  });
});
