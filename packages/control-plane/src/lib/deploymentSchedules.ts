// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TMP-005 / ADR-0021
// deploy dispatch / prod monitor の有限 workflow を recurring Schedule に写像する。

import type { ScheduleOptions } from "@temporalio/client";

import {
  DEPLOY_DISPATCH_INTERVAL_MS,
  PROD_MONITOR_INTERVAL_MS,
  assertDeploymentWorkflowRequest,
  buildDeployDispatchWorkflowId,
  buildProdMonitorWorkflowId,
  type DeploymentWorkflowOperation,
} from "./deploymentState.js";

export interface DeploymentScheduleRegistration {
  readonly executionMode?: "shadow" | "active";
  readonly sequence: number;
  readonly observedAtMs: number;
  readonly taskQueue: string;
}

export function buildDeploymentSchedules(registration: DeploymentScheduleRegistration): ScheduleOptions[] {
  if (typeof registration.taskQueue !== "string" || !registration.taskQueue.trim()) {
    throw new RangeError("taskQueue must be nonblank");
  }
  return (["deploy-dispatch", "prod-monitor"] as const).map((operation: DeploymentWorkflowOperation) => {
    const input = {
      schemaVersion: 1 as const,
      payload: {
        operation,
        executionMode: registration.executionMode ?? "shadow",
        sequence: registration.sequence,
        observedAtMs: registration.observedAtMs,
      },
    };
    assertDeploymentWorkflowRequest(input);
    const every = operation === "deploy-dispatch" ? DEPLOY_DISPATCH_INTERVAL_MS : PROD_MONITOR_INTERVAL_MS;
    const startAtMs = registration.observedAtMs + (operation === "deploy-dispatch" ? 0 : every);
    const workflowId =
      operation === "deploy-dispatch"
        ? buildDeployDispatchWorkflowId(registration.sequence)
        : buildProdMonitorWorkflowId(registration.sequence);
    return {
      scheduleId: `${workflowId}/schedule`,
      spec: { intervals: [{ every, offset: startAtMs % every }], startAt: new Date(startAtMs) },
      action: {
        type: "startWorkflow",
        workflowType: operation === "deploy-dispatch" ? "deployDispatchWorkflow" : "prodMonitorWorkflow",
        taskQueue: registration.taskQueue,
        workflowId,
        args: [input],
      },
      policies: { overlap: "SKIP", catchupWindow: every, pauseOnFailure: false },
    };
  });
}
