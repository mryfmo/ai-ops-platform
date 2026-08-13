// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// TMP-001「Workflow replay succeeds」。recorded history（executed / lost-response
// reconciled の 2 経路、scripts/record-replay-history.mjs で生成）を現行 workflow
// code で replay し、決定性（helper 変更が history 互換であること）を機械検証する。
// ネットワーク・server 不要（Worker.runReplayHistory はローカル replay）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import proto from "@temporalio/proto";
import { Worker } from "@temporalio/worker";
import { DeterminismViolationError } from "@temporalio/workflow";
import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "replayProbe.ts");

function loadHistory(fixture: string): proto.temporal.api.history.v1.History {
  const raw = fs.readFileSync(path.join(packageRoot, "tests", "fixtures", fixture), "utf8");
  return proto.temporal.api.history.v1.History.fromObject(JSON.parse(raw) as Record<string, unknown>);
}

describe("TMP-001 recorded history の replay が成功する", () => {
  it("executed 経路の history を現行 workflow code で replay できる", async () => {
    await expect(
      Worker.runReplayHistory({ workflowsPath }, loadHistory("replay-probe.executed.history.json")),
    ).resolves.toBeUndefined();
  }, 60_000);

  it("lost-response reconciled 経路の history を現行 workflow code で replay できる", async () => {
    await expect(
      Worker.runReplayHistory({ workflowsPath }, loadHistory("replay-probe.reconciled.history.json")),
    ).resolves.toBeUndefined();
  }, 60_000);

  it("負 fixture: history と食い違う workflow code は nondeterminism として検出される", async () => {
    const mutated = path.join(packageRoot, "tests", "fixtures", "replayProbeMutated.ts");
    // 任意の失敗（bundle/fixture 破損等）では green にならないよう、型で検証する。
    await expect(
      Worker.runReplayHistory({ workflowsPath: mutated }, loadHistory("replay-probe.executed.history.json")),
    ).rejects.toThrow(DeterminismViolationError);
  }, 60_000);
});

describe("FinalArch:FR-CP-001 cancellation acceptance（未開始の副作用を停止）", () => {
  const fixture = "replay-probe.cancelled.history.json";

  it("cancel 要求後の history に createExternalObject の schedule が存在しない", () => {
    const history = loadHistory(fixture);
    const eventTypes = history.events.map((e) => proto.temporal.api.enums.v1.EventType[e.eventType ?? 0]);
    expect(eventTypes).toContain("EVENT_TYPE_WORKFLOW_EXECUTION_CANCEL_REQUESTED");
    expect(eventTypes).toContain("EVENT_TYPE_WORKFLOW_EXECUTION_CANCELED");
    const scheduled = history.events
      .filter((e) => e.activityTaskScheduledEventAttributes != null)
      .map((e) => e.activityTaskScheduledEventAttributes?.activityType?.name);
    // 副作用（createExternalObject）は dispatch されず、non-cancellable cleanup の
    // 冪等 read（findExternalObject）だけが cancel 後に実行されている。
    expect(scheduled).toEqual(["findExternalObject"]);
  });

  it("cancelled 経路の history を現行 workflow code で replay できる", async () => {
    await expect(Worker.runReplayHistory({ workflowsPath }, loadHistory(fixture))).resolves.toBeUndefined();
  }, 60_000);
});
