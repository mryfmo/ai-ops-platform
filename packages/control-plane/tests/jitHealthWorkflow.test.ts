// 根拠: DevOps:SPEC-INT-032 / DevOps:SPEC-INT-040 / REQ-029 / TH-007 / TMP-003 / ADR-0021
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HEALTH_EVALUATION_INTERVAL_MS, JIT_EXPIRY_INTERVAL_MS } from "../src/lib/jitHealthState.js";
import { buildHealthEvaluationWorkflowId, buildJitExpiryWorkflowId } from "../src/workflows/jitHealth.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");
const GRANT_ID = "00000000-0000-4000-8000-000000000001";

type Environment = Awaited<ReturnType<typeof TestWorkflowEnvironment.createTimeSkipping>>;
let env: Environment;

beforeEach(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping();
});

afterEach(async () => {
  if (env !== undefined) await env.teardown();
});

const request = (operation: "jit-expiry" | "health", observedAtMs: number, executionMode: "shadow" | "active") => ({
  schemaVersion: 1 as const,
  payload: { operation, executionMode, sequence: 0, observedAtMs },
});

const candidates = (evaluatedAtMs: number, grantIds: string[] = [GRANT_ID]) => ({
  schemaVersion: 1 as const,
  payload: { evaluatedAtMs, grants: grantIds.map((grantId) => ({ grantId })) },
});

const revocation = (grantId: string, idempotencyKey: string, revokedAtMs: number) => ({
  schemaVersion: 1 as const,
  payload: { grantId, idempotencyKey, revokedAtMs },
});

const health = (observedAtMs: number, decision: "none" | "activate_failsafe" | "recover" = "none") => ({
  schemaVersion: 1 as const,
  payload: {
    observedAtMs,
    healthy: decision !== "activate_failsafe",
    consecutiveFailures: decision === "activate_failsafe" ? 3 : 0,
    decision,
  },
});

function activities(overrides: Record<string, unknown> = {}) {
  return {
    async findJitRevocationCandidates(input: { payload: { observedAtMs: number } }) {
      return candidates(input.payload.observedAtMs);
    },
    async findJitRevocation() {
      return null;
    },
    async revokeExpiredGrant(input: { payload: { grantId: string; observedAtMs: number } }, key: string) {
      return revocation(input.payload.grantId, key, input.payload.observedAtMs);
    },
    async evaluateHealth(input: { payload: { observedAtMs: number } }) {
      return health(input.payload.observedAtMs);
    },
    async applyHealthDecision(input: unknown) {
      return input;
    },
    ...overrides,
  };
}

async function execute(
  workflowType: "jitExpiryWorkflow" | "healthEvaluationWorkflow",
  input: unknown,
  workerActivities: ReturnType<typeof activities>,
  suffix: string,
) {
  const taskQueue = `jit-health-${suffix}`;
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath,
    activities: workerActivities,
  });
  return worker.runUntil(
    env.client.workflow.execute(workflowType, {
      taskQueue,
      workflowId:
        workflowType === "jitExpiryWorkflow" ? buildJitExpiryWorkflowId(0) : buildHealthEvaluationWorkflowId(0),
      args: [input],
    }),
  );
}

describe("DevOps:SPEC-INT-032 JitExpiryWorkflow time-skipping", () => {
  it("毎分 deadline 前には revoke せず、到達後に1回だけ実行する", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const resultPromise = execute(
      "jitExpiryWorkflow",
      request("jit-expiry", now, "active"),
      activities({
        async revokeExpiredGrant(input: { payload: { grantId: string; observedAtMs: number } }, key: string) {
          writes += 1;
          return revocation(input.payload.grantId, key, input.payload.observedAtMs);
        },
      }),
      "jit-deadline",
    );
    await env.sleep(JIT_EXPIRY_INTERVAL_MS - 1);
    expect(writes).toBe(0);
    await env.sleep(1);
    await expect(resultPromise).resolves.toMatchObject({
      payload: { outcome: "completed", revocations: [{ grantId: GRANT_ID, outcome: "executed" }] },
    });
    expect(writes).toBe(1);
  });

  it("shadow は authoritative read/reconcile を行うが revoke write を構造的に抑止する", async () => {
    const now = await env.currentTimeMs();
    let reconciles = 0;
    let writes = 0;
    const resultPromise = execute(
      "jitExpiryWorkflow",
      request("jit-expiry", now, "shadow"),
      activities({
        async findJitRevocation() {
          reconciles += 1;
          return null;
        },
        async revokeExpiredGrant() {
          writes += 1;
        },
      }),
      "jit-shadow",
    );
    await env.sleep(JIT_EXPIRY_INTERVAL_MS);
    await expect(resultPromise).resolves.toMatchObject({
      payload: { outcome: "shadowed", revocations: [{ grantId: GRANT_ID, outcome: "shadowed" }] },
    });
    expect(reconciles).toBe(1);
    expect(writes).toBe(0);
  });
});

describe("TMP-003 JitExpiryWorkflow lost-response", () => {
  it("応答喪失後は revoke を再送せず authoritative reconcile で同じ記録を回収する", async () => {
    const now = await env.currentTimeMs();
    const revoked = new Map<string, ReturnType<typeof revocation>>();
    let writes = 0;
    const resultPromise = execute(
      "jitExpiryWorkflow",
      request("jit-expiry", now, "active"),
      activities({
        async findJitRevocation(_input: unknown, key: string) {
          return revoked.get(key) ?? null;
        },
        async revokeExpiredGrant(input: { payload: { grantId: string; observedAtMs: number } }, key: string) {
          writes += 1;
          revoked.set(key, revocation(input.payload.grantId, key, input.payload.observedAtMs));
          throw new Error("synthetic response loss after revoke");
        },
      }),
      "jit-lost-response",
    );
    await env.sleep(JIT_EXPIRY_INTERVAL_MS);
    await expect(resultPromise).resolves.toMatchObject({
      payload: { revocations: [{ grantId: GRANT_ID, outcome: "reconciled" }] },
    });
    expect(writes).toBe(1);
    expect(revoked).toHaveLength(1);
  });

  it("execute と reconcile の両方が不在なら成功扱いにせず non-retryable failure にする", async () => {
    const now = await env.currentTimeMs();
    const errorPromise = execute(
      "jitExpiryWorkflow",
      request("jit-expiry", now, "active"),
      activities({
        async revokeExpiredGrant() {
          throw new Error("GitHub timeout");
        },
      }),
      "jit-unresolved",
    ).catch((failure: unknown) => failure);
    await env.sleep(JIT_EXPIRY_INTERVAL_MS);
    await expect(errorPromise).resolves.toMatchObject({
      cause: { type: "E-CP-EXTERNAL-UNRESOLVED", nonRetryable: true },
    });
  });

  it("malformed revoke receipt は E-CP-CONTRACT で終了する", async () => {
    const now = await env.currentTimeMs();
    const errorPromise = execute(
      "jitExpiryWorkflow",
      request("jit-expiry", now, "active"),
      activities({ async revokeExpiredGrant() {} }),
      "jit-malformed-receipt",
    ).catch((failure: unknown) => failure);
    await env.sleep(JIT_EXPIRY_INTERVAL_MS);
    await expect(errorPromise).resolves.toMatchObject({ cause: { type: "E-CP-CONTRACT", nonRetryable: true } });
  });
});

describe("DevOps:SPEC-INT-040 HealthEvaluationWorkflow", () => {
  it("30秒 deadline と workflow logical time で health を評価する", async () => {
    const now = await env.currentTimeMs();
    const observations: number[] = [];
    let writes = 0;
    const resultPromise = execute(
      "healthEvaluationWorkflow",
      request("health", now, "active"),
      activities({
        async evaluateHealth(input: { payload: { observedAtMs: number } }) {
          observations.push(input.payload.observedAtMs);
          return health(input.payload.observedAtMs);
        },
        async applyHealthDecision(input: unknown) {
          writes += 1;
          return input;
        },
      }),
      "health-deadline",
    );
    await env.sleep(HEALTH_EVALUATION_INTERVAL_MS - 1);
    expect(observations).toEqual([]);
    await env.sleep(1);
    await expect(resultPromise).resolves.toMatchObject({ payload: { outcome: "applied", decision: "none" } });
    expect(observations).toHaveLength(1);
    expect(observations[0]).toBeGreaterThanOrEqual(now + HEALTH_EVALUATION_INTERVAL_MS);
    expect(writes).toBe(1);
  });

  it("shadow は activate decision を評価するが apply write を dispatch しない", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const resultPromise = execute(
      "healthEvaluationWorkflow",
      request("health", now, "shadow"),
      activities({
        async evaluateHealth(input: { payload: { observedAtMs: number } }) {
          return health(input.payload.observedAtMs, "activate_failsafe");
        },
        async applyHealthDecision() {
          writes += 1;
        },
      }),
      "health-shadow",
    );
    await env.sleep(HEALTH_EVALUATION_INTERVAL_MS);
    await expect(resultPromise).resolves.toMatchObject({
      payload: { outcome: "shadowed", decision: "activate_failsafe" },
    });
    expect(writes).toBe(0);
  });

  it("active decision は idempotent apply を1回実行する", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const resultPromise = execute(
      "healthEvaluationWorkflow",
      request("health", now, "active"),
      activities({
        async evaluateHealth(input: { payload: { observedAtMs: number } }) {
          return health(input.payload.observedAtMs, "activate_failsafe");
        },
        async applyHealthDecision(input: unknown) {
          writes += 1;
          return input;
        },
      }),
      "health-active",
    );
    await env.sleep(HEALTH_EVALUATION_INTERVAL_MS);
    await expect(resultPromise).resolves.toMatchObject({
      payload: { outcome: "applied", decision: "activate_failsafe" },
    });
    expect(writes).toBe(1);
  });

  it("malformed evaluation は E-CP-CONTRACT で終了し apply しない", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const errorPromise = execute(
      "healthEvaluationWorkflow",
      request("health", now, "active"),
      activities({
        async evaluateHealth() {},
        async applyHealthDecision() {
          writes += 1;
        },
      }),
      "health-malformed",
    ).catch((failure: unknown) => failure);
    await env.sleep(HEALTH_EVALUATION_INTERVAL_MS);
    await expect(errorPromise).resolves.toMatchObject({ cause: { type: "E-CP-CONTRACT", nonRetryable: true } });
    expect(writes).toBe(0);
  });

  it("3回失敗を none とする evaluation は E-CP-CONTRACT で終了し apply しない", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const errorPromise = execute(
      "healthEvaluationWorkflow",
      request("health", now, "active"),
      activities({
        async evaluateHealth(input: { payload: { observedAtMs: number } }) {
          return {
            schemaVersion: 1,
            payload: {
              observedAtMs: input.payload.observedAtMs,
              healthy: false,
              consecutiveFailures: 3,
              decision: "none",
            },
          };
        },
        async applyHealthDecision() {
          writes += 1;
        },
      }),
      "health-suppressed-failsafe",
    ).catch((failure: unknown) => failure);
    await env.sleep(HEALTH_EVALUATION_INTERVAL_MS);
    await expect(errorPromise).resolves.toMatchObject({ cause: { type: "E-CP-CONTRACT", nonRetryable: true } });
    expect(writes).toBe(0);
  });
});
