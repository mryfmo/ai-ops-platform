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
      stickyQueueScheduleToStartTimeout: "1 second",
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
  // --- P3-T04 CodingTaskWorkflow fixtures（TMP-003/TMP-004） ---
  // fixture 毎に一意の taskId を使う（同一 ID を再利用すると getHandle が
  // 旧 run（worker のいない task queue）へ query を route し、RPC が無期限 block する）。
  const taskIdFor = (index) => `3f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a9${index}`;
  const codingInput = (taskId, overrides = {}) => ({
    schemaVersion: 1,
    payload: {
      taskId,
      approvalId: APPROVAL_ID,
      approvalVersion: 3,
      approvalExpiryMs: 3_600_000,
      callbackTimeoutMs: 3_600_000,
      repository: { owner: "mryfmo", repo: "ai-ops-platform", ref: "main" },
      requestedBy: "fixture",
      ...overrides,
    },
  });
  // 相関 ID = dispatch の決定的 idempotency key（activity schedule 前に確定）。
  const correlationFor = (taskId) => `coding-task/${taskId}#dispatchCodingTask#0`;
  const callbackFor = (taskId, overrides = {}) => ({
    taskId,
    dispatchId: correlationFor(taskId),
    outcome: "pr_created",
    runId: "run-1",
    prNumber: 41,
    ...overrides,
  });
  const reviewFor = (taskId) => ({ taskId, verdict: "complete", reviewerObjectId: "reviewer-1" });
  const completeDecision = (taskId) => ({ taskId, status: "complete", reviewerObjectId: "reviewer-1" });
  const pendingDecision = (taskId) => ({ taskId, status: "pending", reviewerObjectId: "" });

  /** 非冪等 dispatch + review 決定 read の代役 store。loseResponse で応答喪失を再現。
   *  reviewDecisions は DB 正本の代役 queue: 先頭から消費し、最後の要素は繰り返す。
   *  pending を先頭に積めば「signal だけでは完了しない」経路を記録できる。 */
  function makeCodingActivities({ loseResponse, reviewDecisions = [], dispatchDelayMs = 0 }) {
    const store = new Map();
    const decisions = [...reviewDecisions];
    return {
      async dispatchCodingTask(input, idempotencyKey) {
        const value = `dispatch:${input.taskId}`;
        store.set(idempotencyKey, value);
        if (dispatchDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, dispatchDelayMs));
        if (loseResponse) throw new Error("synthetic lost response after dispatch");
        return value;
      },
      async findCodingTaskDispatch(idempotencyKey) {
        return store.get(idempotencyKey) ?? null;
      },
      async readReviewDecision() {
        return (decisions.length > 1 ? decisions.shift() : decisions[0]) ?? null;
      },
    };
  }

  const waitQuery = async (handle, queryName, predicate, label) => {
    // cache 無効 worker では query 毎に full replay + sticky timeout が挟まるため、
    // poll は粗く・全体予算は広く取る。
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const value = await handle.query(queryName).catch(() => undefined);
      if (value !== undefined && predicate(value)) return value;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`fixture wait timed out: ${label}`);
  };

  const approveChild = async (taskId) => {
    const child = env.client.workflow.getHandle(`coding-task/${taskId}/approval`);
    await waitQuery(child, "approvalState", (s) => s.decided === false, "child approval waiting");
    await child.signal("approvalDecision", validSignal);
  };

  const recordCodingTask = async (
    name,
    { taskId, loseResponse, reviewDecisions, dispatchDelayMs, workerOptions = {}, drive },
  ) => {
    const taskQueue = `coding-task-${name}`;
    const workflowId = `coding-task/${taskId}`;
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: makeCodingActivities({ loseResponse, reviewDecisions, dispatchDelayMs }),
      ...workerOptions,
    });
    const result = await worker.runUntil(async () => {
      const handle = await env.client.workflow.start("codingTaskWorkflow", {
        taskQueue,
        workflowId,
        args: [drive.input],
      });
      return drive.run(handle);
    });
    const history = await env.client.workflow.getHandle(workflowId).fetchHistory();
    fs.writeFileSync(
      path.join(fixturesDir, `coding-task.${name}.history.json`),
      `${JSON.stringify(history.toJSON(), null, 2)}\n`,
    );
    console.log(`recorded coding-task.${name}.history.json (${result.payload.phase}/${result.payload.failureReason})`);
    return result;
  };

  // complete: 成功経路 + adversarial callback（早期 wrong-phase / malformed /
  // 受理後 duplicate・conflicting）をすべて拒否記録して complete まで到達。
  {
    const taskId = taskIdFor(0);
    await recordCodingTask("complete", {
      taskId,
      loseResponse: false,
      // 1 回目の wake は pending（signal 単独では完了しない）、2 回目で complete。
      reviewDecisions: [pendingDecision(taskId), completeDecision(taskId)],
      drive: {
        input: codingInput(taskId),
        run: async (handle) => {
          await handle.signal("codingTaskCallback", callbackFor(taskId)); // 早期 → dispatch-mismatch（dispatch 前）
          await approveChild(taskId);
          await waitQuery(handle, "codingTaskPhase", (p) => p === "running", "phase running");
          await handle.signal("codingTaskCallback", null); // malformed
          await handle.signal("codingTaskCallback", callbackFor(taskId, { dispatchId: "dispatch:forged" })); // dispatch-mismatch
          await handle.signal("codingTaskCallback", callbackFor(taskId)); // 受理
          await handle.signal("codingTaskCallback", callbackFor(taskId)); // exact replay → duplicate
          await handle.signal("codingTaskCallback", callbackFor(taskId, { runId: "run-2" })); // 別 run → conflicting
          await handle.signal("codingTaskCallback", callbackFor(taskId, { prNumber: 42 })); // 別 PR → conflicting
          await waitQuery(handle, "codingTaskPhase", (p) => p === "review_pending", "phase review_pending");
          await handle.signal("codingTaskReview", reviewFor(taskId)); // wake 1 → pending → unconfirmed
          await handle.signal("codingTaskReview", reviewFor(taskId)); // wake 2 → complete
          return handle.result();
        },
      },
    });
  }

  // dispatch-reconciled: 応答喪失でも dispatch は 1 回だけ・reconcile 回収（TMP-003）。
  {
    const taskId = taskIdFor(1);
    await recordCodingTask("dispatch-reconciled", {
      taskId,
      loseResponse: true,
      reviewDecisions: [completeDecision(taskId)],
      drive: {
        input: codingInput(taskId),
        run: async (handle) => {
          await approveChild(taskId);
          await waitQuery(handle, "codingTaskPhase", (p) => p === "running", "phase running");
          await handle.signal("codingTaskCallback", callbackFor(taskId));
          await waitQuery(handle, "codingTaskPhase", (p) => p === "review_pending", "phase review_pending");
          await handle.signal("codingTaskReview", reviewFor(taskId));
          return handle.result();
        },
      },
    });
  }

  // approval-rejected: 承認なしでは dispatch が一切 schedule されない。
  {
    const taskId = taskIdFor(2);
    await recordCodingTask("approval-rejected", {
      taskId,
      loseResponse: false,
      drive: {
        input: codingInput(taskId),
        run: async (handle) => {
          const child = env.client.workflow.getHandle(`coding-task/${taskId}/approval`);
          await waitQuery(child, "approvalState", (s) => s.decided === false, "child approval waiting");
          await child.signal("approvalDecision", { ...validSignal, decision: "rejected" });
          return handle.result();
        },
      },
    });
  }

  // callback-timeout: callback 不達は complete へ自動遷移せず failed 終端。
  {
    const taskId = taskIdFor(3);
    await recordCodingTask("callback-timeout", {
      taskId,
      loseResponse: false,
      drive: {
        input: codingInput(taskId, { callbackTimeoutMs: 5_000 }),
        run: async (handle) => {
          await approveChild(taskId);
          await waitQuery(handle, "codingTaskPhase", (p) => p === "running", "phase running before timeout");
          // result() 待ちの auto-skip は test server 側で不安定なため、明示的に期限を跨ぐ。
          await env.sleep(10_000);
          return handle.result();
        },
      },
    });
  }

  // crash-resume（TMP-004）: per-task history 再構築（maxCachedWorkflows=0）でも
  // 全遷移が durable に再開され complete まで到達する。
  // in-flight race（P3-T04-005）: dispatch activity 実行中に正規 callback が届いても
  // 棄却されず、activity 完了後そのまま前進して complete する。
  {
    const taskId = taskIdFor(6);
    await recordCodingTask("inflight-callback", {
      taskId,
      loseResponse: false,
      reviewDecisions: [completeDecision(taskId)],
      dispatchDelayMs: 4_000,
      drive: {
        input: codingInput(taskId),
        run: async (handle) => {
          await approveChild(taskId);
          await waitQuery(handle, "codingTaskPhase", (p) => p === "queued", "phase queued (dispatch in flight)");
          await handle.signal("codingTaskCallback", callbackFor(taskId)); // activity 実行中に到着
          await waitQuery(handle, "codingTaskPhase", (p) => p === "review_pending", "phase review_pending");
          await handle.signal("codingTaskReview", reviewFor(taskId));
          return handle.result();
        },
      },
    });
  }

  // no-change: レビュー対象 PR が存在しない正当な no-op は review なしで complete。
  {
    const taskId = taskIdFor(5);
    await recordCodingTask("no-change", {
      taskId,
      loseResponse: false,
      reviewDecisions: [],
      drive: {
        input: codingInput(taskId),
        run: async (handle) => {
          await approveChild(taskId);
          await waitQuery(handle, "codingTaskPhase", (p) => p === "running", "phase running");
          await handle.signal("codingTaskCallback", callbackFor(taskId, { outcome: "no_change", prNumber: undefined }));
          return handle.result();
        },
      },
    });
  }

  {
    const taskId = taskIdFor(4);
    await recordCodingTask("crash-resume", {
      taskId,
      loseResponse: false,
      reviewDecisions: [completeDecision(taskId)],
      workerOptions: { maxCachedWorkflows: 0, stickyQueueScheduleToStartTimeout: "1 second" },
      drive: {
        input: codingInput(taskId),
        run: async (handle) => {
          await approveChild(taskId);
          await waitQuery(handle, "codingTaskPhase", (p) => p === "running", "phase running");
          await handle.signal("codingTaskCallback", callbackFor(taskId));
          await waitQuery(handle, "codingTaskPhase", (p) => p === "review_pending", "phase review_pending");
          await handle.signal("codingTaskReview", reviewFor(taskId));
          return handle.result();
        },
      },
    });
  }

  // --- P3-T05 GraphSubscriptionWorkflow fixtures（TMP-003） ---
  const graphInput = (subscriptionId, operation, observedAtMs, executionMode) => ({
    schemaVersion: 1,
    payload:
      operation === "renewal"
        ? {
            subscriptionId,
            operation,
            executionMode,
            sequence: 0,
            observedAtMs,
            expiresAtMs: observedAtMs + 6 * 60 * 60_000,
          }
        : { subscriptionId, operation, executionMode, sequence: 0, observedAtMs },
  });

  function makeGraphActivities({ subscriptionId, preexisting = false, loseResponse = false }) {
    const renewals = new Map();
    const receipt = (operation, checkpoint) => ({
      schemaVersion: 1,
      payload: { subscriptionId, operation, checkpoint },
    });
    return {
      async findGraphSubscriptionRenewal(_input, idempotencyKey) {
        if (preexisting) return receipt("renewal", "legacy-scheduler-write");
        return renewals.has(idempotencyKey) ? receipt("renewal", renewals.get(idempotencyKey)) : null;
      },
      async renewGraphSubscription(_input, idempotencyKey) {
        renewals.set(idempotencyKey, idempotencyKey);
        if (loseResponse) throw new Error("synthetic response loss after Graph renewal");
        return receipt("renewal", idempotencyKey);
      },
      async fallbackGraphSubscriptionToPolling() {
        return receipt("renewal", "polling-backfill");
      },
      async runGraphSubscriptionDelta() {
        return receipt("delta", "delta-link-2");
      },
      async reconcileGraphSubscription() {
        return receipt("reconcile", "etag-2");
      },
    };
  }

  const recordGraphSubscription = async (name, subscriptionId, operation, activityOptions = {}) => {
    const observedAtMs = await env.currentTimeMs();
    const taskQueue = `graph-subscription-${name}`;
    const workflowId = `graph-subscription/${operation}:${subscriptionId}:0`;
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: makeGraphActivities({ subscriptionId, ...activityOptions }),
    });
    const result = await worker.runUntil(
      env.client.workflow.execute("graphSubscriptionWorkflow", {
        taskQueue,
        workflowId,
        args: [graphInput(subscriptionId, operation, observedAtMs, name.startsWith("shadow-") ? "shadow" : "active")],
      }),
    );
    await saveHistory(workflowId, `graph-subscription.${name}.history.json`);
    console.log(`recorded graph-subscription.${name}.history.json (${result.payload.outcome})`);
  };

  await recordGraphSubscription("renewal-lost-response", "fixture-subscription-1", "renewal", {
    loseResponse: true,
  });
  await recordGraphSubscription("shadow-no-duplicate", "fixture-subscription-2", "renewal", {
    preexisting: true,
  });
  await recordGraphSubscription("delta", "fixture-subscription-3", "delta");
  await recordGraphSubscription("reconcile", "fixture-subscription-4", "reconcile");

  // --- P3-T06 JIT expiry / health fixtures（TMP-003） ---
  const JIT_GRANT_ID = "00000000-0000-4000-8000-000000000006";
  const jitHealthInput = (operation, sequence, observedAtMs, executionMode) => ({
    schemaVersion: 1,
    payload: { operation, sequence, observedAtMs, executionMode },
  });

  function makeJitHealthActivities({ preexisting = false, loseResponse = false } = {}) {
    const revocations = new Map();
    const revocationReceipt = (input, idempotencyKey) => ({
      schemaVersion: 1,
      payload: {
        grantId: input.payload.grantId,
        idempotencyKey,
        revokedAtMs: input.payload.observedAtMs,
      },
    });
    return {
      async findJitRevocationCandidates(input) {
        return {
          schemaVersion: 1,
          payload: { evaluatedAtMs: input.payload.observedAtMs, grants: [{ grantId: JIT_GRANT_ID }] },
        };
      },
      async findJitRevocation(input, idempotencyKey) {
        if (preexisting) return revocationReceipt(input, idempotencyKey);
        return revocations.get(idempotencyKey) ?? null;
      },
      async revokeExpiredGrant(input, idempotencyKey) {
        const receipt = revocationReceipt(input, idempotencyKey);
        revocations.set(idempotencyKey, receipt);
        if (loseResponse) throw new Error("synthetic response loss after JIT revoke");
        return receipt;
      },
      async evaluateHealth(input) {
        return {
          schemaVersion: 1,
          payload: {
            observedAtMs: input.payload.observedAtMs,
            healthy: false,
            consecutiveFailures: 3,
            decision: "activate_failsafe",
          },
        };
      },
      async applyHealthDecision(input) {
        return input;
      },
    };
  }

  const recordJitHealth = async ({ name, workflowType, operation, sequence, executionMode, activityOptions }) => {
    const observedAtMs = await env.currentTimeMs();
    const taskQueue = `jit-health-${name}`;
    const workflowId = `incident/${operation === "jit-expiry" ? "jit-expiry" : "health"}:global:${String(sequence)}`;
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: makeJitHealthActivities(activityOptions),
    });
    const result = await worker.runUntil(
      env.client.workflow.execute(workflowType, {
        taskQueue,
        workflowId,
        args: [jitHealthInput(operation, sequence, observedAtMs, executionMode)],
      }),
    );
    await saveHistory(workflowId, `jit-health.${name}.history.json`);
    console.log(`recorded jit-health.${name}.history.json (${result.payload.outcome})`);
  };

  await recordJitHealth({
    name: "jit-lost-response",
    workflowType: "jitExpiryWorkflow",
    operation: "jit-expiry",
    sequence: 11,
    executionMode: "active",
    activityOptions: { loseResponse: true },
  });
  await recordJitHealth({
    name: "jit-shadow-no-duplicate",
    workflowType: "jitExpiryWorkflow",
    operation: "jit-expiry",
    sequence: 12,
    executionMode: "shadow",
    activityOptions: { preexisting: true },
  });
  await recordJitHealth({
    name: "health",
    workflowType: "healthEvaluationWorkflow",
    operation: "health",
    sequence: 13,
    executionMode: "active",
  });
  // --- P3-T07 report delivery fixtures（TMP-003 / recipient idempotency /
  //     PrjOps:SPEC-INT-050 profile 分岐 / pending-no-resend） ---
  {
    // 実 DeliveryLogStore の意味論: send 前に pending を記録し、応答後に sent。
    const makeReportActivities = ({
      profile = "PRF-04",
      valid = true,
      sentAlready = [],
      pendingAlready = [],
      loseFor = [],
      forgedReconcileFor = [],
    }) => {
      const ledger = new Map();
      for (const recipientId of sentAlready) ledger.set(recipientId, "sent");
      for (const recipientId of pendingAlready) ledger.set(recipientId, "pending");
      return {
        async resolveReportProfile(input) {
          return {
            schemaVersion: 1,
            payload: {
              reportId: input.payload.reportId,
              profile,
              requiresApproval: profile === "PRF-04" || profile === "PRF-05",
            },
          };
        },
        async generateReport(input) {
          return { schemaVersion: 1, payload: { reportId: input.payload.reportId, contentChecksum: "checksum-1" } };
        },
        async validateReport(input) {
          return {
            schemaVersion: 1,
            payload: { reportId: input.payload.reportId, valid, reason: valid ? null : "numbers missing" },
          };
        },
        async findReportDelivery(input, idempotencyKey) {
          const status = ledger.get(input.payload.recipientId);
          if (status === undefined) return null;
          // 偽装 reconcile: pending 行に対し forged key の sent receipt を返す
          // （P3-T07-003 の契約違反 regression 用）。
          if (status === "pending" && forgedReconcileFor.includes(input.payload.recipientId)) {
            return {
              schemaVersion: 1,
              payload: {
                reportId: input.payload.reportId,
                recipientId: input.payload.recipientId,
                status: "sent",
                idempotencyKey: "forged#key#0",
              },
            };
          }
          return {
            schemaVersion: 1,
            payload: {
              reportId: input.payload.reportId,
              recipientId: input.payload.recipientId,
              status,
              ...(status === "sent" ? { idempotencyKey } : {}),
            },
          };
        },
        async deliverReport(input, idempotencyKey) {
          ledger.set(input.payload.recipientId, "pending");
          if (loseFor.includes(input.payload.recipientId)) {
            throw new Error("synthetic lost response after delivery");
          }
          ledger.set(input.payload.recipientId, "sent");
          return {
            schemaVersion: 1,
            payload: { reportId: input.payload.reportId, recipientId: input.payload.recipientId, idempotencyKey },
          };
        },
      };
    };
    const APPROVAL = { approvalId: APPROVAL_ID, approvalVersion: 3, approvalExpiryMs: 3_600_000 };
    const reportInput = (reportId, overrides = {}) => ({
      schemaVersion: 1,
      payload: {
        reportId,
        approval: APPROVAL,
        executionMode: "active",
        recipients: [{ recipientId: "user-1" }, { recipientId: "user-2" }],
        requestedBy: "fixture",
        ...overrides,
      },
    });
    const recordReportDelivery = async (
      name,
      reportId,
      activityOptions,
      { approve = true, driveApproval = true, input } = {},
    ) => {
      const taskQueue = `report-delivery-${name}`;
      const workflowId = `report/delivery:${reportId}`;
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath,
        activities: makeReportActivities(activityOptions),
      });
      const outcome = await worker.runUntil(async () => {
        const handle = await env.client.workflow.start("reportDeliveryWorkflow", {
          taskQueue,
          workflowId,
          args: [input ?? reportInput(reportId)],
        });
        if (driveApproval) {
          const child = env.client.workflow.getHandle(`${workflowId}/approval`);
          await waitQuery(child, "approvalState", (st) => st.decided === false, "report approval waiting");
          await child.signal("approvalDecision", {
            ...validSignal,
            decision: approve ? "approved" : "rejected",
          });
        }
        return handle.result().then(
          (r) => `${r.payload.phase}/${r.payload.failureReason}`,
          (e) => `wf-failed:${e.cause?.type ?? e.name}`,
        );
      });
      await saveHistory(workflowId, `report-delivery.${name}.history.json`);
      console.log(`recorded report-delivery.${name}.history.json (${outcome})`);
    };

    // complete（PRF-04 承認経路）: user-1 は sent 既配信（reconciled、deliverReport
    // 不発火）、user-2 のみ executed（recipient idempotency の混在証跡）。
    await recordReportDelivery("complete", "fixture-report-1", { sentAlready: ["user-1"] });
    // approval-free（PRF-02）: approval child を起動せず配信まで直行（P3-T07-001）。
    await recordReportDelivery(
      "approval-free",
      "fixture-report-6",
      { profile: "PRF-02" },
      { driveApproval: false, input: reportInput("fixture-report-6", { approval: null }) },
    );
    // prf05-no-approval（負）: 承認必須 profile に approval パラメータ欠如 →
    // E-CP-CONTRACT で失敗し、child も配信も一切ない（bypass 不能）。
    await recordReportDelivery(
      "prf05-no-approval",
      "fixture-report-7",
      { profile: "PRF-05" },
      { driveApproval: false, input: reportInput("fixture-report-7", { approval: null }) },
    );
    // delivery-unresolved: user-1 の応答喪失 → 台帳は pending のまま → reconcile は
    // sent を確認できず E-CP-EXTERNAL-UNRESOLVED（deliverReport schedule は 1 回）。
    await recordReportDelivery("delivery-unresolved", "fixture-report-2", { loseFor: ["user-1"] });
    // reconcile-contract（負・P3-T07-003）: 応答喪失後の reconcile が forged key の
    // sent receipt を返す → E-CP-CONTRACT で終端し wedge しない・再配信もしない。
    await recordReportDelivery("reconcile-contract", "fixture-report-9", {
      loseFor: ["user-1"],
      forgedReconcileFor: ["user-1"],
    });
    // pending-no-resend: 前回 run が残した pending 行を preflight が検出 →
    // deliverReport を一切 schedule せず unresolved（自動再送禁止の再実行証跡）。
    await recordReportDelivery("pending-no-resend", "fixture-report-8", { pendingAlready: ["user-1"] });
    // approval-rejected: 配信 activity は一切 schedule されない。
    await recordReportDelivery("approval-rejected", "fixture-report-3", {}, { approve: false });
    // validation-failed: approval child すら起動しない。
    await recordReportDelivery("validation-failed", "fixture-report-4", { valid: false }, { driveApproval: false });
    // shadow: 未配信 recipient への delivery write が構造的に発生しない。
    await recordReportDelivery(
      "shadow",
      "fixture-report-5",
      {},
      {
        input: reportInput("fixture-report-5", { executionMode: "shadow" }),
      },
    );
  }
  // --- P3-T08 plane sync fixtures（TMP-003 / dedupe / CAS stale / draft 境界 /
  //     child 実行証跡） ---
  {
    const identityFor = (n) => ({
      externalSource: "github",
      externalId: `issue-${n}`,
      projectId: "proj-1",
      mappingVersion: 3,
    });
    const idKey = (identity) =>
      `${identity.externalSource}:${identity.externalId}:${identity.projectId}:${identity.mappingVersion}`;
    // 内部 sync 台帳の代役: write 前に pending、応答後に written。promotion の
    // written は draft receipt 形（baseline + draft:true）で保存する。
    // stale 保証は write authority の CAS: revisionAtWrite が baseline と不一致なら
    // created ではなく stale union を返し、台帳へは書かない。
    const makePlaneActivities = ({
      writtenAlready = [],
      pendingAlready = [],
      loseFor = [],
      loseAfterWrittenFor = [],
      eligibility = { engineeringReady: true, approved: true, baselineRevision: "rev-7" },
      revisionAtRead = "rev-7",
      revisionAtWrite = null,
    }) => {
      const ledger = new Map();
      for (const op of writtenAlready) ledger.set(op, { status: "written" });
      for (const op of pendingAlready) ledger.set(op, { status: "pending" });
      const write = (operation) => async (input, idempotencyKey) => {
        const identity = input.payload.identity;
        if (operation === "promotion") {
          const effective = revisionAtWrite ?? revisionAtRead;
          if (effective !== input.payload.baselineRevision) {
            return {
              schemaVersion: 1,
              payload: { ...identity, result: "stale", observedRevision: effective },
            };
          }
        }
        ledger.set(operation, { status: "pending" });
        if (loseFor.includes(operation)) throw new Error("synthetic lost response after plane write");
        const entry =
          operation === "promotion"
            ? { status: "written", baselineRevision: input.payload.baselineRevision, draft: true }
            : { status: "written" };
        ledger.set(operation, entry);
        if (loseAfterWrittenFor.includes(operation)) {
          // 外部 write は成立し台帳も written に達したが応答だけが失われた。
          throw new Error("synthetic lost response after committed plane write");
        }
        if (operation === "promotion") {
          return {
            schemaVersion: 1,
            payload: {
              ...identity,
              result: "created",
              idempotencyKey,
              baselineRevision: input.payload.baselineRevision,
              draft: true,
            },
          };
        }
        return { schemaVersion: 1, payload: { ...identity, idempotencyKey } };
      };
      return {
        async findPlaneSyncWrite(input, idempotencyKey) {
          const identity = input.payload.identity;
          const entry = ledger.get(input.payload.operation);
          if (entry === undefined) return null;
          if (entry.status === "pending") {
            return { schemaVersion: 1, payload: { ...identity, status: "pending" } };
          }
          if (input.payload.operation === "promotion") {
            return {
              schemaVersion: 1,
              payload: {
                ...identity,
                status: "written",
                idempotencyKey,
                baselineRevision: entry.baselineRevision ?? "rev-7",
                draft: true,
              },
            };
          }
          return { schemaVersion: 1, payload: { ...identity, status: "written", idempotencyKey } };
        },
        projectToPlane: write("projection"),
        emitPlaneEvent: write("event"),
        createPromotionDraft: write("promotion"),
        async readPromotionEligibility(input) {
          return { schemaVersion: 1, payload: { ...input.payload.identity, ...eligibility } };
        },
        async readWorkItemRevision(input) {
          return { schemaVersion: 1, payload: { ...input.payload.identity, revision: revisionAtRead } };
        },
      };
    };
    const planeInput = (identity, overrides = {}) => ({
      schemaVersion: 1,
      payload: {
        ...identity,
        executionMode: "active",
        operations: ["projection", "event", "promotion"],
        ...overrides,
      },
    });
    const recordPlaneSync = async (name, n, activityOptions = {}, inputOverrides = {}) => {
      const identity = identityFor(n);
      const taskQueue = `plane-sync-${name}`;
      const workflowId = `plane-sync/${idKey(identity)}`;
      const input = planeInput(identity, inputOverrides);
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath,
        activities: makePlaneActivities(activityOptions),
      });
      const outcome = await worker.runUntil(async () => {
        const handle = await env.client.workflow.start("planeSyncWorkflow", {
          taskQueue,
          workflowId,
          args: [input],
        });
        return handle.result().then(
          (r) => `${r.payload.phase}:${r.payload.outcomes.map((o) => `${o.operation}=${o.outcome}`).join(",")}`,
          (e) => `wf-failed:${e.cause?.type ?? e.name}`,
        );
      });
      await saveHistory(workflowId, `plane-sync.${name}.history.json`);
      // P3-T08-006: 実行証跡は child 側にある。関与した child の history も保存する。
      for (const operation of input.payload.operations) {
        try {
          await saveHistory(`${workflowId}/${operation}`, `plane-sync.${name}.${operation}.history.json`);
        } catch {
          // 起動前に親が失敗した operation は child が存在しない。
        }
      }
      console.log(`recorded plane-sync.${name} (${outcome})`);
    };

    await recordPlaneSync("complete", 1, { writtenAlready: ["projection"] });
    await recordPlaneSync("unknown-write-reconciled", 2, { loseAfterWrittenFor: ["projection"] });
    // 早期 read で stale 検出（安価経路）。
    await recordPlaneSync("promotion-stale", 3, { revisionAtRead: "rev-8" }, { operations: ["promotion"] });
    // CAS stale（P3-T08-004）: read 時は一致、write 直前に revision 移動 →
    // write authority が stale union を返し、写経も台帳書き込みもない。
    await recordPlaneSync(
      "promotion-cas-stale",
      7,
      { revisionAtRead: "rev-7", revisionAtWrite: "rev-8" },
      { operations: ["promotion"] },
    );
    // promotion の committed-lost（P3-T08-003）: reconcile は draft receipt 形のみ受理。
    await recordPlaneSync(
      "promotion-reconciled",
      8,
      { loseAfterWrittenFor: ["promotion"] },
      { operations: ["promotion"] },
    );
    await recordPlaneSync(
      "promotion-not-eligible",
      4,
      { eligibility: { engineeringReady: true, approved: false, baselineRevision: "rev-7" } },
      { operations: ["promotion"] },
    );
    await recordPlaneSync(
      "pending-no-redispatch",
      5,
      { pendingAlready: ["projection"] },
      {
        operations: ["projection"],
      },
    );
    await recordPlaneSync("shadow", 6, {}, { executionMode: "shadow" });

    // 直接 child 起動 + 不正恒等（P3-T08-002）: 完全検証が E-CP-CONTRACT で遮断し、
    // activity は一切 schedule されない。
    {
      const taskQueue = "plane-sync-child-invalid";
      const workflowId = "plane-sync/child-invalid-identity";
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath,
        activities: makePlaneActivities({}),
      });
      const outcome = await worker.runUntil(async () => {
        const handle = await env.client.workflow.start("planeProjectionWorkflow", {
          taskQueue,
          workflowId,
          args: [
            {
              schemaVersion: 1,
              payload: {
                identity: { externalSource: "github", externalId: "", projectId: "proj-1", mappingVersion: 3 },
                executionMode: "active",
              },
            },
          ],
        });
        return handle.result().then(
          (r) => `unexpected:${JSON.stringify(r.payload)}`,
          (e) => `wf-failed:${e.cause?.type ?? e.name}`,
        );
      });
      await saveHistory(workflowId, "plane-sync.child-invalid-identity.history.json");
      console.log(`recorded plane-sync.child-invalid-identity (${outcome})`);
    }
  }
} finally {
  await env.teardown();
}
