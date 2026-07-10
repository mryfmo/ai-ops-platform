/**
 * packages/server/tests/graphLifecycleHandler.test.ts
 *
 * 根拠: SPEC-INT-001（Graph lifecycle: reauth/removed/missed の明示処理）。
 */
import { describe, expect, it } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import type { GraphSubscription } from "../src/db/graphSubscriptionsRepo.js";
import { handleGraphLifecycleEvent, type GraphLifecycleHandlerDeps } from "../src/lib/graphLifecycleHandler.js";

const SUB: GraphSubscription = {
  subscriptionId: "sub-1",
  resource: "teams('t')/channels('c')/messages",
  teamId: "t",
  channelId: "c",
  expiresAt: "2026-07-10T00:30:00.000Z",
  deltaLink: "delta-old",
  mode: "notification",
  updatedAt: "2026-07-10T00:00:00.000Z",
};

function makeDeps(sub: GraphSubscription | null = SUB) {
  const auditLog = new InMemoryAuditLog();
  const renewed: Array<{ id: string; expiresAt: string }> = [];
  const switched: Array<{ id: string; mode: string }> = [];
  const backfilled: string[] = [];
  const deps: GraphLifecycleHandlerDeps = {
    graphSubscriptionsRepo: {
      findBySubscriptionId: async () => sub,
      updateExpiresAt: async (id, expiresAt) => {
        renewed.push({ id, expiresAt });
      },
      switchMode: async (id, mode) => {
        switched.push({ id, mode });
      },
    },
    graphClient: {
      renewSubscription: async (id, expiresAt) => {
        renewed.push({ id, expiresAt });
      },
    },
    backfillSubscription: async (s) => {
      backfilled.push(s.subscriptionId);
    },
    auditLog,
    traceIdProvider: () => "trace-unused",
    nowProvider: () => new Date("2026-07-10T00:00:00Z"),
  };
  return { deps, auditLog, renewed, switched, backfilled };
}

describe("handleGraphLifecycleEvent (SPEC-INT-001)", () => {
  it("reauthorizationRequired はGraph renewとexpires_at更新を行う", async () => {
    const { deps, renewed } = makeDeps();
    await handleGraphLifecycleEvent(
      { lifecycleEvent: "reauthorizationRequired", subscriptionId: "sub-1", notification: {} },
      "trace-1",
      deps,
    );

    expect(renewed).toEqual([
      { id: "sub-1", expiresAt: "2026-07-10T01:00:00.000Z" },
      { id: "sub-1", expiresAt: "2026-07-10T01:00:00.000Z" },
    ]);
  });

  it("subscriptionRemoved はpollingへ切り替え監査する", async () => {
    const { deps, auditLog, switched } = makeDeps();
    await handleGraphLifecycleEvent(
      { lifecycleEvent: "subscriptionRemoved", subscriptionId: "sub-1", notification: {} },
      "trace-1",
      deps,
    );

    expect(switched).toEqual([{ id: "sub-1", mode: "polling" }]);
    expect((await auditLog.readAll()).some((l) => l.action === "graph_subscription_removed")).toBe(true);
  });

  it("missed は該当購読のbackfillを起動する", async () => {
    const { deps, auditLog, backfilled } = makeDeps();
    await handleGraphLifecycleEvent(
      { lifecycleEvent: "missed", subscriptionId: "sub-1", notification: {} },
      "trace-1",
      deps,
    );

    expect(backfilled).toEqual(["sub-1"]);
    expect((await auditLog.readAll()).some((l) => l.action === "graph_lifecycle_missed_backfilled")).toBe(true);
  });

  it("未知のsubscriptionIdは無音にせず監査する", async () => {
    const { deps, auditLog, backfilled } = makeDeps(null);
    await handleGraphLifecycleEvent(
      { lifecycleEvent: "missed", subscriptionId: "missing", notification: {} },
      "trace-1",
      deps,
    );

    expect(backfilled).toEqual([]);
    expect((await auditLog.readAll()).some((l) => l.action === "graph_lifecycle_unhandled")).toBe(true);
  });
});
