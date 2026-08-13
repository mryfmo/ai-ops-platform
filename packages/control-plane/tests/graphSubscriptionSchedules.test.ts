// 根拠: FinalArch:FR-CP-004 / TMP-003 / ADR-0021
import { describe, expect, it, vi } from "vitest";

import {
  GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS,
  GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS,
} from "../src/lib/graphSubscriptionState.js";
import { buildGraphSubscriptionSchedules } from "../src/lib/graphSubscriptionSchedules.js";
import { registerGraphSubscriptionSchedules } from "../src/workflows/graphSubscriptionScheduleRegistration.js";

describe("FinalArch:FR-CP-004 Graph subscription Temporal schedules", () => {
  const registration = {
    subscriptionId: "subscription-1",
    executionMode: "shadow" as const,
    sequence: 0,
    observedAtMs: 1_000,
    expiresAtMs: 1_000 + GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS + 30 * 60_000,
    taskQueue: "aiops-control-plane",
  };

  it("renewal/delta/reconcile を recurring Schedule として構築する", () => {
    const schedules = buildGraphSubscriptionSchedules(registration);
    expect(schedules.map((schedule) => schedule.scheduleId)).toEqual([
      "graph-subscription/renewal:subscription-1:0/schedule",
      "graph-subscription/delta:subscription-1:0/schedule",
      "graph-subscription/reconcile:subscription-1:0/schedule",
    ]);
    expect(schedules.map((schedule) => schedule.spec.intervals?.[0]?.every)).toEqual([
      GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS - GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS,
      GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
      GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
    ]);
    expect(schedules.every((schedule) => schedule.action.type === "startWorkflow")).toBe(true);
    expect(schedules.every((schedule) => schedule.action.workflowType === "graphSubscriptionWorkflow")).toBe(true);
    expect(schedules.every((schedule) => schedule.policies?.overlap === "SKIP")).toBe(true);
    for (const schedule of schedules) {
      const every = schedule.spec.intervals?.[0]?.every as number;
      const startAtMs = schedule.spec.startAt?.getTime() as number;
      expect(schedule.spec.intervals?.[0]?.offset).toBe(startAtMs % every);
    }
    expect(schedules[0]?.policies?.catchupWindow).toBe(GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS);
    expect(schedules[1]?.policies?.catchupWindow).toBe(GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS);
  });

  it("3 schedules を注入 client へ登録する", async () => {
    const create = vi.fn(async () => undefined);
    await registerGraphSubscriptionSchedules({ create }, registration);
    expect(create).toHaveBeenCalledTimes(3);
  });
});
