// 根拠: FinalArch:FR-CP-001 / ADR-0020
// TMP-001 evidence 用の recorded history を生成する開発時 script（CI では実行しない）。
// time-skipping test server で replayProbeWorkflow を 2 経路（executed / reconciled）
// 実行し、history JSON を tests/fixtures/ に保存する。再実行は fixture を上書きする。
//
//   pnpm --filter @aiops/control-plane run record:replay-history

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = path.join(packageRoot, "tests", "fixtures");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");

/** 外部 store の代役。lost-response 経路では書き込み成立後に応答を失う。 */
function makeActivities({ loseResponse }) {
  const store = new Map();
  return {
    async createExternalObject(input, idempotencyKey) {
      const value = `obj:${input.name}`;
      store.set(idempotencyKey, value);
      if (loseResponse) throw new Error("synthetic lost response after write");
      return value;
    },
    async findExternalObject(idempotencyKey) {
      return store.get(idempotencyKey) ?? null;
    },
  };
}

const env = await TestWorkflowEnvironment.createTimeSkipping();
try {
  fs.mkdirSync(fixturesDir, { recursive: true });
  for (const [fixtureName, loseResponse] of [
    ["replay-probe.executed.history.json", false],
    ["replay-probe.reconciled.history.json", true],
  ]) {
    const taskQueue = `replay-probe-${loseResponse ? "reconciled" : "executed"}`;
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: makeActivities({ loseResponse }),
    });
    const result = await worker.runUntil(
      env.client.workflow.execute("replayProbeWorkflow", {
        taskQueue,
        workflowId: `replay-probe/${taskQueue}`,
        args: ["fixture"],
      }),
    );
    const history = await env.client.workflow.getHandle(`replay-probe/${taskQueue}`).fetchHistory();
    const file = path.join(fixturesDir, fixtureName);
    fs.writeFileSync(file, `${JSON.stringify(history.toJSON(), null, 2)}\n`);
    console.log(`recorded ${fixtureName} (workflow result: ${result})`);
  }

  // cancellation acceptance: cancel 要求後は createExternalObject を一切 schedule しない。
  {
    const taskQueue = "replay-probe-cancelled";
    const workflowId = `replay-probe/${taskQueue}`;
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: makeActivities({ loseResponse: false }),
    });
    const outcome = await worker.runUntil(async () => {
      const handle = await env.client.workflow.start("cancellationProbeWorkflow", {
        taskQueue,
        workflowId,
        args: ["fixture"],
      });
      await handle.cancel();
      return handle.result().then(
        (r) => `unexpected-completion:${r}`,
        (e) => `cancelled:${e.name}`,
      );
    });
    const history = await env.client.workflow.getHandle(workflowId).fetchHistory();
    fs.writeFileSync(
      path.join(fixturesDir, "replay-probe.cancelled.history.json"),
      `${JSON.stringify(history.toJSON(), null, 2)}\n`,
    );
    console.log(`recorded replay-probe.cancelled.history.json (outcome: ${outcome})`);
  }
  // --- P3-T03 approval child workflow fixtures（TMP-002） ---
  const APPROVAL_ID = "0f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a9f";
  const approvalInput = (expiryMs) => ({
    schemaVersion: 1,
    payload: { approvalId: APPROVAL_ID, version: 3, expiryMs, requestedBy: "fixture" },
  });
  const validSignal = {
    approvalId: APPROVAL_ID,
    version: 3,
    decision: "approved",
    approverObjectId: "approver-1",
    reason: "fixture approval",
  };
  const saveHistory = async (workflowId, fixtureName) => {
    const history = await env.client.workflow.getHandle(workflowId).fetchHistory();
    fs.writeFileSync(path.join(fixturesDir, fixtureName), `${JSON.stringify(history.toJSON(), null, 2)}\n`);
  };

  // approved: 完全な adversarial matrix（stale 双方向・id 不一致・不正 decision・
  // 無記名・malformed null・受理後 duplicate）を拒否したうえで valid signal だけが
  // 決定する。signal は worker 起動前に積み、単一 workflow task で順番に処理させる
  // （順序を決定的にし、受理後 duplicate が完了前に必ず届くようにする）。
  {
    const taskQueue = "approval-approved";
    const workflowId = `approval/${taskQueue}`;
    const handle = await env.client.workflow.start("approvalWorkflow", {
      taskQueue,
      workflowId,
      args: [approvalInput(3_600_000)],
    });
    await handle.signal("approvalDecision", { ...validSignal, version: 2 }); // stale（過去）
    await handle.signal("approvalDecision", { ...validSignal, version: 4 }); // stale（未来）
    await handle.signal("approvalDecision", { ...validSignal, approvalId: "11111111-2222-4333-8444-555555555555" });
    await handle.signal("approvalDecision", { ...validSignal, decision: "auto-approve" });
    await handle.signal("approvalDecision", { ...validSignal, approverObjectId: "   " });
    await handle.signal("approvalDecision", null); // malformed
    await handle.signal("approvalDecision", validSignal);
    await handle.signal("approvalDecision", { ...validSignal, decision: "rejected" }); // 受理後 duplicate
    const worker = await Worker.create({ connection: env.nativeConnection, taskQueue, workflowsPath });
    const result = await worker.runUntil(handle.result());
    await saveHistory(workflowId, "approval.approved.history.json");
    console.log(
      `recorded approval.approved.history.json (${result.payload.status}, rejected: ${JSON.stringify(result.payload.rejectedSignals)})`,
    );
  }

  // expired: 不正 signal（malformed / stale）だけを受けた待機は、どれだけ拒否を
  // 積んでも approved にならず、期限超過で expired 終了する（P3-T03-001 の回帰証跡:
  // malformed signal が workflow を wedge させない）。
  {
    const taskQueue = "approval-expired";
    const workflowId = `approval/${taskQueue}`;
    const handle = await env.client.workflow.start("approvalWorkflow", {
      taskQueue,
      workflowId,
      args: [approvalInput(5_000)],
    });
    await handle.signal("approvalDecision", null); // malformed
    await handle.signal("approvalDecision", { ...validSignal, version: 2 }); // stale
    const worker = await Worker.create({ connection: env.nativeConnection, taskQueue, workflowsPath });
    const result = await worker.runUntil(handle.result());
    await saveHistory(workflowId, "approval.expired.history.json");
    console.log(
      `recorded approval.expired.history.json (${result.payload.status}, rejected: ${JSON.stringify(result.payload.rejectedSignals)})`,
    );
  }

  // restart-safe: maxCachedWorkflows=0 で sticky cache を無効化し、workflow task 毎に
  // durable history から状態を完全再構築させる（= 各 task の間に worker が再起動した
  // 場合と同一の resume 経路）。待機 → 状態確認 → signal の各 task がすべて
  // 再構築後に正しく処理され approved で完了することを記録する。
  // （2 worker の交代方式は time-skipping env で graceful shutdown が drain せず
  //   hang するため不採用。実 worker プロセスの再起動 E2E は deploy/temporal smoke 側。）
  {
    const taskQueue = "approval-restart";
    const workflowId = `approval/${taskQueue}`;
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      maxCachedWorkflows: 0,
    });
    const result = await worker.runUntil(async () => {
      const handle = await env.client.workflow.start("approvalWorkflow", {
        taskQueue,
        workflowId,
        args: [approvalInput(3_600_000)],
      });
      const state = await handle.query("approvalState");
      if (state.decided !== false) throw new Error("approval fixture: unexpected pre-decided state");
      await handle.signal("approvalDecision", validSignal);
      return handle.result();
    });
    await saveHistory(workflowId, "approval.restart.history.json");
    console.log(`recorded approval.restart.history.json (${result.payload.status} with per-task history rebuild)`);
  }
} finally {
  await env.teardown();
}
