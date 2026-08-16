// 根拠: PrjOps:REQ-004/005 / FinalArch:ING-001 / TMP-001 / TMP-003 / ADR-0020
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import proto from "@temporalio/proto";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");
const history = proto.temporal.api.history.v1.History.fromObject(
  JSON.parse(
    fs.readFileSync(path.join(packageRoot, "tests/fixtures/status-ingest.accept.history.json"), "utf8"),
  ) as Record<string, unknown>,
);

describe("FinalArch:ING-001 / TMP-001 status ingest recorded history", () => {
  it("records claim, reconciled single-attempt effects, CAS completion, and both audits in order", () => {
    const scheduled = history.events
      .filter((event) => event.activityTaskScheduledEventAttributes !== null)
      .map((event) => event.activityTaskScheduledEventAttributes?.activityType?.name ?? "");
    expect(scheduled).toEqual([
      "claimStatusIngest",
      "findStatusIngestSideEffect",
      "appendStatusIngestAudit",
      "findStatusIngestSideEffect",
      "persistCanonicalStatusUpdate",
      "findStatusIngestSideEffect",
      "sendStatusIngestNotification",
      "completeStatusIngest",
      "findStatusIngestSideEffect",
      "appendStatusIngestAudit",
    ]);
    for (const name of ["appendStatusIngestAudit", "persistCanonicalStatusUpdate", "sendStatusIngestNotification"]) {
      const activity = history.events.find(
        (event) => event.activityTaskScheduledEventAttributes?.activityType?.name === name,
      );
      expect(activity?.activityTaskScheduledEventAttributes?.retryPolicy?.maximumAttempts).toBe(1);
    }
  });

  it("replays against the current workflow bundle", async () => {
    await expect(Worker.runReplayHistory({ workflowsPath }, history)).resolves.toBeUndefined();
  }, 60_000);
});
