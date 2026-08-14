// 根拠: DevOps:SPEC-INT-032 / DevOps:SPEC-INT-040 / REQ-029 / TH-007 / ADR-0021
// JIT 失効と health evaluation の有限 workflow を recurring Temporal Schedule として登録する。

import type { ScheduleOptions } from "@temporalio/client";

import {
  HEALTH_EVALUATION_INTERVAL_MS,
  JIT_EXPIRY_INTERVAL_MS,
  assertJitHealthRequest,
  buildHealthEvaluationWorkflowId,
  buildJitExpiryWorkflowId,
  type JitHealthRequest,
} from "./jitHealthState.js";

export interface JitHealthScheduleRegistration {
  readonly executionMode: "shadow" | "active";
  readonly sequence: number;
  readonly observedAtMs: number;
  readonly taskQueue: string;
}

export function buildJitHealthSchedules(registration: JitHealthScheduleRegistration): ScheduleOptions[] {
  if (typeof registration.taskQueue !== "string" || registration.taskQueue.trim().length === 0) {
    throw new RangeError("taskQueue must be nonblank");
  }
  const operations = ["jit-expiry", "health"] as const;
  return operations.map((operation) => {
    const payload: JitHealthRequest = {
      operation,
      executionMode: registration.executionMode,
      sequence: registration.sequence,
      observedAtMs: registration.observedAtMs,
    };
    const input = { schemaVersion: 1 as const, payload };
    assertJitHealthRequest(input);
    const every = operation === "jit-expiry" ? JIT_EXPIRY_INTERVAL_MS : HEALTH_EVALUATION_INTERVAL_MS;
    const startAtMs = registration.observedAtMs + every;
    const workflowId =
      operation === "jit-expiry"
        ? buildJitExpiryWorkflowId(registration.sequence)
        : buildHealthEvaluationWorkflowId(registration.sequence);
    return {
      scheduleId: `${workflowId}/schedule`,
      spec: { intervals: [{ every, offset: startAtMs % every }], startAt: new Date(startAtMs) },
      action: {
        type: "startWorkflow",
        workflowType: operation === "jit-expiry" ? "jitExpiryWorkflow" : "healthEvaluationWorkflow",
        taskQueue: registration.taskQueue,
        workflowId,
        args: [input],
      },
      policies: { overlap: "SKIP", catchupWindow: every, pauseOnFailure: false },
    };
  });
}
