// 根拠: DevOps:SPEC-INT-032 / DevOps:SPEC-INT-040 / REQ-029 / TH-007 / TMP-001 / TMP-003 / ADR-0021
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import proto from "@temporalio/proto";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");
const fixtures = [
  "jit-health.jit-lost-response.history.json",
  "jit-health.jit-shadow-no-duplicate.history.json",
  "jit-health.health.history.json",
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

describe("TMP-001 JIT・health recorded history", () => {
  it.each(fixtures)(
    "%s を現行 workflow code で replay できる",
    async (fixture) => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    },
    60_000,
  );

  it("TMP-003 lost-response は revoke 1回 + authoritative reconcile で回収する", () => {
    const names = scheduledActivityNames(loadHistory(fixtures[0]));
    expect(names.filter((name) => name === "revokeExpiredGrant")).toHaveLength(1);
    expect(names.filter((name) => name === "findJitRevocation")).toHaveLength(2);
    const revoke = loadHistory(fixtures[0]).events.find(
      (event) => event.activityTaskScheduledEventAttributes?.activityType?.name === "revokeExpiredGrant",
    );
    expect(revoke?.activityTaskScheduledEventAttributes?.retryPolicy?.maximumAttempts).toBe(1);
  });

  it("shadow fixture は legacy revoke を authority read で回収し write を schedule しない", () => {
    expect(scheduledActivityNames(loadHistory(fixtures[1]))).toEqual([
      "findJitRevocationCandidates",
      "findJitRevocation",
    ]);
  });

  it("health fixture は evaluate と idempotent apply だけを schedule する", () => {
    expect(scheduledActivityNames(loadHistory(fixtures[2]))).toEqual(["evaluateHealth", "applyHealthDecision"]);
  });
});
