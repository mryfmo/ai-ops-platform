// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / DevOps:SPEC-EXT-010
// TMP-002 の durable 側検証。approval workflow の recorded history 3 経路
// （approved+stale 拒否 / expired / worker-restart 横断）を現行 code で replay し、
// history のデータ性質（signal 数・timer・完了種別）を機械検証する。

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

function eventNames(history: proto.temporal.api.history.v1.History): string[] {
  return history.events.map((e) => proto.temporal.api.enums.v1.EventType[e.eventType ?? 0]);
}

function decodeResultPayload(history: proto.temporal.api.history.v1.History): {
  payload: { status: string; rejectedSignals: Record<string, number> };
} {
  const completed = history.events.find((e) => e.workflowExecutionCompletedEventAttributes != null);
  const data = completed?.workflowExecutionCompletedEventAttributes?.result?.payloads?.[0]?.data;
  if (data == null) throw new Error("completed result payload not found in fixture");
  return JSON.parse(Buffer.from(data).toString("utf8")) as never;
}

describe("TMP-002 approval workflow の recorded history", () => {
  it("approved fixture: 全 adversarial matrix を拒否記録し、valid signal だけが approved を確定する", () => {
    const history = loadHistory("approval.approved.history.json");
    const signals = history.events.filter((e) => e.workflowExecutionSignaledEventAttributes != null);
    expect(signals).toHaveLength(8);
    const result = decodeResultPayload(history);
    expect(result.payload.status).toBe("approved");
    // stale 双方向 2 / id 不一致 1 / 不正 decision 1 / 無記名 1 / malformed(null) 1 /
    // 受理後 duplicate（rejected への上書き試行）1 — すべて拒否され、決定は覆らない。
    expect(result.payload.rejectedSignals).toEqual({
      "malformed-payload": 1,
      "already-decided": 1,
      "approval-id-mismatch": 1,
      "stale-version": 2,
      "invalid-decision": 1,
      "missing-approver": 1,
    });
  });

  it("expired fixture: malformed/stale signal を受けても wedge せず期限超過で expired 終了する（P3-T03-001 回帰 + no auto-approval）", () => {
    const history = loadHistory("approval.expired.history.json");
    const names = eventNames(history);
    expect(names).toContain("EVENT_TYPE_TIMER_STARTED");
    expect(names).toContain("EVENT_TYPE_TIMER_FIRED");
    expect(history.events.filter((e) => e.workflowExecutionSignaledEventAttributes != null)).toHaveLength(2);
    const result = decodeResultPayload(history);
    expect(result.payload.status).toBe("expired");
    expect(result.payload.rejectedSignals["malformed-payload"]).toBe(1);
    expect(result.payload.rejectedSignals["stale-version"]).toBe(1);
  });

  it("restart fixture: sticky cache 無効（task 毎に history から再構築）でも signal が処理され approved で完了する（restart-safe）", () => {
    const history = loadHistory("approval.restart.history.json");
    // 待機 → query → signal と複数 workflow task を跨いでおり、cache 無効記録のため
    // 各 task は durable history からの再構築（= worker 再起動と同一経路）を経ている。
    expect(history.events.filter((e) => e.workflowTaskStartedEventAttributes != null).length).toBeGreaterThan(1);
    expect(decodeResultPayload(history).payload.status).toBe("approved");
  });

  for (const fixture of [
    "approval.approved.history.json",
    "approval.expired.history.json",
    "approval.restart.history.json",
  ]) {
    it(`replay: ${fixture} を現行 workflow code で replay できる`, async () => {
      await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
    }, 60_000);
  }
});
