/**
 * packages/web/tests/dataApiPoolLoad.test.ts
 *
 * 根拠: ADR-0013 / PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068 / AUD-REL-001。
 * データAPI 500連投でもprocess-wide pool constructorが増えないことを測定する。
 */
import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { poolConstructor, query } = vi.hoisted(() => {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM recipients")) {
      return { rows: [{ user_id: "U1", profile: "PRF-G", projects: [], active: true }] };
    }
    return { rows: [] };
  });
  return {
    query,
    poolConstructor: vi.fn(
      class Pool {
        readonly query = query;
      },
    ),
  };
});

vi.mock("pg", () => ({ default: { Pool: poolConstructor } }));
vi.mock("../src/auth", () => ({
  auth: async () => ({ user: { email: "manager@example.com" }, expires: "2099-01-01T00:00:00.000Z" }),
}));
vi.mock("../src/server/config", () => ({ loadWebConfig: () => ({ DATABASE_URL: "postgresql://load-stub" }) }));

describe("web data API pool load baseline [PrjOps:REQ-041 / DevOps:REQ-041 PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]", () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & { __aiopsPgPool?: unknown }).__aiopsPgPool;
    poolConstructor.mockClear();
    query.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { __aiopsPgPool?: unknown }).__aiopsPgPool;
  });

  it("keeps one pool across 500 consecutive data API requests", async () => {
    const { GET } = await import("../src/app/api/data/projects/route");
    const request = new Request("https://example.invalid/api/data/projects");
    const startedAt = performance.now();
    for (let index = 0; index < 500; index += 1) {
      expect((await GET(request)).status).toBe(200);
    }
    const elapsedMs = performance.now() - startedAt;

    expect(poolConstructor).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledTimes(1_000);
    console.info(
      JSON.stringify({
        metric: "web_data_api_pool_stability",
        requests: 500,
        elapsedMs: Number(elapsedMs.toFixed(3)),
        poolConstructors: poolConstructor.mock.calls.length,
        poolQueries: query.mock.calls.length,
      }),
    );
  });
});
