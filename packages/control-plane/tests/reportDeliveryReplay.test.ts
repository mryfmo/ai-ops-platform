// 根拠: FinalArch:FR-CP-001 / PrjOps:SPEC-INT-052 / PrjOps:SPEC-EXT-023 / TMP-003
// report delivery の recorded history 5 経路をデータ検証 + replay する。
// recipient idempotency（既配信は deliverReport 不発火）と lost-response の
// schedule 1 回 + reconcile 回収（TMP-003）を history で機械検証する。

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

function scheduledActivities(history: proto.temporal.api.history.v1.History): string[] {
  return history.events
    .filter((e) => e.activityTaskScheduledEventAttributes != null)
    .map((e) => e.activityTaskScheduledEventAttributes?.activityType?.name ?? "");
}

function decodeResult(history: proto.temporal.api.history.v1.History): {
  payload: {
    phase: string;
    failureReason: string | null;
    approvalStatus: string | null;
    validationReason: string | null;
    deliveries: Array<{ recipientId: string; outcome: string }>;
  };
} {
  const completed = history.events.find((e) => e.workflowExecutionCompletedEventAttributes != null);
  const data = completed?.workflowExecutionCompletedEventAttributes?.result?.payloads?.[0]?.data;
  if (data == null) throw new Error("completed result payload not found in fixture");
  return JSON.parse(Buffer.from(data).toString("utf8")) as never;
}

describe("PrjOps:SPEC-INT-052 report delivery の recorded history", () => {
  it("complete fixture: 既配信 recipient は reconciled（deliverReport 不発火）、未配信のみ executed", () => {
    const history = loadHistory("report-delivery.complete.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.approvalStatus).toBe("approved");
    expect(result.payload.deliveries).toEqual([
      { recipientId: "user-1", outcome: "reconciled" },
      { recipientId: "user-2", outcome: "executed" },
    ]);
    // 生成 1・検証 1・authority read 2（recipient 毎）・配信は user-2 の 1 回のみ。
    const names = scheduledActivities(history);
    expect(names.filter((n) => n === "generateReport")).toHaveLength(1);
    expect(names.filter((n) => n === "validateReport")).toHaveLength(1);
    expect(names.filter((n) => n === "findReportDelivery")).toHaveLength(2);
    expect(names.filter((n) => n === "deliverReport")).toHaveLength(1);
    expect(history.events.some((e) => e.startChildWorkflowExecutionInitiatedEventAttributes != null)).toBe(true);
  });

  it("TMP-003: 配信応答喪失でも deliverReport の schedule は recipient あたり 1 回で reconcile が回収する", () => {
    const history = loadHistory("report-delivery.delivery-lost-response.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.deliveries).toEqual([
      { recipientId: "user-1", outcome: "reconciled" },
      { recipientId: "user-2", outcome: "executed" },
    ]);
    const names = scheduledActivities(history);
    // user-1: preflight read + lost 配信 1 回 + reconcile read / user-2: read + 配信。
    expect(names.filter((n) => n === "deliverReport")).toHaveLength(2);
    expect(names.filter((n) => n === "findReportDelivery")).toHaveLength(3);
  });

  it("approval-rejected fixture: 承認なしでは deliverReport が一切 schedule されない", () => {
    const history = loadHistory("report-delivery.approval-rejected.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("failed");
    expect(result.payload.failureReason).toBe("approval-rejected");
    expect(scheduledActivities(history)).not.toContain("deliverReport");
  });

  it("validation-failed fixture: approval child すら起動せず配信もない", () => {
    const history = loadHistory("report-delivery.validation-failed.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("failed");
    expect(result.payload.failureReason).toBe("validation-failed");
    expect(result.payload.validationReason).toBe("numbers missing");
    expect(history.events.some((e) => e.startChildWorkflowExecutionInitiatedEventAttributes != null)).toBe(false);
    expect(scheduledActivities(history)).not.toContain("deliverReport");
  });

  it("shadow fixture: 未配信 recipient への delivery write が構造的に発生しない", () => {
    const history = loadHistory("report-delivery.shadow.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("shadowed");
    expect(result.payload.deliveries).toEqual([
      { recipientId: "user-1", outcome: "shadowed" },
      { recipientId: "user-2", outcome: "shadowed" },
    ]);
    const names = scheduledActivities(history);
    expect(names).not.toContain("deliverReport");
    expect(names.filter((n) => n === "findReportDelivery")).toHaveLength(2);
  });

  for (const fixture of [
    "report-delivery.complete.history.json",
    "report-delivery.delivery-lost-response.history.json",
    "report-delivery.approval-rejected.history.json",
    "report-delivery.validation-failed.history.json",
    "report-delivery.shadow.history.json",
  ]) {
    it(`replay: ${fixture} を現行 workflow code で replay できる`, async () => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    }, 60_000);
  }
});
