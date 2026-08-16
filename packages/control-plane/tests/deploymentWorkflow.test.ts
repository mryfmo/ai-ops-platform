// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-003 / TMP-005 / ADR-0021
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildDeployDispatchWorkflowId,
  buildProdMonitorWorkflowId,
  PROD_MONITOR_INTERVAL_MS,
} from "../src/lib/deploymentState.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");
const DEPLOY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const target = { deployId: DEPLOY_ID, projectId: "PJ-001", owner: "acme", repo: "widget", commitSha: "a".repeat(40) };
const dispatchPlan = { kind: "dispatch", target };
const rollbackPlan = {
  kind: "rollback",
  target: { ...target, channel: { teamId: "team", channelId: "channel" } },
  targetVersion: "v1",
  matchedConditions: ["a"],
};

type Environment = Awaited<ReturnType<typeof TestWorkflowEnvironment.createTimeSkipping>>;
let env: Environment;

beforeEach(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping();
});

afterEach(async () => {
  if (env !== undefined) await env.teardown();
});

const envelope = (payload: unknown) => ({ schemaVersion: 1 as const, payload });
const request = (
  operation: "deploy-dispatch" | "prod-monitor",
  observedAtMs: number,
  executionMode: "shadow" | "active",
) => envelope({ operation, executionMode, sequence: 0, observedAtMs });
const plans = (operation: "deploy-dispatch" | "prod-monitor", values: unknown[]) =>
  envelope({ operation, plans: values });
const cas = (kind: "created" | "stale", from: string, to: string) =>
  envelope(
    kind === "created"
      ? { kind, deployId: DEPLOY_ID, from, to }
      : { kind, deployId: DEPLOY_ID, expectedState: from, observedState: to },
  );
const effect = (kind: "deploy" | "rollback", key: string) =>
  envelope({ deployId: DEPLOY_ID, effect: kind, idempotencyKey: key });

function activities(overrides: Record<string, unknown> = {}) {
  return {
    async findDeployDispatchPlans() {
      return plans("deploy-dispatch", [dispatchPlan]);
    },
    async claimApprovedDeployment(_input: unknown, key: string) {
      return envelope({ kind: "stale", idempotencyKey: key });
    },
    async planProdMonitor() {
      return plans("prod-monitor", [rollbackPlan]);
    },
    async claimDeploymentTransition(input: { payload: { from: string; to: string } }) {
      return cas("created", input.payload.from, input.payload.to);
    },
    async findDeploymentEffect() {
      return null;
    },
    async dispatchDeployment(_input: unknown, key: string) {
      return effect("deploy", key);
    },
    async dispatchRollback(_input: unknown, key: string) {
      return effect("rollback", key);
    },
    ...overrides,
  };
}

async function execute(
  workflowType: "deployDispatchWorkflow" | "prodMonitorWorkflow",
  input: unknown,
  workerActivities: ReturnType<typeof activities>,
  suffix: string,
) {
  const taskQueue = `deployment-${suffix}`;
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
        workflowType === "deployDispatchWorkflow" ? buildDeployDispatchWorkflowId(0) : buildProdMonitorWorkflowId(0),
      args: [input],
    }),
  );
}

describe("P3-T13 DeployDispatchWorkflow [TMP-003/TMP-005]", () => {
  it("shadow は authority plan/ledger を読むが CAS と external write を schedule しない", async () => {
    const now = await env.currentTimeMs();
    let transitions = 0;
    let writes = 0;
    await expect(
      execute(
        "deployDispatchWorkflow",
        request("deploy-dispatch", now, "shadow"),
        activities({
          async claimDeploymentTransition() {
            transitions += 1;
          },
          async dispatchDeployment() {
            writes += 1;
          },
        }),
        "dispatch-shadow",
      ),
    ).resolves.toMatchObject({ payload: { outcome: "shadowed", actions: [{ outcome: "shadowed" }] } });
    expect({ transitions, writes }).toEqual({ transitions: 0, writes: 0 });
  });

  it("active は approved→prod_deploying CAS created 後だけ一度 dispatch", async () => {
    const now = await env.currentTimeMs();
    const order: string[] = [];
    await expect(
      execute(
        "deployDispatchWorkflow",
        request("deploy-dispatch", now, "active"),
        activities({
          async claimDeploymentTransition(input: { payload: { from: string; to: string } }) {
            order.push("cas");
            return cas("created", input.payload.from, input.payload.to);
          },
          async dispatchDeployment(_input: unknown, key: string) {
            order.push("dispatch");
            return effect("deploy", key);
          },
        }),
        "dispatch-active",
      ),
    ).resolves.toMatchObject({ payload: { actions: [{ outcome: "executed" }] } });
    expect(order).toEqual(["cas", "dispatch"]);
  });

  it("cutover race の CAS stale loser は dispatch しない", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    await expect(
      execute(
        "deployDispatchWorkflow",
        request("deploy-dispatch", now, "active"),
        activities({
          async claimDeploymentTransition(input: { payload: { from: string; to: string } }) {
            return cas("stale", input.payload.from, input.payload.to);
          },
          async dispatchDeployment() {
            writes += 1;
          },
        }),
        "dispatch-stale",
      ),
    ).resolves.toMatchObject({ payload: { actions: [{ outcome: "stale" }] } });
    expect(writes).toBe(0);
  });

  it("legacy claimant と Temporal workflow の cutover 並行実行でも CAS winner だけ dispatch", async () => {
    const now = await env.currentTimeMs();
    let state: "approved" | "prod_deploying" = "approved";
    let writes = 0;
    const claim = async () => {
      await Promise.resolve();
      if (state === "prod_deploying") return cas("stale", "approved", state);
      state = "prod_deploying";
      return cas("created", "approved", state);
    };
    const legacy = async () => {
      const receipt = await claim();
      if ((receipt.payload as { kind: string }).kind === "created") writes += 1;
    };
    const temporal = execute(
      "deployDispatchWorkflow",
      request("deploy-dispatch", now, "active"),
      activities({
        claimDeploymentTransition: claim,
        async dispatchDeployment(_input: unknown, key: string) {
          writes += 1;
          return effect("deploy", key);
        },
      }),
      "dispatch-cutover-parallel",
    );

    await Promise.all([legacy(), temporal]);
    expect(writes).toBe(1);
  });

  it("dispatched_at CAS stale 後は legacy が作った approved row を再読し、state CAS winner だけ dispatch", async () => {
    const now = await env.currentTimeMs();
    let reads = 0;
    let writes = 0;
    await expect(
      execute(
        "deployDispatchWorkflow",
        request("deploy-dispatch", now, "active"),
        activities({
          async findDeployDispatchPlans() {
            reads += 1;
            return plans("deploy-dispatch", reads === 1 ? [] : [dispatchPlan]);
          },
          async dispatchDeployment(_input: unknown, key: string) {
            writes += 1;
            return effect("deploy", key);
          },
        }),
        "dispatch-claim-race",
      ),
    ).resolves.toMatchObject({ payload: { actions: [{ outcome: "executed" }] } });
    expect({ reads, writes }).toEqual({ reads: 2, writes: 1 });
  });

  it("shadow は approved work item 不在時に claim activity を呼ばない", async () => {
    const now = await env.currentTimeMs();
    let claims = 0;
    await expect(
      execute(
        "deployDispatchWorkflow",
        request("deploy-dispatch", now, "shadow"),
        activities({
          async findDeployDispatchPlans() {
            return plans("deploy-dispatch", []);
          },
          async claimApprovedDeployment() {
            claims += 1;
          },
        }),
        "dispatch-d16",
      ),
    ).resolves.toMatchObject({ payload: { outcome: "shadowed", actions: [] } });
    expect(claims).toBe(0);
  });

  it("D-04: workflow unavailable は approved→dispatch_failed CAS だけで external write しない", async () => {
    const now = await env.currentTimeMs();
    const transitions: string[] = [];
    let writes = 0;
    await expect(
      execute(
        "deployDispatchWorkflow",
        request("deploy-dispatch", now, "active"),
        activities({
          async findDeployDispatchPlans() {
            return plans("deploy-dispatch", [{ kind: "blocked", target, reason: "workflow-unavailable" }]);
          },
          async claimDeploymentTransition(input: { payload: { from: string; to: string } }) {
            transitions.push(`${input.payload.from}->${input.payload.to}`);
            return cas("created", input.payload.from, input.payload.to);
          },
          async dispatchDeployment() {
            writes += 1;
          },
        }),
        "dispatch-d04",
      ),
    ).resolves.toMatchObject({ payload: { actions: [{ outcome: "blocked" }] } });
    expect({ transitions, writes }).toEqual({ transitions: ["approved->dispatch_failed"], writes: 0 });
  });

  it("pending effect ledger は成功にも absent にもせず再送しない", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const failure = execute(
      "deployDispatchWorkflow",
      request("deploy-dispatch", now, "active"),
      activities({
        async findDeploymentEffect(_input: unknown, _key: string) {
          return envelope({ status: "pending", deployId: DEPLOY_ID, effect: "deploy" });
        },
        async dispatchDeployment() {
          writes += 1;
        },
      }),
      "dispatch-pending",
    ).catch((error: unknown) => error);
    await expect(failure).resolves.toMatchObject({ cause: { type: "E-CP-EXTERNAL-UNRESOLVED", nonRetryable: true } });
    expect(writes).toBe(0);
  });

  it("response loss は同じ key の sent ledger で reconcile し再送しない", async () => {
    const now = await env.currentTimeMs();
    const sent = new Map<string, unknown>();
    let writes = 0;
    await expect(
      execute(
        "deployDispatchWorkflow",
        request("deploy-dispatch", now, "active"),
        activities({
          async findDeploymentEffect(_input: unknown, key: string) {
            return sent.get(key) ?? null;
          },
          async dispatchDeployment(_input: unknown, key: string) {
            writes += 1;
            sent.set(key, envelope({ status: "sent", deployId: DEPLOY_ID, effect: "deploy", idempotencyKey: key }));
            throw new Error("lost response");
          },
        }),
        "dispatch-reconcile",
      ),
    ).resolves.toMatchObject({ payload: { actions: [{ outcome: "reconciled" }] } });
    expect(writes).toBe(1);
  });
});

describe("P3-T13 ProdMonitorWorkflow [DevOps:REQ-012 / TH-003]", () => {
  it("monitoring→rolling_back CAS、rollback、rolling_back→rolled_back の順で完了", async () => {
    const now = await env.currentTimeMs();
    const order: string[] = [];
    const resultPromise = execute(
      "prodMonitorWorkflow",
      request("prod-monitor", now, "active"),
      activities({
        async claimDeploymentTransition(input: { payload: { from: string; to: string } }) {
          order.push(`${input.payload.from}->${input.payload.to}`);
          return cas("created", input.payload.from, input.payload.to);
        },
        async dispatchRollback(_input: unknown, key: string) {
          order.push("rollback");
          return effect("rollback", key);
        },
      }),
      "monitor-active",
    );
    await env.sleep(PROD_MONITOR_INTERVAL_MS);
    await expect(resultPromise).resolves.toMatchObject({ payload: { actions: [{ outcome: "executed" }] } });
    expect(order).toEqual(["monitoring->rolling_back", "rollback", "rolling_back->rolled_back"]);
  });

  it("malformed plan は E-CP-CONTRACT、external write 0", async () => {
    const now = await env.currentTimeMs();
    let writes = 0;
    const failure = execute(
      "prodMonitorWorkflow",
      request("prod-monitor", now, "active"),
      activities({
        async planProdMonitor() {
          return plans("prod-monitor", [{ ...rollbackPlan, targetVersion: " " }]);
        },
        async dispatchRollback() {
          writes += 1;
        },
      }),
      "monitor-contract",
    ).catch((error: unknown) => error);
    await env.sleep(PROD_MONITOR_INTERVAL_MS);
    await expect(failure).resolves.toMatchObject({ cause: { type: "E-CP-CONTRACT", nonRetryable: true } });
    expect(writes).toBe(0);
  });
});
