// 根拠: FinalArch:FR-CP-004 / FinalArch:FR-CP-005 / TMP-003 / ADR-0021
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS,
} from "../src/lib/graphSubscriptionState.js";
import { buildGraphSubscriptionWorkflowId } from "../src/workflows/graphSubscription.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");

type Environment = Awaited<ReturnType<typeof TestWorkflowEnvironment.createTimeSkipping>>;
let env: Environment;

beforeEach(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping();
});

afterEach(async () => {
  if (env !== undefined) await env.teardown();
});

const receipt = (operation: "renewal" | "delta" | "reconcile", checkpoint: string) => ({
  schemaVersion: 1 as const,
  payload: { subscriptionId: "subscription-1", operation, checkpoint },
});

function renewalInput(observedAtMs: number, extraMs = 30 * 60_000, executionMode: "shadow" | "active" = "active") {
  return {
    schemaVersion: 1 as const,
    payload: {
      subscriptionId: "subscription-1",
      operation: "renewal" as const,
      executionMode,
      sequence: 0,
      observedAtMs,
      expiresAtMs: observedAtMs + GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS + extraMs,
    },
  };
}

function activities(overrides: Record<string, unknown> = {}) {
  return {
    async findGraphSubscriptionRenewal() {
      return null;
    },
    async renewGraphSubscription() {
      return receipt("renewal", "renewed");
    },
    async fallbackGraphSubscriptionToPolling() {
      return receipt("renewal", "polling-backfill");
    },
    async runGraphSubscriptionDelta() {
      return receipt("delta", "delta-link-2");
    },
    async reconcileGraphSubscription() {
      return receipt("reconcile", "etag-2");
    },
    ...overrides,
  };
}

async function execute(input: unknown, workerActivities: ReturnType<typeof activities>, suffix: string) {
  const taskQueue = `graph-subscription-${suffix}`;
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath,
    activities: workerActivities,
  });
  return worker.runUntil(
    env.client.workflow.execute("graphSubscriptionWorkflow", {
      taskQueue,
      workflowId: buildGraphSubscriptionWorkflowId(
        "subscription-1",
        (input as { payload: { operation: "renewal" | "delta" | "reconcile" } }).payload.operation,
        0,
      ),
      args: [input],
    }),
  );
}

describe("FinalArch:FR-CP-004 GraphSubscriptionWorkflow time-skipping", () => {
  it("renewal deadline 前には write せず、期限到達時に1回だけ実行する", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const resultPromise = execute(
      renewalInput(now),
      activities({
        async renewGraphSubscription() {
          writes += 1;
          return receipt("renewal", "renewed");
        },
      }),
      "renewal-deadline",
    );
    await env.sleep(29 * 60_000);
    expect(writes).toBe(0);
    await env.sleep(60_000);
    await expect(resultPromise).resolves.toMatchObject({ payload: { outcome: "executed" } });
    expect(writes).toBe(1);
  });

  it("同じ schedule 引数の次回 fire でも renewal key と target expiry を更新する", async () => {
    const now = await env.currentTimeMs();
    const keys: string[] = [];
    const targets: number[] = [];
    const workerActivities = activities({
      async renewGraphSubscription(input: { schemaVersion: 1; payload: { targetExpiresAtMs: number } }, key: string) {
        keys.push(key);
        targets.push(input.payload.targetExpiresAtMs);
        return receipt("renewal", key);
      },
    });
    await execute(renewalInput(now, 0), workerActivities, "renewal-fire-1");
    await env.sleep(1);
    await execute(renewalInput(now, 0), workerActivities, "renewal-fire-2");
    expect(new Set(keys).size).toBe(2);
    expect(targets[1]).toBeGreaterThan(targets[0]!);
  });

  it("delta は5分周期より前に走らず、到達後に idempotent activity を1回実行する", async () => {
    const now = await env.currentTimeMs();
    let reads = 0;
    const resultPromise = execute(
      {
        schemaVersion: 1,
        payload: {
          subscriptionId: "subscription-1",
          operation: "delta",
          executionMode: "active",
          sequence: 0,
          observedAtMs: now,
        },
      },
      activities({
        async runGraphSubscriptionDelta() {
          reads += 1;
          return receipt("delta", "delta-link-2");
        },
      }),
      "delta-period",
    );
    await env.sleep(GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS - 1);
    expect(reads).toBe(0);
    await env.sleep(1);
    await expect(resultPromise).resolves.toMatchObject({ payload: { outcome: "completed" } });
    expect(reads).toBe(1);
  });
});

describe("TMP-003 GraphSubscriptionWorkflow shadow idempotency", () => {
  it("旧 scheduler の renewal が先行済みなら authoritative reconcile で回収し二重 write しない", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const result = await execute(
      renewalInput(now, 0, "shadow"),
      activities({
        async findGraphSubscriptionRenewal() {
          return receipt("renewal", "legacy-scheduler-write");
        },
        async renewGraphSubscription() {
          writes += 1;
          return receipt("renewal", "duplicate");
        },
      }),
      "shadow-no-duplicate",
    );
    expect(result).toMatchObject({ payload: { outcome: "reconciled", checkpoint: "legacy-scheduler-write" } });
    expect(writes).toBe(0);
  });

  it("lost response 後は write を再送せず authoritative reconcile で同じ object を確認する", async () => {
    const now = await env.currentTimeMs();
    const externalObjects: string[] = [];
    const result = await execute(
      renewalInput(now, 0),
      activities({
        async findGraphSubscriptionRenewal() {
          return externalObjects.length === 0 ? null : receipt("renewal", externalObjects[0]!);
        },
        async renewGraphSubscription(_input: unknown, idempotencyKey: string) {
          externalObjects.push(idempotencyKey);
          throw new Error("synthetic response loss after Graph write");
        },
      }),
      "lost-response",
    );
    expect(result).toMatchObject({ payload: { outcome: "reconciled" } });
    expect(externalObjects).toHaveLength(1);
  });

  it("shadow 中に legacy renewal が競合しても workflow は write を dispatch しない", async () => {
    const now = await env.currentTimeMs();
    let legacyWrites = 0;
    let workflowWrites = 0;
    const result = await execute(
      renewalInput(now, 0, "shadow"),
      activities({
        async findGraphSubscriptionRenewal() {
          legacyWrites += 1;
          return null;
        },
        async renewGraphSubscription() {
          workflowWrites += 1;
          return receipt("renewal", "duplicate");
        },
      }),
      "shadow-concurrent",
    );
    expect(result).toMatchObject({ payload: { outcome: "shadowed", checkpoint: null } });
    expect(legacyWrites).toBe(1);
    expect(workflowWrites).toBe(0);
  });

  it("shadow delta は idempotent write activity も dispatch しない", async () => {
    const now = await env.currentTimeMs();
    let deltaWrites = 0;
    const resultPromise = execute(
      {
        schemaVersion: 1,
        payload: {
          subscriptionId: "subscription-1",
          operation: "delta",
          executionMode: "shadow",
          sequence: 0,
          observedAtMs: now,
        },
      },
      activities({
        async runGraphSubscriptionDelta() {
          deltaWrites += 1;
          return receipt("delta", "duplicate");
        },
      }),
      "shadow-delta",
    );
    await env.sleep(GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS);
    await expect(resultPromise).resolves.toMatchObject({ payload: { outcome: "shadowed", checkpoint: null } });
    expect(deltaWrites).toBe(0);
  });

  it("shadow reconcile は外部 write なしの authoritative read を実行する", async () => {
    const now = await env.currentTimeMs();
    let reads = 0;
    const resultPromise = execute(
      {
        schemaVersion: 1,
        payload: {
          subscriptionId: "subscription-1",
          operation: "reconcile",
          executionMode: "shadow",
          sequence: 0,
          observedAtMs: now,
        },
      },
      activities({
        async reconcileGraphSubscription() {
          reads += 1;
          return receipt("reconcile", "etag-shadow");
        },
      }),
      "shadow-reconcile",
    );
    await env.sleep(GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS);
    await expect(resultPromise).resolves.toMatchObject({
      payload: { outcome: "completed", checkpoint: "etag-shadow" },
    });
    expect(reads).toBe(1);
  });

  it("write 失敗後も authoritative reconcile が不在なら polling fallback と backfill を実行する", async () => {
    const now = await env.currentTimeMs();
    let fallbackInput: unknown;
    const result = await execute(
      renewalInput(now, 0),
      activities({
        async renewGraphSubscription() {
          throw new Error("Graph unavailable");
        },
        async fallbackGraphSubscriptionToPolling(input: unknown) {
          fallbackInput = input;
          return receipt("renewal", "polling-backfill");
        },
      }),
      "unresolved-write",
    );
    expect(result).toMatchObject({ payload: { outcome: "completed", checkpoint: "polling-backfill" } });
    expect(fallbackInput).toMatchObject({
      schemaVersion: 1,
      payload: {
        subscriptionId: "subscription-1",
        operation: "renewal",
        observedAtMs: expect.any(Number),
        targetExpiresAtMs: expect.any(Number),
      },
    });
    expect((fallbackInput as { payload: Record<string, unknown> }).payload).not.toHaveProperty("expiresAtMs");
  });

  it("malformed renewal receipt は contract failure で終了し polling fallback を実行しない", async () => {
    const now = await env.currentTimeMs();
    let fallbackWrites = 0;
    const error = await execute(
      renewalInput(now, 0),
      activities({
        async renewGraphSubscription() {},
        async fallbackGraphSubscriptionToPolling() {
          fallbackWrites += 1;
          return receipt("renewal", "polling-backfill");
        },
      }),
      "malformed-renewal-result",
    ).catch((failure: unknown) => failure);
    expect(error).toMatchObject({
      cause: {
        message: "graph subscription activity receipt must use schemaVersion 1 with an object payload",
        type: "E-CP-CONTRACT",
        nonRetryable: true,
      },
    });
    expect(fallbackWrites).toBe(0);
  });

  it("activity の malformed result を成功として扱わず non-retryable failure で終了する", async () => {
    const now = await env.currentTimeMs();
    const error = await execute(
      {
        schemaVersion: 1,
        payload: {
          subscriptionId: "subscription-1",
          operation: "reconcile",
          executionMode: "active",
          sequence: 0,
          observedAtMs: now,
        },
      },
      activities({ async reconcileGraphSubscription() {} }),
      "malformed-result",
    ).catch((failure: unknown) => failure);
    expect(error).toMatchObject({
      cause: {
        message: "graph subscription activity receipt must use schemaVersion 1 with an object payload",
        type: "E-CP-CONTRACT",
        nonRetryable: true,
      },
    });
  });
});
