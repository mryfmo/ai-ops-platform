// 根拠: FinalArch:FR-CP-004 / TMP-003 / ADR-0021
// Graph subscription の有限 workflow を recurring Temporal Schedule として登録する。

import type { ScheduleOptions } from "@temporalio/client";

import {
  assertGraphSubscriptionRequest,
  GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RECONCILE_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS,
  GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS,
  type GraphSubscriptionOperation,
} from "./graphSubscriptionState.js";
import { buildWorkflowId } from "./workflowId.js";

export interface GraphSubscriptionScheduleRegistration {
  readonly subscriptionId: string;
  readonly executionMode: "shadow" | "active";
  readonly sequence: number;
  readonly observedAtMs: number;
  readonly expiresAtMs: number;
  readonly taskQueue: string;
}

export function buildGraphSubscriptionSchedules(
  registration: GraphSubscriptionScheduleRegistration,
): ScheduleOptions[] {
  if (typeof registration.taskQueue !== "string" || registration.taskQueue.trim().length === 0) {
    throw new RangeError("taskQueue must be nonblank");
  }
  const request = (operation: GraphSubscriptionOperation) => ({
    schemaVersion: 1 as const,
    payload:
      operation === "renewal"
        ? {
            subscriptionId: registration.subscriptionId,
            operation,
            executionMode: registration.executionMode,
            sequence: registration.sequence,
            observedAtMs: registration.observedAtMs,
            expiresAtMs: registration.expiresAtMs,
          }
        : {
            subscriptionId: registration.subscriptionId,
            operation,
            executionMode: registration.executionMode,
            sequence: registration.sequence,
            observedAtMs: registration.observedAtMs,
          },
  });
  const operations = ["renewal", "delta", "reconcile"] as const;
  return operations.map((operation) => {
    const input = request(operation);
    assertGraphSubscriptionRequest(input);
    const workflowId = buildWorkflowId(
      "graph-subscription",
      `${operation}:${registration.subscriptionId}:${String(registration.sequence)}`,
    );
    const every =
      operation === "renewal"
        ? GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS - GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS
        : operation === "delta"
          ? GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS
          : GRAPH_SUBSCRIPTION_RECONCILE_INTERVAL_MS;
    const startAtMs =
      operation === "renewal"
        ? Math.max(registration.observedAtMs, registration.expiresAtMs - GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS)
        : registration.observedAtMs + every;
    return {
      scheduleId: `${workflowId}/schedule`,
      spec: { intervals: [{ every, offset: startAtMs % every }], startAt: new Date(startAtMs) },
      action: {
        type: "startWorkflow",
        workflowType: "graphSubscriptionWorkflow",
        taskQueue: registration.taskQueue,
        workflowId,
        args: [input],
      },
      policies: {
        overlap: "SKIP",
        catchupWindow:
          operation === "renewal" ? GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS : GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
        pauseOnFailure: false,
      },
    };
  });
}
