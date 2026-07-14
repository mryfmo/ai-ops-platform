/**
 * packages/server/tests/subscriptionRenewalTask.test.ts
 *
 * 根拠: ADR-0005（30分間隔のサブスクリプション更新）/ PrjOps:SPEC-INT-001（renew失敗=E-SUB02時のpollingフォールバック）
 */
import { describe, it, expect } from "vitest";
import { GraphSubscriptionError, InMemoryAuditLog } from "@aiops/shared";
import { createSubscriptionRenewalTask } from "../src/scheduler/tasks/subscriptionRenewalTask.js";
import type { GraphSubscription, GraphSubscriptionMode } from "../src/db/graphSubscriptionsRepo.js";

function makeSub(overrides: Partial<GraphSubscription> = {}): GraphSubscription {
  return {
    subscriptionId: "sub-1",
    resource: "teams('t-1')/channels('c-1')/messages",
    teamId: "t-1",
    channelId: "c-1",
    expiresAt: "2026-07-07T00:05:00.000Z",
    deltaLink: null,
    mode: "notification",
    updatedAt: "2026-07-06T23:00:00.000Z",
    ...overrides,
  };
}

function makeRepoStub(subs: GraphSubscription[]) {
  const switched: Array<{ id: string; mode: GraphSubscriptionMode }> = [];
  const expiresUpdated: Array<{ id: string; expiresAt: string }> = [];
  return {
    listByMode: async (mode: GraphSubscriptionMode) => subs.filter((s) => s.mode === mode),
    switchMode: async (id: string, mode: GraphSubscriptionMode) => {
      switched.push({ id, mode });
    },
    updateExpiresAt: async (id: string, expiresAt: string) => {
      expiresUpdated.push({ id, expiresAt });
    },
    updateDeltaLink: async () => {},
    upsert: async () => {},
    findBySubscriptionId: async () => null,
    switched,
    expiresUpdated,
  };
}

const NOW = new Date("2026-07-07T00:00:00.000Z"); // sub-1 expires in 5min < 10min threshold

describe("subscriptionRenewalTask (ADR-0005 / PrjOps:SPEC-INT-001)", () => {
  it("期限切れ間近のnotification購読をrenewし、成功時はexpires_atを更新する", async () => {
    const repo = makeRepoStub([makeSub()]);
    const auditLog = new InMemoryAuditLog();
    const renewed: Array<{ id: string; teamId: string }> = [];
    const task = createSubscriptionRenewalTask({
      graphSubscriptionsRepo: repo as never,
      graphClient: {
        renewSubscription: async (id: string, _expiresAt: string, teamId: string) => {
          renewed.push({ id, teamId });
        },
      },
      auditLog,
      traceIdProvider: () => "trace-1",
      backfillSubscription: async () => {},
    });

    await task.run(NOW);
    expect(renewed).toEqual([{ id: "sub-1", teamId: "t-1" }]);
    expect(repo.expiresUpdated).toHaveLength(1);
    expect(repo.switched).toHaveLength(0);
    expect(task.runOnStart).toBe(true);
  });

  it("renew失敗(E-SUB02)時はpollingへ切替+監査ログ", async () => {
    const repo = makeRepoStub([makeSub()]);
    const auditLog = new InMemoryAuditLog();
    const task = createSubscriptionRenewalTask({
      graphSubscriptionsRepo: repo as never,
      graphClient: {
        renewSubscription: async () => {
          throw new GraphSubscriptionError("E-SUB02", 404, "secret body");
        },
      },
      auditLog,
      traceIdProvider: () => "trace-2",
      backfillSubscription: async (sub) => {
        expect(sub.subscriptionId).toBe("sub-1");
      },
    });

    await task.run(NOW);
    expect(repo.switched).toEqual([{ id: "sub-1", mode: "polling" }]);
    const logs = await auditLog.readAll();
    expect(
      logs.some((l) => l.action === "graph_subscription_renewal_failed" && l.basis === "PrjOps:SPEC-INT-001"),
    ).toBe(true);
    expect(logs[0]!.detail).not.toHaveProperty("error");
    expect(logs[0]!.detail).toMatchObject({ code: "E-SUB02", status: 404 });
    expect(JSON.stringify(logs)).not.toContain("secret body");
  });

  it.each(["invalid", "2026-07-06T23:59:59Z"])("invalid/expired expiry %s をsilent skipしない", async (expiresAt) => {
    const renewed: string[] = [];
    const task = createSubscriptionRenewalTask({
      graphSubscriptionsRepo: makeRepoStub([makeSub({ expiresAt })]) as never,
      graphClient: { renewSubscription: async (id) => void renewed.push(id) },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-expiry",
      backfillSubscription: async () => {},
    });
    await task.run(NOW);
    expect(renewed).toEqual(["sub-1"]);
  });

  it("期限に余裕がある購読はrenewしない", async () => {
    const repo = makeRepoStub([makeSub({ expiresAt: "2026-07-07T07:00:00.000Z" })]);
    const renewed: string[] = [];
    const task = createSubscriptionRenewalTask({
      graphSubscriptionsRepo: repo as never,
      graphClient: {
        renewSubscription: async (id: string) => {
          renewed.push(id);
        },
      },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-3",
      backfillSubscription: async () => {},
    });
    await task.run(NOW);
    expect(renewed).toEqual([]);
  });

  it("mode=pollingの購読は対象外", async () => {
    const repo = makeRepoStub([makeSub({ mode: "polling" })]);
    const renewed: string[] = [];
    const task = createSubscriptionRenewalTask({
      graphSubscriptionsRepo: repo as never,
      graphClient: {
        renewSubscription: async (id: string) => {
          renewed.push(id);
        },
      },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-4",
      backfillSubscription: async () => {},
    });
    await task.run(NOW);
    expect(renewed).toEqual([]);
  });

  it("switch/backfill/audit失敗をrow単位で隔離し後続due rowをrenewする", async () => {
    const renewed: string[] = [];
    const repo = makeRepoStub([makeSub(), makeSub({ subscriptionId: "sub-2" })]);
    repo.switchMode = async (id) => {
      if (id === "sub-1") throw new Error("secret switch detail");
    };
    const task = createSubscriptionRenewalTask({
      graphSubscriptionsRepo: repo as never,
      graphClient: {
        renewSubscription: async (id) => {
          renewed.push(id);
          if (id === "sub-1") throw new GraphSubscriptionError("E-SUB02", 503, "secret graph body");
        },
      },
      auditLog: { append: async () => Promise.reject(new Error("secret audit detail")) },
      traceIdProvider: () => "trace-isolate",
      backfillSubscription: async () => {
        throw new Error("secret backfill detail");
      },
    });
    await expect(task.run(NOW)).resolves.toBeUndefined();
    expect(renewed).toEqual(["sub-1", "sub-2"]);
  });
});
