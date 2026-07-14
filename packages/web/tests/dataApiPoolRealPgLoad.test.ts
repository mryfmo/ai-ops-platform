/**
 * packages/web/tests/dataApiPoolRealPgLoad.test.ts
 *
 * 根拠: ADR-0013 / PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068。
 * T-P2-05是正証跡 AUD-REL-001: production route/getPoolの実PostgreSQL物理接続数を測定する。
 */
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { baseDatabaseUrl, confirmDatabase, databaseName, applicationName, routeDatabaseUrl, schema } = vi.hoisted(() => {
  const baseDatabaseUrl = process.env.AIOPS_LOAD_TEST_DATABASE_URL;
  const confirmDatabase = process.env.AIOPS_LOAD_TEST_CONFIRM_DATABASE;
  const applicationName = `aiops_load_web_${process.pid}`;
  const schema = `aiops_load_${process.pid}`;
  const url = new URL(baseDatabaseUrl ?? "postgresql://invalid/aiops_load");
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  url.searchParams.set("application_name", applicationName);
  url.searchParams.set("options", `-c search_path=${schema},public`);
  return { baseDatabaseUrl, confirmDatabase, databaseName, applicationName, routeDatabaseUrl: url.toString(), schema };
});

vi.mock("../src/auth", () => ({
  auth: async () => ({ user: { email: "manager@example.com" }, expires: "2099-01-01T00:00:00.000Z" }),
}));
vi.mock("../src/server/config", () => ({ loadWebConfig: () => ({ DATABASE_URL: routeDatabaseUrl }) }));

const globalPool = globalThis as typeof globalThis & { __aiopsPgPool?: unknown };
let admin: pg.Client | undefined;
let adminConnected = false;
let schemaCreated = false;
let routePool: pg.Pool | undefined;

async function physicalConnectionCount(): Promise<number> {
  const result = await admin!.query<{ count: number }>(
    `SELECT count(*)::int AS count
       FROM pg_stat_activity
      WHERE datname = current_database() AND application_name = $1`,
    [applicationName],
  );
  return result.rows[0]!.count;
}

describe.skipIf(!baseDatabaseUrl)(
  "real PostgreSQL web pool load [PrjOps:REQ-041 / DevOps:REQ-041 PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]",
  () => {
    beforeAll(async () => {
      if (!confirmDatabase) throw new Error("AIOPS_LOAD_TEST_CONFIRM_DATABASE is required");
      if (confirmDatabase !== databaseName) {
        throw new Error("AIOPS_LOAD_TEST_CONFIRM_DATABASE must exactly match the URL database name");
      }
      delete globalPool.__aiopsPgPool;
      admin = new pg.Client({ connectionString: baseDatabaseUrl, application_name: `${applicationName}_admin` });
      await admin.connect();
      adminConnected = true;
      await admin.query(`CREATE SCHEMA "${schema}"`);
      schemaCreated = true;
      await admin.query(
        `CREATE TABLE "${schema}".recipients (
         user_id text PRIMARY KEY, email text NOT NULL, profile text NOT NULL, projects text[] NOT NULL, active boolean NOT NULL
       )`,
      );
      await admin.query(
        `CREATE TABLE "${schema}".project_channels (
         project_id text PRIMARY KEY, github_owner text, github_repo text
       )`,
      );
      await admin.query(
        `INSERT INTO "${schema}".recipients (user_id, email, profile, projects, active)
       VALUES ('U-load', 'manager@example.com', 'PRF-G', ARRAY['PJ-load'], true)`,
      );
      await admin.query(
        `INSERT INTO "${schema}".project_channels (project_id, github_owner, github_repo)
       VALUES ('PJ-load', 'owner', 'repo')`,
      );
    });

    afterAll(async () => {
      if (routePool) await routePool.end();
      delete globalPool.__aiopsPgPool;
      if (admin && adminConnected) {
        if (schemaCreated) {
          await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
          schemaCreated = false;
        }
        await admin.end();
        adminConnected = false;
      }
    });

    it("keeps one physical route connection across 500 production GET requests", async () => {
      const before = await physicalConnectionCount();
      const { GET } = await import("../src/app/api/data/projects/route");
      const request = new Request("https://example.invalid/api/data/projects");
      const { getPool } = await import("../src/server/db/pool");
      routePool = getPool(routeDatabaseUrl);
      let peak = before;
      let poolTotalPeak = routePool.totalCount;

      for (let index = 0; index < 500; index += 1) {
        expect((await GET(request)).status).toBe(200);
        peak = Math.max(peak, await physicalConnectionCount());
        poolTotalPeak = Math.max(poolTotalPeak, routePool.totalCount);
      }

      const afterRequests = await physicalConnectionCount();
      await routePool.end();
      routePool = undefined;
      delete globalPool.__aiopsPgPool;
      const after = await physicalConnectionCount();

      expect(before).toBe(0);
      expect(peak).toBe(1);
      expect(afterRequests).toBe(peak);
      expect(poolTotalPeak).toBe(1);
      expect(after).toBe(before);
      console.info(
        JSON.stringify({
          metric: "real_postgres_web_pool_stability",
          requests: 500,
          physicalConnections: { before, peak, afterRequests, after },
          poolTotalPeak,
          applicationName,
        }),
      );
    }, 30_000);
  },
);
