// 根拠: FinalArch:FR-CP-001 / TMP-001 / ADR-0030
// Jira sync の recorded history を親 orchestration と child activity 証跡の両方で検証する。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import proto from "@temporalio/proto";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");

function loadHistory(fixture: string): proto.temporal.api.history.v1.History {
  const raw = fs.readFileSync(path.join(packageRoot, "tests", "fixtures", fixture), "utf8");
  return proto.temporal.api.history.v1.History.fromObject(JSON.parse(raw) as Record<string, unknown>);
}

function scheduledActivityAttrs(history: proto.temporal.api.history.v1.History) {
  return history.events
    .filter((event) => event.activityTaskScheduledEventAttributes != null)
    .map((event) => event.activityTaskScheduledEventAttributes);
}

function scheduledNames(history: proto.temporal.api.history.v1.History): string[] {
  return scheduledActivityAttrs(history).map((attributes) => attributes?.activityType?.name ?? "");
}

function childWorkflowTypes(history: proto.temporal.api.history.v1.History): string[] {
  return history.events
    .filter((event) => event.startChildWorkflowExecutionInitiatedEventAttributes != null)
    .map((event) => event.startChildWorkflowExecutionInitiatedEventAttributes?.workflowType?.name ?? "");
}

function decodeResult(history: proto.temporal.api.history.v1.History): {
  payload: { phase: string; outcomes: Array<{ operation: string; outcome: string }> };
} {
  const completed = history.events.find((event) => event.workflowExecutionCompletedEventAttributes != null);
  const data = completed?.workflowExecutionCompletedEventAttributes?.result?.payloads?.[0]?.data;
  if (data == null) throw new Error("completed result payload not found in fixture");
  return JSON.parse(Buffer.from(data).toString("utf8")) as never;
}

function decodeChildOutcome(history: proto.temporal.api.history.v1.History): {
  payload: { operation: string; outcome: string };
} {
  return decodeResult(history) as never;
}

const replayFixtures = [
  "jira-sync.complete.history.json",
  "jira-sync.complete.projection.history.json",
  "jira-sync.complete.event.history.json",
  "jira-sync.complete.promotion.history.json",
  "jira-sync.unknown-write-reconciled.history.json",
  "jira-sync.unknown-write-reconciled.projection.history.json",
  "jira-sync.promotion-stale.history.json",
  "jira-sync.promotion-stale.promotion.history.json",
  "jira-sync.promotion-not-eligible.history.json",
  "jira-sync.promotion-not-eligible.promotion.history.json",
  "jira-sync.shadow.history.json",
  "jira-sync.shadow.projection.history.json",
  "jira-sync.shadow.event.history.json",
  "jira-sync.shadow.promotion.history.json",
  "jira-sync.transition-authorized.history.json",
  "jira-sync.transition-authorized.transition.history.json",
  "jira-sync.transition-stale.history.json",
  "jira-sync.transition-stale.transition.history.json",
] as const;

describe("FinalArch:FR-CP-001 / TMP-001 Jira sync recorded history", () => {
  it("ADR-0030 complete: 親は 3 child を分離し、child は read と one-shot write を記録する", () => {
    const parent = loadHistory("jira-sync.complete.history.json");
    expect(decodeResult(parent).payload).toMatchObject({
      phase: "complete",
      outcomes: [
        { operation: "projection", outcome: "reconciled" },
        { operation: "event", outcome: "executed" },
        { operation: "promotion", outcome: "executed" },
      ],
    });
    expect(childWorkflowTypes(parent)).toEqual([
      "jiraProjectionWorkflow",
      "jiraEventWorkflow",
      "jiraPromotionWorkflow",
    ]);
    expect(scheduledNames(parent)).toEqual([]);
    expect(scheduledNames(loadHistory("jira-sync.complete.projection.history.json"))).toEqual(["findJiraSyncWrite"]);
    expect(scheduledNames(loadHistory("jira-sync.complete.event.history.json"))).toEqual([
      "findJiraSyncWrite",
      "emitJiraEvent",
    ]);

    const promotion = loadHistory("jira-sync.complete.promotion.history.json");
    expect(scheduledNames(promotion)).toEqual([
      "readJiraPromotionEligibility",
      "findJiraSyncWrite",
      "readJiraIssueBaseline",
      "createJiraPromotionDraft",
    ]);
    for (const [history, activity] of [
      [loadHistory("jira-sync.complete.event.history.json"), "emitJiraEvent"],
      [promotion, "createJiraPromotionDraft"],
    ] as const) {
      expect(
        scheduledActivityAttrs(history).find((attributes) => attributes?.activityType?.name === activity)?.retryPolicy
          ?.maximumAttempts,
      ).toBe(1);
    }
  });

  it("TMP-001 unknown write は write 1 回と reconcile read で回収する", () => {
    const child = loadHistory("jira-sync.unknown-write-reconciled.projection.history.json");
    expect(decodeChildOutcome(child).payload).toEqual({ operation: "projection", outcome: "reconciled" });
    const names = scheduledNames(child);
    expect(names.filter((name) => name === "projectDevelopmentToJira")).toHaveLength(1);
    expect(names.filter((name) => name === "findJiraSyncWrite")).toHaveLength(2);
  });

  it("ADR-0030 promotion CAS stale と not-eligible は Draft PR を確定しない", () => {
    const stale = loadHistory("jira-sync.promotion-stale.promotion.history.json");
    expect(decodeChildOutcome(stale).payload).toEqual({ operation: "promotion", outcome: "stale" });
    expect(scheduledNames(stale).filter((name) => name === "createJiraPromotionDraft")).toHaveLength(1);

    const notEligible = loadHistory("jira-sync.promotion-not-eligible.promotion.history.json");
    expect(decodeChildOutcome(notEligible).payload).toEqual({ operation: "promotion", outcome: "not-eligible" });
    expect(scheduledNames(notEligible)).toEqual(["readJiraPromotionEligibility"]);
  });

  it("TMP-001 shadow は authoritative read のみで write を schedule しない", () => {
    const parent = loadHistory("jira-sync.shadow.history.json");
    expect(decodeResult(parent).payload.phase).toBe("shadowed");
    for (const operation of ["projection", "event"] as const) {
      expect(scheduledNames(loadHistory(`jira-sync.shadow.${operation}.history.json`))).toEqual(["findJiraSyncWrite"]);
    }
    expect(scheduledNames(loadHistory("jira-sync.shadow.promotion.history.json"))).toEqual([
      "readJiraPromotionEligibility",
      "findJiraSyncWrite",
    ]);
  });

  it("ADR-0030 transition は authorized write と CAS stale の双方を one-shot で記録する", () => {
    const authorized = loadHistory("jira-sync.transition-authorized.transition.history.json");
    expect(decodeChildOutcome(authorized).payload).toEqual({ operation: "transition", outcome: "executed" });
    expect(scheduledNames(authorized)).toEqual([
      "readJiraTransitionAuthorization",
      "findJiraSyncWrite",
      "readJiraIssueBaseline",
      "transitionJiraStatus",
    ]);
    expect(
      scheduledActivityAttrs(authorized).find((attributes) => attributes?.activityType?.name === "transitionJiraStatus")
        ?.retryPolicy?.maximumAttempts,
    ).toBe(1);

    const stale = loadHistory("jira-sync.transition-stale.transition.history.json");
    expect(decodeChildOutcome(stale).payload).toEqual({ operation: "transition", outcome: "stale" });
    expect(scheduledNames(stale).filter((name) => name === "transitionJiraStatus")).toHaveLength(1);
  });

  for (const fixture of replayFixtures) {
    it(`TMP-001 replay: ${fixture}`, async () => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    }, 60_000);
  }
});
