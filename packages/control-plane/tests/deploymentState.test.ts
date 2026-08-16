// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-003 / TMP-005
import { describe, expect, it } from "vitest";

import {
  DEPLOY_DISPATCH_INTERVAL_MS,
  PROD_MONITOR_INTERVAL_MS,
  assertDeploymentWorkflowRequest,
  buildDeployDispatchWorkflowId,
  buildProdMonitorWorkflowId,
  deploymentScheduleDelayMs,
  parseDeploymentCasReceipt,
  parseApprovedDeploymentClaimReceipt,
  parseDeploymentEffectStatus,
  parseDeploymentPlans,
} from "../src/lib/deploymentState.js";

const DEPLOY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const target = {
  deployId: DEPLOY_ID,
  projectId: "PJ-001",
  owner: "acme",
  repo: "widget",
  commitSha: "a".repeat(40),
};
const deployPlan = { kind: "dispatch", target };
const monitorPlan = {
  kind: "rollback",
  target: { ...target, channel: { teamId: "team", channelId: "channel" } },
  targetVersion: "v1",
  matchedConditions: ["a"],
};

describe("P3-T13 deployment workflow request boundary [TMP-003/TMP-005]", () => {
  it.each(["deploy-dispatch", "prod-monitor"] as const)("%s request を unknown から検証", (operation) => {
    const input = {
      schemaVersion: 1,
      payload: { operation, executionMode: "shadow", sequence: 0, observedAtMs: 1_000 },
    };
    expect(() => assertDeploymentWorkflowRequest(input)).not.toThrow();
  });

  it.each([
    null,
    {},
    { schemaVersion: 2, payload: {} },
    { schemaVersion: 1, payload: { operation: "deploy", executionMode: "shadow", sequence: 0, observedAtMs: 0 } },
    {
      schemaVersion: 1,
      payload: { operation: "deploy-dispatch", executionMode: "primary", sequence: 0, observedAtMs: 0 },
    },
    {
      schemaVersion: 1,
      payload: { operation: "deploy-dispatch", executionMode: "shadow", sequence: -1, observedAtMs: 0 },
    },
  ])("malformed request %# を拒否", (input) => {
    expect(() => assertDeploymentWorkflowRequest(input)).toThrow(RangeError);
  });

  it("D-16: staging promotion / critical-count fallback は post-approval workflow contract に入れない", () => {
    expect(() =>
      assertDeploymentWorkflowRequest({
        schemaVersion: 1,
        payload: {
          operation: "staging-promote",
          executionMode: "active",
          sequence: 0,
          observedAtMs: 0,
          criticalCount: 0,
        },
      }),
    ).toThrow(RangeError);
  });

  it("workflow ID と cadence は決定的で approved deploy だけ即時", () => {
    expect(buildDeployDispatchWorkflowId(7)).toBe("incident/deploy-dispatch:global:7");
    expect(buildProdMonitorWorkflowId(7)).toBe("incident/prod-monitor:global:7");
    expect(
      deploymentScheduleDelayMs(
        { operation: "deploy-dispatch", executionMode: "shadow", sequence: 0, observedAtMs: 1_000 },
        1_000,
      ),
    ).toBe(0);
    expect(
      deploymentScheduleDelayMs(
        { operation: "prod-monitor", executionMode: "shadow", sequence: 0, observedAtMs: 1_000 },
        1_000,
      ),
    ).toBe(PROD_MONITOR_INTERVAL_MS);
    expect(DEPLOY_DISPATCH_INTERVAL_MS).toBe(30_000);
  });
});

describe("P3-T13 plan / CAS / external ledger contracts", () => {
  it("deploy と monitor plans は operation と canonical target に束縛", () => {
    expect(
      parseDeploymentPlans(
        { schemaVersion: 1, payload: { operation: "deploy-dispatch", plans: [deployPlan] } },
        "deploy-dispatch",
      ),
    ).toEqual([deployPlan]);
    expect(
      parseDeploymentPlans(
        { schemaVersion: 1, payload: { operation: "prod-monitor", plans: [monitorPlan] } },
        "prod-monitor",
      ),
    ).toEqual([monitorPlan]);
  });

  it("wrong operation / duplicate deployId / malformed identity を拒否", () => {
    expect(() =>
      parseDeploymentPlans(
        { schemaVersion: 1, payload: { operation: "prod-monitor", plans: [deployPlan] } },
        "deploy-dispatch",
      ),
    ).toThrow(RangeError);
    expect(() =>
      parseDeploymentPlans(
        { schemaVersion: 1, payload: { operation: "deploy-dispatch", plans: [deployPlan, deployPlan] } },
        "deploy-dispatch",
      ),
    ).toThrow(RangeError);
    expect(() =>
      parseDeploymentPlans(
        {
          schemaVersion: 1,
          payload: {
            operation: "deploy-dispatch",
            plans: [{ ...deployPlan, target: { ...target, commitSha: "bad" } }],
          },
        },
        "deploy-dispatch",
      ),
    ).toThrow(RangeError);
  });

  it("CAS created は requested transition に完全束縛", () => {
    expect(
      parseDeploymentCasReceipt(
        { schemaVersion: 1, payload: { kind: "created", deployId: DEPLOY_ID, from: "approved", to: "prod_deploying" } },
        DEPLOY_ID,
        "approved",
        "prod_deploying",
      ),
    ).toEqual({ kind: "created", deployId: DEPLOY_ID, from: "approved", to: "prod_deploying" });
  });

  it("dispatched_at claim は created|stale union で key と plan に束縛", () => {
    const key = `${buildDeployDispatchWorkflowId(0)}#claimApprovedDeployment#0`;
    expect(
      parseApprovedDeploymentClaimReceipt(
        { schemaVersion: 1, payload: { kind: "created", idempotencyKey: key, plan: deployPlan } },
        key,
      ),
    ).toEqual({ kind: "created", idempotencyKey: key, plan: deployPlan });
    expect(
      parseApprovedDeploymentClaimReceipt({ schemaVersion: 1, payload: { kind: "stale", idempotencyKey: key } }, key),
    ).toEqual({ kind: "stale", idempotencyKey: key });
    expect(() =>
      parseApprovedDeploymentClaimReceipt(
        { schemaVersion: 1, payload: { kind: "created", idempotencyKey: "wrong", plan: deployPlan } },
        key,
      ),
    ).toThrow(RangeError);
  });

  it("CAS stale は observed state 必須、expected state と同値の矛盾 receipt を拒否", () => {
    expect(
      parseDeploymentCasReceipt(
        {
          schemaVersion: 1,
          payload: { kind: "stale", deployId: DEPLOY_ID, expectedState: "approved", observedState: "prod_deploying" },
        },
        DEPLOY_ID,
        "approved",
        "prod_deploying",
      ),
    ).toEqual({ kind: "stale", deployId: DEPLOY_ID, expectedState: "approved", observedState: "prod_deploying" });
    expect(() =>
      parseDeploymentCasReceipt(
        {
          schemaVersion: 1,
          payload: { kind: "stale", deployId: DEPLOY_ID, expectedState: "approved", observedState: "approved" },
        },
        DEPLOY_ID,
        "approved",
        "prod_deploying",
      ),
    ).toThrow(RangeError);
  });

  it("external ledger は absent|pending|sent 三値で sent receipt を key に束縛", () => {
    const key = `${buildDeployDispatchWorkflowId(0)}#dispatchDeployment#0`;
    expect(parseDeploymentEffectStatus(null, DEPLOY_ID, "deploy", key)).toEqual({ status: "absent" });
    expect(
      parseDeploymentEffectStatus(
        { schemaVersion: 1, payload: { status: "pending", deployId: DEPLOY_ID, effect: "deploy" } },
        DEPLOY_ID,
        "deploy",
        key,
      ),
    ).toEqual({ status: "pending" });
    expect(
      parseDeploymentEffectStatus(
        { schemaVersion: 1, payload: { status: "sent", deployId: DEPLOY_ID, effect: "deploy", idempotencyKey: key } },
        DEPLOY_ID,
        "deploy",
        key,
      ),
    ).toEqual({ status: "sent", receipt: { deployId: DEPLOY_ID, effect: "deploy", idempotencyKey: key } });
    expect(() =>
      parseDeploymentEffectStatus(
        {
          schemaVersion: 1,
          payload: { status: "sent", deployId: DEPLOY_ID, effect: "deploy", idempotencyKey: "wrong" },
        },
        DEPLOY_ID,
        "deploy",
        key,
      ),
    ).toThrow(RangeError);
  });
});
