// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-001 / TMP-003 / TMP-005
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import proto from "@temporalio/proto";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");
const fixtures = [
  "deployment.dispatch-reconciled.history.json",
  "deployment.dispatch-cutover-stale.history.json",
  "deployment.monitor-rollback.history.json",
] as const;

function loadHistory(fixture: string): proto.temporal.api.history.v1.History {
  return proto.temporal.api.history.v1.History.fromObject(
    JSON.parse(fs.readFileSync(path.join(packageRoot, "tests", "fixtures", fixture), "utf8")) as Record<
      string,
      unknown
    >,
  );
}

function scheduledNames(history: proto.temporal.api.history.v1.History): string[] {
  return history.events
    .filter((event) => event.activityTaskScheduledEventAttributes != null)
    .map((event) => event.activityTaskScheduledEventAttributes?.activityType?.name ?? "");
}

describe("TMP-001/TMP-003 P3-T13 deployment recorded histories", () => {
  it("lost response は dispatch 1回 + same-key reconcile", () => {
    const history = loadHistory(fixtures[0]);
    const names = scheduledNames(history);
    expect(names).toEqual([
      "findDeployDispatchPlans",
      "claimDeploymentTransition",
      "findDeploymentEffect",
      "dispatchDeployment",
      "findDeploymentEffect",
    ]);
    const dispatch = history.events.find(
      (event) => event.activityTaskScheduledEventAttributes?.activityType?.name === "dispatchDeployment",
    );
    expect(dispatch?.activityTaskScheduledEventAttributes?.retryPolicy?.maximumAttempts).toBe(1);
  });

  it("cutover CAS stale loser は external dispatch 0", () => {
    expect(scheduledNames(loadHistory(fixtures[1]))).toEqual(["findDeployDispatchPlans", "claimDeploymentTransition"]);
  });

  it("prod monitor は 2 CAS の間に rollback を一度だけ配置", () => {
    expect(scheduledNames(loadHistory(fixtures[2]))).toEqual([
      "planProdMonitor",
      "claimDeploymentTransition",
      "findDeploymentEffect",
      "dispatchRollback",
      "claimDeploymentTransition",
    ]);
  });

  it("fixture ごとに異なる workflow sequence を記録", () => {
    const sequences = fixtures.map((fixture) => {
      const payload = loadHistory(fixture).events[0]?.workflowExecutionStartedEventAttributes?.input?.payloads?.[0];
      const data = payload?.data;
      if (data === undefined) throw new Error(`missing workflow input in ${fixture}`);
      const input = JSON.parse(Buffer.from(data).toString("utf8")) as { payload: { sequence: number } };
      return input.payload.sequence;
    });
    expect(sequences).toEqual([7001, 7002, 7003]);
    expect(new Set(sequences).size).toBe(fixtures.length);
  });

  it.each(fixtures)(
    "%s は unique workflow ID history で replay green",
    async (fixture) => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    },
    60_000,
  );
});
