// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0006
// TMP-003（duplicate dispatch prevented）/ TMP-004（crash resume）の durable 側検証。
// CodingTaskWorkflow の recorded history 6 経路をデータ検証 + replay する。

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

function scheduledActivityNames(history: proto.temporal.api.history.v1.History): string[] {
  return history.events
    .filter((e) => e.activityTaskScheduledEventAttributes != null)
    .map((e) => e.activityTaskScheduledEventAttributes?.activityType?.name ?? "");
}

function decodeResult(history: proto.temporal.api.history.v1.History): {
  payload: {
    phase: string;
    failureReason: string | null;
    dispatchOutcome: string | null;
    callback: { outcome: string; runId: string; prNumber: number | null } | null;
    reviewedBy: string | null;
    rejectedCallbacks: Record<string, number>;
    rejectedReviews: Record<string, number>;
  };
} {
  const completed = history.events.find((e) => e.workflowExecutionCompletedEventAttributes != null);
  const data = completed?.workflowExecutionCompletedEventAttributes?.result?.payloads?.[0]?.data;
  if (data == null) throw new Error("completed result payload not found in fixture");
  return JSON.parse(Buffer.from(data).toString("utf8")) as never;
}

describe("ADR-0006 CodingTaskWorkflow の recorded history", () => {
  it("complete fixture: adversarial callback/review を拒否記録しつつ DB 正本確認で complete する", () => {
    const history = loadHistory("coding-task.complete.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.failureReason).toBeNull();
    expect(result.payload.dispatchOutcome).toBe("executed");
    expect(result.payload.callback).toEqual({ outcome: "pr_created", runId: "run-1", prNumber: 41 });
    expect(result.payload.reviewedBy).toBe("reviewer-1");
    // 早期（dispatch 前）1 + 偽 dispatchId 1 = dispatch-mismatch 2 / malformed 1 /
    // exact replay duplicate 1 / 別 run + 別 PR = conflicting 2。
    expect(result.payload.rejectedCallbacks).toEqual({
      "malformed-payload": 1,
      "task-id-mismatch": 0,
      "dispatch-mismatch": 2,
      "wrong-phase": 0,
      "duplicate-callback": 1,
      "conflicting-callback": 2,
    });
    // P3-T04-001: 1 回目の wake は DB 正本が pending のため unconfirmed —
    // 名前だけの signal では完了せず、read が complete を返して初めて完了する。
    expect(result.payload.rejectedReviews["unconfirmed-review"]).toBe(1);
    expect(history.events.some((e) => e.startChildWorkflowExecutionInitiatedEventAttributes != null)).toBe(true);
    const names = scheduledActivityNames(history);
    expect(names.filter((n) => n === "dispatchCodingTask")).toHaveLength(1);
    expect(names.filter((n) => n === "readReviewDecision")).toHaveLength(2);
  });

  it("TMP-003: 応答喪失でも dispatch の schedule は 1 回だけで reconcile が回収する", () => {
    const history = loadHistory("coding-task.dispatch-reconciled.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.dispatchOutcome).toBe("reconciled");
    const names = scheduledActivityNames(history);
    expect(names.filter((n) => n === "dispatchCodingTask")).toHaveLength(1);
    expect(names.filter((n) => n === "findCodingTaskDispatch")).toHaveLength(1);
  });

  it("approval-rejected fixture: 承認なしでは dispatch が一切 schedule されない", () => {
    const history = loadHistory("coding-task.approval-rejected.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("failed");
    expect(result.payload.failureReason).toBe("approval-rejected");
    expect(result.payload.dispatchOutcome).toBeNull();
    expect(scheduledActivityNames(history)).not.toContain("dispatchCodingTask");
  });

  it("callback-timeout fixture: callback 不達は complete へ自動遷移せず failed 終端", () => {
    const history = loadHistory("coding-task.callback-timeout.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("failed");
    expect(result.payload.failureReason).toBe("callback-timeout");
    const names = history.events.map((e) => proto.temporal.api.enums.v1.EventType[e.eventType ?? 0]);
    expect(names).toContain("EVENT_TYPE_TIMER_FIRED");
  });

  it("P3-T04-003: no_change はレビュー対象 PR がない正当な no-op として直接 complete する", () => {
    const history = loadHistory("coding-task.no-change.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.failureReason).toBeNull();
    expect(result.payload.callback?.outcome).toBe("no_change");
    expect(result.payload.reviewedBy).toBeNull();
    expect(scheduledActivityNames(history)).not.toContain("readReviewDecision");
  });

  it("TMP-004: per-task history 再構築（crash-resume proxy）でも全遷移が保持され complete する", () => {
    const history = loadHistory("coding-task.crash-resume.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(history.events.filter((e) => e.workflowTaskStartedEventAttributes != null).length).toBeGreaterThan(3);
  });

  for (const fixture of [
    "coding-task.complete.history.json",
    "coding-task.dispatch-reconciled.history.json",
    "coding-task.approval-rejected.history.json",
    "coding-task.callback-timeout.history.json",
    "coding-task.no-change.history.json",
    "coding-task.crash-resume.history.json",
  ]) {
    it(`replay: ${fixture} を現行 workflow code で replay できる`, async () => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    }, 60_000);
  }
});
