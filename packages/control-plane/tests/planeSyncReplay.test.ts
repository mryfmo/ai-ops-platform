// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-002 / TMP-003
// Plane sync の recorded history（親 + child）をデータ検証 + replay する。
// P3-T08-006: 実行証跡（activity schedule・retry policy・write 数）は child 側の
// history で assert し、親 history は orchestration（child 分離・伝播）を担う。

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
    .filter((e) => e.activityTaskScheduledEventAttributes != null)
    .map((e) => e.activityTaskScheduledEventAttributes);
}

function scheduledNames(history: proto.temporal.api.history.v1.History): string[] {
  return scheduledActivityAttrs(history).map((a) => a?.activityType?.name ?? "");
}

function childWorkflowTypes(history: proto.temporal.api.history.v1.History): string[] {
  return history.events
    .filter((e) => e.startChildWorkflowExecutionInitiatedEventAttributes != null)
    .map((e) => e.startChildWorkflowExecutionInitiatedEventAttributes?.workflowType?.name ?? "");
}

function decodeResult(history: proto.temporal.api.history.v1.History): {
  payload: { phase: string; outcomes: Array<{ operation: string; outcome: string }> };
} {
  const completed = history.events.find((e) => e.workflowExecutionCompletedEventAttributes != null);
  const data = completed?.workflowExecutionCompletedEventAttributes?.result?.payloads?.[0]?.data;
  if (data == null) throw new Error("completed result payload not found in fixture");
  return JSON.parse(Buffer.from(data).toString("utf8")) as never;
}

function decodeChildOutcome(history: proto.temporal.api.history.v1.History): {
  payload: { operation: string; outcome: string };
} {
  return decodeResult(history) as never;
}

function decodeFailureType(history: proto.temporal.api.history.v1.History): string {
  const failed = history.events.find((e) => e.workflowExecutionFailedEventAttributes != null);
  let failure = failed?.workflowExecutionFailedEventAttributes?.failure ?? null;
  while (failure != null) {
    const type = failure.applicationFailureInfo?.type;
    if (type != null && type.length > 0) return type;
    failure = failure.cause ?? null;
  }
  throw new Error("workflow failure event not found in fixture");
}

describe("FinalArch:CON-002 plane sync の recorded history（親 + child）", () => {
  it("complete: 親は 3 child を分離起動し、written 既存の projection は reconciled", () => {
    const parent = loadHistory("plane-sync.complete.history.json");
    const result = decodeResult(parent);
    expect(result.payload.phase).toBe("complete");
    expect(result.payload.outcomes).toEqual([
      { operation: "projection", outcome: "reconciled" },
      { operation: "event", outcome: "executed" },
      { operation: "promotion", outcome: "executed" },
    ]);
    expect(childWorkflowTypes(parent)).toEqual([
      "planeProjectionWorkflow",
      "planeEventWorkflow",
      "planePromotionWorkflow",
    ]);
    // 親には activity がなく、実行証跡は child 側にある（P3-T08-006）。
    expect(scheduledNames(parent)).toEqual([]);

    // projection child: preflight read のみ（written 既存 → write 不発火）。
    const projection = loadHistory("plane-sync.complete.projection.history.json");
    expect(scheduledNames(projection)).toEqual(["findPlaneSyncWrite"]);
    // event child: preflight read + write 1 回（maximumAttempts=1）。
    const event = loadHistory("plane-sync.complete.event.history.json");
    expect(scheduledNames(event)).toEqual(["findPlaneSyncWrite", "emitPlaneEvent"]);
    const eventWrite = scheduledActivityAttrs(event).find((a) => a?.activityType?.name === "emitPlaneEvent");
    expect(eventWrite?.retryPolicy?.maximumAttempts).toBe(1);
    // promotion child: eligibility → preflight → revision → CAS write（1 回）。
    const promotion = loadHistory("plane-sync.complete.promotion.history.json");
    expect(scheduledNames(promotion)).toEqual([
      "readPromotionEligibility",
      "findPlaneSyncWrite",
      "readWorkItemRevision",
      "createPromotionDraft",
    ]);
    const promoWrite = scheduledActivityAttrs(promotion).find((a) => a?.activityType?.name === "createPromotionDraft");
    expect(promoWrite?.retryPolicy?.maximumAttempts).toBe(1);
  });

  it("TMP-003: unknown write（外部成立・応答喪失）は child で write 1 回 + reconcile 回収", () => {
    const projection = loadHistory("plane-sync.unknown-write-reconciled.projection.history.json");
    expect(decodeChildOutcome(projection).payload).toEqual({ operation: "projection", outcome: "reconciled" });
    const names = scheduledNames(projection);
    expect(names.filter((n) => n === "projectToPlane")).toHaveLength(1);
    // preflight read + reconcile read。
    expect(names.filter((n) => n === "findPlaneSyncWrite")).toHaveLength(2);
  });

  it("promotion-stale（早期 read 検出）: write なしの stale 終端", () => {
    const promotion = loadHistory("plane-sync.promotion-stale.promotion.history.json");
    expect(decodeChildOutcome(promotion).payload).toEqual({ operation: "promotion", outcome: "stale" });
    expect(scheduledNames(promotion)).not.toContain("createPromotionDraft");
  });

  it("P3-T08-004: read と write の間に revision が移動しても write authority の CAS が stale を返す", () => {
    const promotion = loadHistory("plane-sync.promotion-cas-stale.promotion.history.json");
    expect(decodeChildOutcome(promotion).payload).toEqual({ operation: "promotion", outcome: "stale" });
    // CAS は activity 内で判定される（activity は schedule されるが台帳 write なし =
    // 後続 run の preflight が absent のままであることは mock 意味論で保証）。
    expect(scheduledNames(promotion).filter((n) => n === "createPromotionDraft")).toHaveLength(1);
  });

  it("P3-T08-003: promotion の committed-lost reconcile は draft receipt 形（baseline echo）のみで回収", () => {
    const promotion = loadHistory("plane-sync.promotion-reconciled.promotion.history.json");
    expect(decodeChildOutcome(promotion).payload).toEqual({ operation: "promotion", outcome: "reconciled" });
    const names = scheduledNames(promotion);
    expect(names.filter((n) => n === "createPromotionDraft")).toHaveLength(1);
    expect(names.filter((n) => n === "findPlaneSyncWrite")).toHaveLength(2);
  });

  it("promotion-not-eligible: 未承認 work item への write は発生しない", () => {
    const promotion = loadHistory("plane-sync.promotion-not-eligible.promotion.history.json");
    expect(decodeChildOutcome(promotion).payload).toEqual({ operation: "promotion", outcome: "not-eligible" });
    expect(scheduledNames(promotion)).toEqual(["readPromotionEligibility"]);
  });

  it("pending 台帳の再実行は child が write を schedule せず unresolved、親も unresolved で失敗", () => {
    const parent = loadHistory("plane-sync.pending-no-redispatch.history.json");
    expect(decodeFailureType(parent)).toBe("E-CP-EXTERNAL-UNRESOLVED");
    const projection = loadHistory("plane-sync.pending-no-redispatch.projection.history.json");
    expect(decodeFailureType(projection)).toBe("E-CP-EXTERNAL-UNRESOLVED");
    expect(scheduledNames(projection)).toEqual(["findPlaneSyncWrite"]);
  });

  it("shadow: child でも write が構造的に不発火（preflight read のみ）", () => {
    const parent = loadHistory("plane-sync.shadow.history.json");
    expect(decodeResult(parent).payload.phase).toBe("shadowed");
    for (const operation of ["projection", "event"] as const) {
      const child = loadHistory(`plane-sync.shadow.${operation}.history.json`);
      expect(scheduledNames(child)).toEqual(["findPlaneSyncWrite"]);
    }
    const promotion = loadHistory("plane-sync.shadow.promotion.history.json");
    expect(scheduledNames(promotion)).toEqual(["readPromotionEligibility", "findPlaneSyncWrite"]);
  });

  it("P3-T08-002: 直接起動された child は不正恒等を E-CP-CONTRACT で遮断し activity 0 件", () => {
    const child = loadHistory("plane-sync.child-invalid-identity.history.json");
    expect(decodeFailureType(child)).toBe("E-CP-CONTRACT");
    expect(scheduledNames(child)).toEqual([]);
  });

  for (const fixture of [
    "plane-sync.complete.history.json",
    "plane-sync.complete.projection.history.json",
    "plane-sync.complete.event.history.json",
    "plane-sync.complete.promotion.history.json",
    "plane-sync.unknown-write-reconciled.history.json",
    "plane-sync.unknown-write-reconciled.projection.history.json",
    "plane-sync.promotion-stale.promotion.history.json",
    "plane-sync.promotion-cas-stale.promotion.history.json",
    "plane-sync.promotion-reconciled.promotion.history.json",
    "plane-sync.promotion-not-eligible.promotion.history.json",
    "plane-sync.pending-no-redispatch.history.json",
    "plane-sync.pending-no-redispatch.projection.history.json",
    "plane-sync.shadow.history.json",
    "plane-sync.shadow.promotion.history.json",
    "plane-sync.child-invalid-identity.history.json",
  ]) {
    it(`replay: ${fixture} を現行 workflow code で replay できる`, async () => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    }, 60_000);
  }
});
