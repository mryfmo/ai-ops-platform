/**
 * packages/server/tests/eventsPollingTask.test.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-010（eventsテーブルのポーリングディスパッチ。1件失敗の隔離）
 */
import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import { createEventsPollingTask } from "../src/scheduler/tasks/eventsPollingTask.js";
import type { EventsRepo, QueuedEvent } from "../src/db/eventsRepo.js";

function makeEvent(overrides: Partial<QueuedEvent> = {}): QueuedEvent {
  return {
    eventId: "evt-1",
    traceId: "trace-1",
    source: "inbound",
    payload: {
      kind: "graph_channel_message_notification",
      changeType: "created",
      resource: "r",
      subscriptionId: "s",
      ids: {},
    },
    status: "dispatched",
    ...overrides,
  };
}

function makeRepoStub(queue: QueuedEvent[]) {
  const done: string[] = [];
  const delayed: string[] = [];
  return {
    claimNextQueued: async () => queue.shift() ?? null,
    markDone: async (id: string) => {
      done.push(id);
    },
    markDelayed: async (id: string) => {
      delayed.push(id);
    },
    enqueue: async () => {},
    done,
    delayed,
  };
}

function makeTaskDeps(repo: ReturnType<typeof makeRepoStub>, auditLog = new InMemoryAuditLog()) {
  return {
    eventsRepo: repo as unknown as EventsRepo,
    auditLog,
    dispatchInboundNotification: async () => {},
    dispatchGithubEvent: async () => {},
    dispatchMonitorEvent: async () => {},
    traceIdProvider: () => "t",
  };
}

describe("eventsPollingTask (ADR-0005 / SPEC-INT-010)", () => {
  it("source=inboundのgraph通知をディスパッチしdoneにする", async () => {
    const repo = makeRepoStub([makeEvent()]);
    const dispatched: Array<{ payload: unknown; traceId: string }> = [];
    const task = createEventsPollingTask({
      eventsRepo: repo as unknown as EventsRepo,
      auditLog: new InMemoryAuditLog(),
      dispatchInboundNotification: async (payload, traceId) => {
        dispatched.push({ payload, traceId });
      },
      dispatchGithubEvent: async () => {},
      dispatchMonitorEvent: async () => {},
      traceIdProvider: () => "t",
    });

    await task.run(new Date());
    expect(dispatched).toHaveLength(1);
    expect(repo.done).toEqual(["evt-1"]);
    expect(repo.delayed).toEqual([]);
  });

  it("ディスパッチ失敗は他イベント処理に波及させず、delayedへ遷移+監査ログ", async () => {
    const repo = makeRepoStub([makeEvent({ eventId: "evt-fail" }), makeEvent({ eventId: "evt-ok" })]);
    const auditLog = new InMemoryAuditLog();
    let call = 0;
    const task = createEventsPollingTask({
      eventsRepo: repo as unknown as EventsRepo,
      auditLog,
      dispatchInboundNotification: async () => {
        call += 1;
        if (call === 1) throw new Error("boom");
      },
      dispatchGithubEvent: async () => {},
      dispatchMonitorEvent: async () => {},
      traceIdProvider: () => "t",
    });

    await task.run(new Date());
    expect(repo.delayed).toEqual(["evt-fail"]);
    expect(repo.done).toEqual(["evt-ok"]);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "event_dispatch_failed" && l.basis === "SPEC-INT-010")).toBe(true);
  });

  it("キューが空ならdispatchを呼ばない", async () => {
    const repo = makeRepoStub([]);
    let called = false;
    const task = createEventsPollingTask({
      eventsRepo: repo as unknown as EventsRepo,
      auditLog: new InMemoryAuditLog(),
      dispatchInboundNotification: async () => {
        called = true;
      },
      dispatchGithubEvent: async () => {
        called = true;
      },
      dispatchMonitorEvent: async () => {
        called = true;
      },
      traceIdProvider: () => "t",
    });
    await task.run(new Date());
    expect(called).toBe(false);
  });

  it("source=githubはDevOps dispatcherへ渡してdone扱いにする (ADR-0005 / SPEC-INT-010)", async () => {
    const repo = makeRepoStub([
      makeEvent({ source: "github", payload: { eventName: "push", payload: { ref: "main" } } }),
    ]);
    const dispatched: unknown[] = [];
    const task = createEventsPollingTask({
      eventsRepo: repo as unknown as EventsRepo,
      auditLog: new InMemoryAuditLog(),
      dispatchInboundNotification: async () => {},
      dispatchGithubEvent: async (payload) => {
        dispatched.push(payload);
      },
      dispatchMonitorEvent: async () => {},
      traceIdProvider: () => "t",
    });
    await task.run(new Date());
    expect(dispatched).toEqual([{ eventName: "push", payload: { ref: "main" } }]);
    expect(repo.done).toEqual(["evt-1"]);
  });

  it("source=monitorはDevOps monitor dispatcherへ渡してdone扱いにする (ADR-0005 / SPEC-INT-010)", async () => {
    const repo = makeRepoStub([makeEvent({ source: "monitor", payload: { kind: "deploy_metrics" } })]);
    const dispatched: unknown[] = [];
    const task = createEventsPollingTask({
      ...makeTaskDeps(repo),
      dispatchMonitorEvent: async (payload) => {
        dispatched.push(payload);
      },
    });
    await task.run(new Date());
    expect(dispatched).toEqual([{ kind: "deploy_metrics" }]);
    expect(repo.done).toEqual(["evt-1"]);
  });

  it("未対応payloadは監査ログを残してdone扱いにする (ADR-0005 / SPEC-INT-010)", async () => {
    const repo = makeRepoStub([makeEvent({ source: "github", payload: { bad: true } })]);
    const auditLog = new InMemoryAuditLog();
    const task = createEventsPollingTask(makeTaskDeps(repo, auditLog));
    await task.run(new Date());
    expect(repo.done).toEqual(["evt-1"]);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "event_dispatch_ignored")).toBe(true);
  });

  it("maxBatchSizeで1tickの処理件数を制限する", async () => {
    const repo = makeRepoStub([
      makeEvent({ eventId: "e1" }),
      makeEvent({ eventId: "e2" }),
      makeEvent({ eventId: "e3" }),
    ]);
    const task = createEventsPollingTask({
      eventsRepo: repo as unknown as EventsRepo,
      auditLog: new InMemoryAuditLog(),
      dispatchInboundNotification: async () => {},
      dispatchGithubEvent: async () => {},
      dispatchMonitorEvent: async () => {},
      traceIdProvider: () => "t",
      maxBatchSize: 2,
    });
    await task.run(new Date());
    expect(repo.done).toEqual(["e1", "e2"]);
  });
});
