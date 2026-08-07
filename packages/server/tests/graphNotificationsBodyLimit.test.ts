/**
 * 根拠: PrjOps:SPEC-INT-001 / ADR-0005 / ADV-INT-054。
 * Graph change notification webhook の request body 上限を検証する。
 */
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  GRAPH_NOTIFICATION_MAX_BYTES,
  registerGraphNotificationRoutes,
} from "../src/http/routes/graphNotifications.js";

const CLIENT_STATE = "c".repeat(32);

function setup() {
  const app = new Hono();
  const auditAppend = vi.fn(async () => {});
  const enqueueInboundEvent = vi.fn(async () => true);
  registerGraphNotificationRoutes(app, {
    clientState: CLIENT_STATE,
    auditLog: { append: auditAppend },
    enqueueInboundEvent,
    traceIdProvider: () => "trace-body-limit",
  });
  return { app, auditAppend, enqueueInboundEvent };
}

function notificationBody(paddingBytes: number): string {
  return JSON.stringify({
    value: [
      {
        id: "notification-1",
        clientState: CLIENT_STATE,
        changeType: "created",
        resource: "teams('t-1')/channels('c-1')/messages('m-1')",
        subscriptionId: "subscription-1",
      },
    ],
    padding: "x".repeat(paddingBytes),
  });
}

describe("PrjOps:SPEC-INT-001 /webhooks/graph body limit", () => {
  it("PrjOps:SPEC-INT-001 上限以下の通知は従来どおり202で受理する", async () => {
    const { app, enqueueInboundEvent } = setup();
    const body = notificationBody(GRAPH_NOTIFICATION_MAX_BYTES / 2);
    expect(body.length).toBeLessThan(GRAPH_NOTIFICATION_MAX_BYTES);

    const response = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    expect(response.status).toBe(202);
    expect(enqueueInboundEvent).toHaveBeenCalledOnce();
  });

  it("PrjOps:SPEC-INT-001 上限超過の通知は監査ログへ書かず413で拒否する", async () => {
    const { app, auditAppend, enqueueInboundEvent } = setup();
    const body = notificationBody(GRAPH_NOTIFICATION_MAX_BYTES);
    expect(body.length).toBeGreaterThan(GRAPH_NOTIFICATION_MAX_BYTES);

    const response = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    expect(response.status).toBe(413);
    expect(auditAppend).not.toHaveBeenCalled();
    expect(enqueueInboundEvent).not.toHaveBeenCalled();
  });
});
