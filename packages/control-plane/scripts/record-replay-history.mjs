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
const workflowsPath = path.join(packageRoot, "src", "workflows", "replayProbe.ts");

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
} finally {
  await env.teardown();
}
