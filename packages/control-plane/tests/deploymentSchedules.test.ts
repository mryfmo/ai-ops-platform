// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TMP-005 / ADR-0021
import { describe, expect, it } from "vitest";

import { buildDeploymentSchedules } from "../src/lib/deploymentSchedules.js";
import { DEPLOY_DISPATCH_INTERVAL_MS, PROD_MONITOR_INTERVAL_MS } from "../src/lib/deploymentState.js";

describe("P3-T13 deploy/monitor Temporal Schedules [TMP-005]", () => {
  it("default shadow で immediate approved-deploy と 60s prod-monitor cadence を構築", () => {
    const observedAtMs = 1_000;
    const schedules = buildDeploymentSchedules({ sequence: 0, observedAtMs, taskQueue: "temporal-shadow" });
    expect(schedules.map((schedule) => schedule.action.workflowType)).toEqual([
      "deployDispatchWorkflow",
      "prodMonitorWorkflow",
    ]);
    expect(schedules.map((schedule) => schedule.spec.intervals?.[0]?.every)).toEqual([
      DEPLOY_DISPATCH_INTERVAL_MS,
      PROD_MONITOR_INTERVAL_MS,
    ]);
    expect(schedules.map((schedule) => schedule.spec.startAt?.getTime())).toEqual([
      observedAtMs,
      observedAtMs + PROD_MONITOR_INTERVAL_MS,
    ]);
    expect(schedules.every((schedule) => schedule.policies?.overlap === "SKIP")).toBe(true);
    expect(
      schedules.map(
        (schedule) => (schedule.action.args?.[0] as { payload: { executionMode: string } }).payload.executionMode,
      ),
    ).toEqual(["shadow", "shadow"]);
  });

  it("active は explicit で、blank taskQueue は拒否", () => {
    expect(
      buildDeploymentSchedules({ executionMode: "active", sequence: 1, observedAtMs: 0, taskQueue: "q" }).map(
        (schedule) => (schedule.action.args?.[0] as { payload: { executionMode: string } }).payload.executionMode,
      ),
    ).toEqual(["active", "active"]);
    expect(() => buildDeploymentSchedules({ sequence: 0, observedAtMs: 0, taskQueue: " " })).toThrow(RangeError);
  });
});
