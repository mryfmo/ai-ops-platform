// 根拠: FinalArch:FR-CP-004 / FinalArch:FR-CP-005 / TMP-001 / TMP-003 / ADR-0021
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import proto from "@temporalio/proto";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");
const fixtures = [
  "graph-subscription.renewal-lost-response.history.json",
  "graph-subscription.shadow-no-duplicate.history.json",
  "graph-subscription.delta.history.json",
  "graph-subscription.reconcile.history.json",
] as const;

function loadHistory(fixture: string): proto.temporal.api.history.v1.History {
  const raw = fs.readFileSync(path.join(packageRoot, "tests", "fixtures", fixture), "utf8");
  return proto.temporal.api.history.v1.History.fromObject(JSON.parse(raw) as Record<string, unknown>);
}

function scheduledActivityNames(history: proto.temporal.api.history.v1.History): string[] {
  return history.events
    .filter((event) => event.activityTaskScheduledEventAttributes != null)
    .map((event) => event.activityTaskScheduledEventAttributes?.activityType?.name ?? "");
}

describe("TMP-001 GraphSubscriptionWorkflow recorded history", () => {
  it.each(fixtures)(
    "%s を現行 workflow code で replay できる",
    async (fixture) => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    },
    60_000,
  );

  it("TMP-003 lost-response は renew 1回 + authoritative reconcile で回収する", () => {
    const history = loadHistory(fixtures[0]);
    const names = scheduledActivityNames(history);
    expect(names.filter((name) => name === "renewGraphSubscription")).toHaveLength(1);
    expect(names.filter((name) => name === "findGraphSubscriptionRenewal")).toHaveLength(2);
    const renew = history.events.find(
      (event) => event.activityTaskScheduledEventAttributes?.activityType?.name === "renewGraphSubscription",
    );
    expect(renew?.activityTaskScheduledEventAttributes?.startToCloseTimeout?.seconds?.toString()).toBe("259200");
    expect(renew?.activityTaskScheduledEventAttributes?.heartbeatTimeout?.seconds?.toString()).toBe("60");
  });

  it("TMP-003 old scheduler 先行 fixture は renew を schedule しない", () => {
    const names = scheduledActivityNames(loadHistory(fixtures[1]));
    expect(names).toEqual(["findGraphSubscriptionRenewal"]);
  });

  it("delta/reconcile fixture はそれぞれの activity だけを schedule する", () => {
    const deltaHistory = loadHistory(fixtures[2]);
    expect(scheduledActivityNames(deltaHistory)).toEqual(["runGraphSubscriptionDelta"]);
    const delta = deltaHistory.events.find(
      (event) => event.activityTaskScheduledEventAttributes?.activityType?.name === "runGraphSubscriptionDelta",
    );
    expect(delta?.activityTaskScheduledEventAttributes?.startToCloseTimeout?.seconds?.toString()).toBe("259200");
    expect(delta?.activityTaskScheduledEventAttributes?.heartbeatTimeout?.seconds?.toString()).toBe("60");
    expect(scheduledActivityNames(loadHistory(fixtures[3]))).toEqual(["reconcileGraphSubscription"]);
  });
});
