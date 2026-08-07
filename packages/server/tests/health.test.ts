/**
 * packages/server/tests/health.test.ts
 *
 * 根拠: ADR-0005 / DevOps:REQ-029。依存障害時も縮退情報を保持するreadiness契約を検証する。
 */
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { registerHealthRoutes } from "../src/http/routes/health.js";

describe("GET /readyz [ADR-0005 / DevOps:REQ-029]", () => {
  it("isReadyが例外でもdegradedを返す [DevOps:REQ-029]", async () => {
    const app = new Hono();
    registerHealthRoutes(app, {
      isReady: async () => {
        throw new Error("database unavailable");
      },
      degradedCapabilities: () => ["report_delivery", "graph_subscriptions"],
    });

    const response = await app.request("/readyz");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ready: false,
      degraded: ["report_delivery", "graph_subscriptions"],
    });
  });

  it("isReady内で更新されたdegradedを成功応答へ反映する [DevOps:REQ-029]", async () => {
    const app = new Hono();
    let degraded = ["graph_subscriptions"];
    registerHealthRoutes(app, {
      isReady: async () => {
        degraded = [];
        return true;
      },
      degradedCapabilities: () => degraded,
    });

    const response = await app.request("/readyz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ready: true, degraded: [] });
  });
});
