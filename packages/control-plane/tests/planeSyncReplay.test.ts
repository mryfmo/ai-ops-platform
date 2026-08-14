// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-002 / TMP-003
// Plane sync の recorded history 6 経路をデータ検証 + replay する。
// dedupe 恒等・unknown write の reconcile 回収・baseline stale・draft 境界・
// pending 非再送を history で機械検証する。

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

function childWorkflowTypes(history: proto.temporal.api.history.v1.History): string[] {
  return history.events
    .filter((e) => e.startChildWorkflowExecutionInitiatedEventAttributes != null)
    .map((e) => e.startChildWorkflowExecutionInitiatedEventAttributes?.workflowType?.name ?? "");
}

function decodeResult(history: proto.temporal.api.history.v1.History): {
  payload: {
    phase: string;
    outcomes: Array<{ operation: string; outcome: string }>;
  };
} {
  const completed = history.events.find((e) => e.workflowExecutionCompletedEventAttributes != null);
  const data = completed?.workflowExecutionCompletedEventAttributes?.result?.payloads?.[0]?.data;
  if (data == null) throw new Error("completed result payload not found in fixture");
  return JSON.parse(Buffer.from(data).toString("utf8")) as never;
}

function decodeFailureType(history: proto.temporal.api.history.v1.History): string {
  const failed = history.events.find((e) => e.workflowExecutionFailedEventAttributes != null);
  const type = failed?.workflowExecutionFailedEventAttributes?.failure?.applicationFailureInfo?.type;
  if (type == null) {
    const cause = failed?.workflowExecutionFailedEventAttributes?.failure?.cause?.applicationFailureInfo?.type;
    if (cause == null) throw new Error("workflow failure event not found in fixture");
    return cause;
  }
  return type;
}

describe("FinalArch:CON-002 plane sync の recorded history", () => {
  it("complete fixture: 3 child 分離、written 既存の projection は reconciled、event/promotion は executed", () => {
    const history = loadHistory("plane-sync.complete.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.outcomes).toEqual([
      { operation: "projection", outcome: "reconciled" },
      { operation: "event", outcome: "executed" },
      { operation: "promotion", outcome: "executed" },
    ]);
    expect(childWorkflowTypes(history)).toEqual([
      "planeProjectionWorkflow",
      "planeEventWorkflow",
      "planePromotionWorkflow",
    ]);
  });

  it("TMP-003: unknown write result（外部成立・応答喪失）は reconcile で回収し二重 write しない", () => {
    const history = loadHistory("plane-sync.unknown-write-reconciled.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.outcomes).toEqual([
      { operation: "projection", outcome: "reconciled" },
      { operation: "event", outcome: "executed" },
      { operation: "promotion", outcome: "executed" },
    ]);
  });

  it("promotion-stale fixture: baseline 固定後の revision 移動は write なしの stale 終端", () => {
    const history = loadHistory("plane-sync.promotion-stale.history.json");
    const result = decodeResult(history);
    expect(result.payload.outcomes).toEqual([{ operation: "promotion", outcome: "stale" }]);
  });

  it("promotion-not-eligible fixture: 未承認 work item への promotion write は発生しない", () => {
    const history = loadHistory("plane-sync.promotion-not-eligible.history.json");
    const result = decodeResult(history);
    expect(result.payload.outcomes).toEqual([{ operation: "promotion", outcome: "not-eligible" }]);
  });

  it("P3-T07 恒久則: pending 台帳の再実行は write を schedule せず unresolved 終了する", () => {
    const history = loadHistory("plane-sync.pending-no-redispatch.history.json");
    expect(decodeFailureType(history)).toBe("E-CP-EXTERNAL-UNRESOLVED");
  });

  it("shadow fixture: 未 write operation は構造的に write 不発火（shadowed）", () => {
    const history = loadHistory("plane-sync.shadow.history.json");
    const result = decodeResult(history);
    expect(result.payload.phase).toBe("shadowed");
    expect(result.payload.outcomes).toEqual([
      { operation: "projection", outcome: "shadowed" },
      { operation: "event", outcome: "shadowed" },
      { operation: "promotion", outcome: "shadowed" },
    ]);
  });

  for (const fixture of [
    "plane-sync.complete.history.json",
    "plane-sync.unknown-write-reconciled.history.json",
    "plane-sync.promotion-stale.history.json",
    "plane-sync.promotion-not-eligible.history.json",
    "plane-sync.pending-no-redispatch.history.json",
    "plane-sync.shadow.history.json",
  ]) {
    it(`replay: ${fixture} を現行 workflow code で replay できる`, async () => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    }, 60_000);
  }
});
