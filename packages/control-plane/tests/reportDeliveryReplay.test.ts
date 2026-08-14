// 根拠: FinalArch:FR-CP-001 / PrjOps:SPEC-INT-050 / PrjOps:SPEC-INT-052 / PrjOps:SPEC-EXT-023 / TMP-003
// report delivery の recorded history 8 経路をデータ検証 + replay する。
// P3-T07-001: PRF-01..03 の承認不要経路と PRF-04/05 の bypass 不能を実証。
// P3-T07-002: pending 台帳は成功回収も自動再送もされないことを実証。

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

function startedChild(history: proto.temporal.api.history.v1.History): boolean {
  return history.events.some((e) => e.startChildWorkflowExecutionInitiatedEventAttributes != null);
}

function decodeResult(history: proto.temporal.api.history.v1.History): {
  payload: {
    phase: string;
    failureReason: string | null;
    profile: string | null;
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

function decodeFailure(history: proto.temporal.api.history.v1.History): string {
  const failed = history.events.find((e) => e.workflowExecutionFailedEventAttributes != null);
  const type = failed?.workflowExecutionFailedEventAttributes?.failure?.applicationFailureInfo?.type;
  if (type == null) throw new Error("workflow failure event not found in fixture");
  return type;
}

describe("PrjOps:SPEC-INT-050/052 report delivery の recorded history", () => {
  it("complete fixture（PRF-04）: sent 既配信は reconciled（deliverReport 不発火）、未配信のみ executed", () => {
    const history = loadHistory("report-delivery.complete.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.profile).toBe("PRF-04");
    expect(result.payload.approvalStatus).toBe("approved");
    expect(result.payload.deliveries).toEqual([
      { recipientId: "user-1", outcome: "reconciled" },
      { recipientId: "user-2", outcome: "executed" },
    ]);
    const names = scheduledActivities(history);
    expect(names.filter((n) => n === "resolveReportProfile")).toHaveLength(1);
    expect(names.filter((n) => n === "deliverReport")).toHaveLength(1);
    expect(startedChild(history)).toBe(true);
  });

  it("P3-T07-001: approval-free fixture（PRF-02）は approval child なしで配信まで直行する", () => {
    const history = loadHistory("report-delivery.approval-free.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.profile).toBe("PRF-02");
    expect(result.payload.approvalStatus).toBe("not-required");
    expect(result.payload.deliveries).toEqual([
      { recipientId: "user-1", outcome: "executed" },
      { recipientId: "user-2", outcome: "executed" },
    ]);
    expect(startedChild(history)).toBe(false);
  });

  it("P3-T07-001（負）: PRF-05 は approval パラメータなしでは E-CP-CONTRACT で失敗し bypass 不能", () => {
    const history = loadHistory("report-delivery.prf05-no-approval.history.json");
    expect(decodeFailure(history)).toBe("E-CP-CONTRACT");
    expect(startedChild(history)).toBe(false);
    const names = scheduledActivities(history);
    expect(names).not.toContain("deliverReport");
    expect(names).not.toContain("generateReport");
  });

  it("P3-T07-002: 応答喪失は pending のまま E-CP-EXTERNAL-UNRESOLVED（deliverReport schedule 1 回・成功偽装なし）", () => {
    const history = loadHistory("report-delivery.delivery-unresolved.history.json");
    expect(decodeFailure(history)).toBe("E-CP-EXTERNAL-UNRESOLVED");
    const names = scheduledActivities(history);
    expect(names.filter((n) => n === "deliverReport")).toHaveLength(1);
    // preflight read + reconcile read の 2 回（user-1 のみ。後続 recipient へ進まない）。
    expect(names.filter((n) => n === "findReportDelivery")).toHaveLength(2);
  });

  it("P3-T07-002: pending 行の再実行は deliverReport を一切 schedule しない（自動再送禁止）", () => {
    const history = loadHistory("report-delivery.pending-no-resend.history.json");
    expect(decodeFailure(history)).toBe("E-CP-EXTERNAL-UNRESOLVED");
    const names = scheduledActivities(history);
    expect(names).not.toContain("deliverReport");
    expect(names.filter((n) => n === "findReportDelivery")).toHaveLength(1);
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
    expect(startedChild(history)).toBe(false);
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
    expect(scheduledActivities(history)).not.toContain("deliverReport");
  });

  for (const fixture of [
    "report-delivery.complete.history.json",
    "report-delivery.approval-free.history.json",
    "report-delivery.prf05-no-approval.history.json",
    "report-delivery.delivery-unresolved.history.json",
    "report-delivery.pending-no-resend.history.json",
    "report-delivery.approval-rejected.history.json",
    "report-delivery.validation-failed.history.json",
    "report-delivery.shadow.history.json",
  ]) {
    it(`replay: ${fixture} を現行 workflow code で replay できる`, async () => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    }, 60_000);
  }
});
