/**
 * packages/web/tests/dbPool.test.ts
 *
 * 根拠: ADR-0013 / PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068。Web の composition root が共有する
 * PostgreSQL pool のプロセス単位 singleton を検証する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { poolConstructor } = vi.hoisted(() => ({
  poolConstructor: vi.fn(
    class Pool {
      constructor(readonly options: { connectionString: string }) {}
    },
  ),
}));

vi.mock("pg", () => ({ default: { Pool: poolConstructor } }));

describe("getPool [PrjOps:REQ-041 / DevOps:REQ-041, PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]", () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & { __aiopsPgPool?: unknown }).__aiopsPgPool;
    poolConstructor.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { __aiopsPgPool?: unknown }).__aiopsPgPool;
  });

  it("reuses one process-wide pool across module reloads [PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]", async () => {
    const firstModule = await import("../src/server/db/pool");
    const first = firstModule.getPool("postgresql://same");

    vi.resetModules();
    const secondModule = await import("../src/server/db/pool");
    const second = secondModule.getPool("postgresql://same");

    expect(second).toBe(first);
    expect(poolConstructor).toHaveBeenCalledOnce();
    expect(poolConstructor).toHaveBeenCalledWith({ connectionString: "postgresql://same" });
  });

  it("rejects a different database configuration without exposing either value [PrjOps:REQ-041 / DevOps:REQ-041]", async () => {
    const { getPool } = await import("../src/server/db/pool");
    getPool("postgresql://first");

    expect(() => getPool("postgresql://second")).toThrowError(
      "E-CFG05: web database configuration changed after pool initialization",
    );
    expect(poolConstructor).toHaveBeenCalledOnce();
  });
});
