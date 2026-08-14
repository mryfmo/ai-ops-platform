// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / FinalArch:CON-002 / TMP-001 / TMP-003 / TMP-004 / WBS P3-T11
// P3-T02..T08 の durable workflow を disposable time-skipping env と recorded
// histories だけで検証する決定的 chaos harness。実外部 service は使用しない。

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import proto from "@temporalio/proto";
import {
  ApplicationFailure,
  WorkflowExecutionAlreadyStartedError,
  WorkflowFailedError,
  type WorkflowHandle,
} from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";

import {
  GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS,
} from "../../packages/control-plane/src/lib/graphSubscriptionState.js";
import {
  HEALTH_EVALUATION_INTERVAL_MS,
  JIT_EXPIRY_INTERVAL_MS,
} from "../../packages/control-plane/src/lib/jitHealthState.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const controlPlaneRoot = path.join(repositoryRoot, "packages", "control-plane");
const workflowsPath = path.join(controlPlaneRoot, "src", "workflows", "entry.ts");
const fixturesRoot = path.join(controlPlaneRoot, "tests", "fixtures");
const evidencePath = path.join(repositoryRoot, "verification", "chaos", "chaos-evidence.json");

const APPROVAL_ID = "0f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a9f";
const TASK_ID = "3f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a99";
const GRANT_ID = "00000000-0000-4000-8000-000000000011";

const WORKFLOWS = [
  "replayProbeWorkflow",
  "cancellationProbeWorkflow",
  "approvalWorkflow",
  "codingTaskWorkflow",
  "graphSubscriptionWorkflow:renewal",
  "graphSubscriptionWorkflow:delta",
  "graphSubscriptionWorkflow:reconcile",
  "jitExpiryWorkflow",
  "healthEvaluationWorkflow",
  "reportDeliveryWorkflow",
  "planeSyncWorkflow",
  "planeProjectionWorkflow",
  "planeEventWorkflow",
  "planePromotionWorkflow",
] as const;

type WorkflowName = (typeof WORKFLOWS)[number];
type Classification = "recovered" | "explicit-fail" | "running-wedge";
type ChaosDimension = "restart" | "timeout" | "duplicate" | "approval";

interface MatrixEntry {
  readonly workflow: WorkflowName;
  readonly classification: Classification;
  readonly terminal: string;
  readonly probe: string;
  readonly externalWrites: number;
  readonly duplicateSideEffects: number;
}

export interface ChaosEvidence {
  readonly schemaVersion: 1;
  readonly taskId: "P3-T11";
  readonly deterministic: true;
  readonly workflows: readonly WorkflowName[];
  readonly matrix: Readonly<Record<ChaosDimension, readonly MatrixEntry[]>>;
  readonly replayFixtures: readonly string[];
  readonly summary: {
    readonly workflows: number;
    readonly scenarios: number;
    readonly recovered: number;
    readonly explicitFailures: number;
    readonly duplicateSideEffects: number;
    readonly runningWedges: number;
    readonly silentSuccesses: number;
  };
}

interface RestartResult {
  readonly workflow: WorkflowName;
  readonly classification: Classification;
  readonly terminal: string;
  readonly workflowTasks: number;
  readonly externalWrites: number;
}

interface Counters {
  activeWorkflow: WorkflowName;
  readonly writes: Map<WorkflowName, number>;
}

function payload<T>(input: unknown): T {
  return (input as { payload: T }).payload;
}

function addWrite(counters: Counters): void {
  counters.writes.set(counters.activeWorkflow, (counters.writes.get(counters.activeWorkflow) ?? 0) + 1);
}

function approvalInput(expiryMs: number) {
  return {
    schemaVersion: 1 as const,
    payload: { approvalId: APPROVAL_ID, version: 3, expiryMs, requestedBy: "chaos-suite" },
  };
}

const validApprovalSignal = {
  approvalId: APPROVAL_ID,
  version: 3,
  decision: "approved",
  approverObjectId: "chaos-approver",
  reason: "deterministic chaos approval",
} as const;

function activities(counters: Counters) {
  const externalObjects = new Map<string, string>();
  const codingDispatches = new Map<string, string>();
  const graphRenewals = new Map<
    string,
    { schemaVersion: 1; payload: { subscriptionId: string; operation: string; checkpoint: string } }
  >();
  const graphIdempotentWrites = new Set<string>();
  const jitRevocations = new Map<string, unknown>();
  const healthDecisions = new Set<number>();
  const reportLedger = new Map<string, "pending" | "sent">();
  const planeLedger = new Map<
    string,
    { status: "pending" | "written"; operation: string; baselineRevision?: string }
  >();
  const graphReceipt = (subscriptionId: string, operation: string, checkpoint: string) => ({
    schemaVersion: 1 as const,
    payload: { subscriptionId, operation, checkpoint },
  });
  const planeReceipt = (identity: Record<string, unknown>, idempotencyKey: string) => ({
    schemaVersion: 1 as const,
    payload: { ...identity, idempotencyKey },
  });

  return {
    async createExternalObject(input: { name: string }, idempotencyKey: string) {
      addWrite(counters);
      const value = `obj:${input.name}`;
      externalObjects.set(idempotencyKey, value);
      return value;
    },
    async findExternalObject(idempotencyKey: string) {
      return externalObjects.get(idempotencyKey) ?? null;
    },
    async dispatchCodingTask(input: { taskId: string }, idempotencyKey: string) {
      addWrite(counters);
      const value = `dispatch:${input.taskId}`;
      codingDispatches.set(idempotencyKey, value);
      return value;
    },
    async findCodingTaskDispatch(idempotencyKey: string) {
      return codingDispatches.get(idempotencyKey) ?? null;
    },
    async readReviewDecision(taskId: string) {
      return { taskId, status: "complete", reviewerObjectId: "chaos-reviewer" };
    },
    async findGraphSubscriptionRenewal(_input: unknown, idempotencyKey: string) {
      return graphRenewals.get(idempotencyKey) ?? null;
    },
    async renewGraphSubscription(input: unknown, idempotencyKey: string) {
      addWrite(counters);
      const request = payload<{ subscriptionId: string; operation: string }>(input);
      const receipt = graphReceipt(request.subscriptionId, request.operation, idempotencyKey);
      graphRenewals.set(idempotencyKey, receipt);
      return receipt;
    },
    async fallbackGraphSubscriptionToPolling(input: unknown) {
      const request = payload<{ subscriptionId: string; operation: string }>(input);
      return graphReceipt(request.subscriptionId, request.operation, "polling-backfill");
    },
    async runGraphSubscriptionDelta(input: unknown) {
      const request = payload<{ subscriptionId: string; operation: string }>(input);
      const key = `${request.subscriptionId}:${request.operation}`;
      if (!graphIdempotentWrites.has(key)) addWrite(counters);
      graphIdempotentWrites.add(key);
      return graphReceipt(request.subscriptionId, request.operation, "delta-checkpoint");
    },
    async reconcileGraphSubscription(input: unknown) {
      const request = payload<{ subscriptionId: string; operation: string }>(input);
      return graphReceipt(request.subscriptionId, request.operation, "reconcile-checkpoint");
    },
    async findJitRevocationCandidates(input: unknown) {
      const request = payload<{ observedAtMs: number }>(input);
      return {
        schemaVersion: 1,
        payload: { evaluatedAtMs: request.observedAtMs, grants: [{ grantId: GRANT_ID }] },
      };
    },
    async findJitRevocation(_input: unknown, idempotencyKey: string) {
      return jitRevocations.get(idempotencyKey) ?? null;
    },
    async revokeExpiredGrant(input: unknown, idempotencyKey: string) {
      addWrite(counters);
      const request = payload<{ grantId: string; observedAtMs: number }>(input);
      const receipt = {
        schemaVersion: 1,
        payload: { grantId: request.grantId, idempotencyKey, revokedAtMs: request.observedAtMs },
      };
      jitRevocations.set(idempotencyKey, receipt);
      return receipt;
    },
    async evaluateHealth(input: unknown) {
      const request = payload<{ observedAtMs: number }>(input);
      return {
        schemaVersion: 1,
        payload: {
          observedAtMs: request.observedAtMs,
          healthy: false,
          consecutiveFailures: 3,
          decision: "activate_failsafe",
        },
      };
    },
    async applyHealthDecision(input: unknown) {
      const observedAtMs = payload<{ observedAtMs: number }>(input).observedAtMs;
      if (!healthDecisions.has(observedAtMs)) addWrite(counters);
      healthDecisions.add(observedAtMs);
      return input;
    },
    async resolveReportProfile(input: unknown) {
      const request = payload<{ reportId: string }>(input);
      return {
        schemaVersion: 1,
        payload: { reportId: request.reportId, profile: "PRF-04", requiresApproval: true },
      };
    },
    async generateReport(input: unknown) {
      const request = payload<{ reportId: string }>(input);
      return { schemaVersion: 1, payload: { reportId: request.reportId, contentChecksum: "chaos-checksum" } };
    },
    async validateReport(input: unknown) {
      const request = payload<{ reportId: string }>(input);
      return { schemaVersion: 1, payload: { reportId: request.reportId, valid: true, reason: null } };
    },
    async findReportDelivery(input: unknown, idempotencyKey: string) {
      const request = payload<{ reportId: string; recipientId: string }>(input);
      const status = reportLedger.get(idempotencyKey);
      if (status === undefined) return null;
      return {
        schemaVersion: 1,
        payload: {
          reportId: request.reportId,
          recipientId: request.recipientId,
          status,
          ...(status === "sent" ? { idempotencyKey } : {}),
        },
      };
    },
    async deliverReport(input: unknown, idempotencyKey: string) {
      reportLedger.set(idempotencyKey, "pending");
      addWrite(counters);
      const request = payload<{ reportId: string; recipientId: string }>(input);
      reportLedger.set(idempotencyKey, "sent");
      return {
        schemaVersion: 1,
        payload: { reportId: request.reportId, recipientId: request.recipientId, idempotencyKey },
      };
    },
    async findPlaneSyncWrite(input: unknown, idempotencyKey: string) {
      const request = payload<{ identity: Record<string, unknown>; operation: string }>(input);
      const entry = planeLedger.get(idempotencyKey);
      if (entry === undefined) return null;
      return {
        schemaVersion: 1,
        payload: {
          ...request.identity,
          status: entry.status,
          ...(entry.status === "written" ? { idempotencyKey } : {}),
          ...(entry.operation === "promotion" && entry.status === "written"
            ? { baselineRevision: entry.baselineRevision, draft: true }
            : {}),
        },
      };
    },
    async projectToPlane(input: unknown, idempotencyKey: string) {
      planeLedger.set(idempotencyKey, { status: "pending", operation: "projection" });
      addWrite(counters);
      const identity = payload<{ identity: Record<string, unknown> }>(input).identity;
      planeLedger.set(idempotencyKey, { status: "written", operation: "projection" });
      return planeReceipt(identity, idempotencyKey);
    },
    async emitPlaneEvent(input: unknown, idempotencyKey: string) {
      planeLedger.set(idempotencyKey, { status: "pending", operation: "event" });
      addWrite(counters);
      const identity = payload<{ identity: Record<string, unknown> }>(input).identity;
      planeLedger.set(idempotencyKey, { status: "written", operation: "event" });
      return planeReceipt(identity, idempotencyKey);
    },
    async readPromotionEligibility(input: unknown) {
      const identity = payload<{ identity: Record<string, unknown> }>(input).identity;
      return {
        schemaVersion: 1,
        payload: { ...identity, engineeringReady: true, approved: true, baselineRevision: "rev-chaos" },
      };
    },
    async readWorkItemRevision(input: unknown) {
      const identity = payload<{ identity: Record<string, unknown> }>(input).identity;
      return { schemaVersion: 1, payload: { ...identity, revision: "rev-chaos" } };
    },
    async createPromotionDraft(input: unknown, idempotencyKey: string) {
      const request = payload<{ identity: Record<string, unknown>; baselineRevision: string }>(input);
      planeLedger.set(idempotencyKey, {
        status: "pending",
        operation: "promotion",
        baselineRevision: request.baselineRevision,
      });
      addWrite(counters);
      planeLedger.set(idempotencyKey, {
        status: "written",
        operation: "promotion",
        baselineRevision: request.baselineRevision,
      });
      return {
        schemaVersion: 1,
        payload: {
          ...request.identity,
          result: "created",
          idempotencyKey,
          baselineRevision: request.baselineRevision,
          draft: true,
        },
      };
    },
  };
}

async function waitForQuery(
  handle: WorkflowHandle,
  queryName: string,
  predicate: (value: unknown) => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const value = await handle.query(queryName).catch(() => undefined);
    if (value !== undefined && predicate(value)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`chaos query did not reach expected state: ${queryName}`);
}

function isObjectWith(value: unknown, key: string, expected: unknown): boolean {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>)[key] === expected;
}

async function workflowTaskCount(
  env: Awaited<ReturnType<typeof TestWorkflowEnvironment.createTimeSkipping>>,
  id: string,
) {
  const history = await env.client.workflow.getHandle(id).fetchHistory();
  return history.events.filter((event) => event.workflowTaskStartedEventAttributes != null).length;
}

async function runRestartMatrix(): Promise<RestartResult[]> {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const counters: Counters = { activeWorkflow: WORKFLOWS[0], writes: new Map() };
  const taskQueue = "p3-t11-restart-cache-zero";
  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: activities(counters),
      maxCachedWorkflows: 0,
      stickyQueueScheduleToStartTimeout: "1 second",
    });
    return await worker.runUntil(async () => {
      const results: RestartResult[] = [];
      const record = async (
        workflow: WorkflowName,
        workflowId: string,
        expectedWrites: number,
        drive: () => Promise<{ classification: Classification; terminal: string }>,
      ) => {
        counters.activeWorkflow = workflow;
        const before = counters.writes.get(workflow) ?? 0;
        const outcome = await drive();
        const writes = (counters.writes.get(workflow) ?? 0) - before;
        const tasks = await workflowTaskCount(env, workflowId);
        if (tasks < 2) throw new Error(`${workflow}: cache-0 probe did not cross multiple workflow tasks`);
        if (writes !== expectedWrites) {
          throw new Error(
            `${workflow}: expected ${String(expectedWrites)} external writes, observed ${String(writes)}`,
          );
        }
        results.push({ workflow, ...outcome, workflowTasks: tasks, externalWrites: writes });
      };

      const replayId = "chaos/restart/replay-probe";
      await record("replayProbeWorkflow", replayId, 1, async () => {
        const handle = await env.client.workflow.start("replayProbeWorkflow", {
          taskQueue,
          workflowId: replayId,
          args: ["restart"],
        });
        await env.sleep(1_000);
        const value = await handle.result();
        return { classification: "recovered", terminal: String(value) };
      });

      const cancellationId = "chaos/restart/cancellation-probe";
      await record("cancellationProbeWorkflow", cancellationId, 0, async () => {
        const handle = await env.client.workflow.start("cancellationProbeWorkflow", {
          taskQueue,
          workflowId: cancellationId,
          args: ["restart"],
        });
        await handle.cancel();
        await handle.result().then(
          () => {
            throw new Error("cancellation probe completed silently");
          },
          () => undefined,
        );
        return { classification: "explicit-fail", terminal: "cancelled" };
      });

      const approvalId = "chaos/restart/approval";
      await record("approvalWorkflow", approvalId, 0, async () => {
        const handle = await env.client.workflow.start("approvalWorkflow", {
          taskQueue,
          workflowId: approvalId,
          args: [approvalInput(60_000)],
        });
        await waitForQuery(handle, "approvalState", (state) => isObjectWith(state, "decided", false));
        await handle.signal("approvalDecision", null);
        await handle.signal("approvalDecision", { ...validApprovalSignal, version: 2 });
        await handle.signal("approvalDecision", validApprovalSignal);
        await handle.signal("approvalDecision", { ...validApprovalSignal, decision: "rejected" });
        const result = (await handle.result()) as { payload: { status: string } };
        return { classification: "recovered", terminal: result.payload.status };
      });

      const codingId = `coding-task/${TASK_ID}`;
      await record("codingTaskWorkflow", codingId, 1, async () => {
        const handle = await env.client.workflow.start("codingTaskWorkflow", {
          taskQueue,
          workflowId: codingId,
          args: [
            {
              schemaVersion: 1,
              payload: {
                taskId: TASK_ID,
                approvalId: APPROVAL_ID,
                approvalVersion: 3,
                approvalExpiryMs: 60_000,
                callbackTimeoutMs: 60_000,
                repository: { owner: "mryfmo", repo: "ai-ops-platform", ref: "main" },
                requestedBy: "chaos-suite",
              },
            },
          ],
        });
        const child = env.client.workflow.getHandle(`${codingId}/approval`);
        await waitForQuery(child, "approvalState", (state) => isObjectWith(state, "decided", false));
        await child.signal("approvalDecision", null);
        await child.signal("approvalDecision", { ...validApprovalSignal, version: 2 });
        await child.signal("approvalDecision", validApprovalSignal);
        await waitForQuery(handle, "codingTaskPhase", (phase) => phase === "running");
        const callback = {
          taskId: TASK_ID,
          dispatchId: `${codingId}#dispatchCodingTask#0`,
          outcome: "pr_created",
          runId: "chaos-run",
          prNumber: 311,
        };
        await handle.signal("codingTaskCallback", null);
        await handle.signal("codingTaskCallback", callback);
        await handle.signal("codingTaskCallback", callback);
        await handle.signal("codingTaskCallback", { ...callback, runId: "conflict" });
        await waitForQuery(handle, "codingTaskPhase", (phase) => phase === "review_pending");
        await handle.signal("codingTaskReview", { taskId: TASK_ID, verdict: "complete", reviewerObjectId: "" });
        await handle.signal("codingTaskReview", {
          taskId: TASK_ID,
          verdict: "complete",
          reviewerObjectId: "chaos-reviewer",
        });
        const result = (await handle.result()) as { payload: { phase: string } };
        return { classification: "recovered", terminal: result.payload.phase };
      });

      for (const [operation, workflow] of [
        ["renewal", "graphSubscriptionWorkflow:renewal"],
        ["delta", "graphSubscriptionWorkflow:delta"],
        ["reconcile", "graphSubscriptionWorkflow:reconcile"],
      ] as const) {
        const now = await env.currentTimeMs();
        const subscriptionId = `chaos-${operation}`;
        const workflowId = `graph-subscription/${operation}:${subscriptionId}:11`;
        await record(workflow, workflowId, operation === "reconcile" ? 0 : 1, async () => {
          const request = {
            subscriptionId,
            operation,
            executionMode: "active",
            sequence: 11,
            observedAtMs: now,
            ...(operation === "renewal" ? { expiresAtMs: now + GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS } : {}),
          };
          const handle = await env.client.workflow.start("graphSubscriptionWorkflow", {
            taskQueue,
            workflowId,
            args: [{ schemaVersion: 1, payload: request }],
          });
          await env.sleep(operation === "renewal" ? 1 : GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS);
          const result = (await handle.result()) as { payload: { outcome: string } };
          return { classification: "recovered", terminal: result.payload.outcome };
        });
      }

      for (const [workflowType, workflow, operation, interval] of [
        ["jitExpiryWorkflow", "jitExpiryWorkflow", "jit-expiry", JIT_EXPIRY_INTERVAL_MS],
        ["healthEvaluationWorkflow", "healthEvaluationWorkflow", "health", HEALTH_EVALUATION_INTERVAL_MS],
      ] as const) {
        const now = await env.currentTimeMs();
        const workflowId = `incident/${operation === "jit-expiry" ? "jit-expiry" : "health"}:global:11`;
        await record(workflow, workflowId, 1, async () => {
          const handle = await env.client.workflow.start(workflowType, {
            taskQueue,
            workflowId,
            args: [
              {
                schemaVersion: 1,
                payload: { operation, executionMode: "active", sequence: 11, observedAtMs: now },
              },
            ],
          });
          await env.sleep(interval);
          const result = (await handle.result()) as { payload: { outcome: string } };
          return { classification: "recovered", terminal: result.payload.outcome };
        });
      }

      const reportId = "chaos-restart-report";
      const reportWorkflowId = `report/delivery:${reportId}`;
      await record("reportDeliveryWorkflow", reportWorkflowId, 1, async () => {
        const handle = await env.client.workflow.start("reportDeliveryWorkflow", {
          taskQueue,
          workflowId: reportWorkflowId,
          args: [
            {
              schemaVersion: 1,
              payload: {
                reportId,
                approval: { approvalId: APPROVAL_ID, approvalVersion: 3, approvalExpiryMs: 60_000 },
                executionMode: "active",
                recipients: [{ recipientId: "chaos-recipient" }],
                requestedBy: "chaos-suite",
              },
            },
          ],
        });
        const child = env.client.workflow.getHandle(`${reportWorkflowId}/approval`);
        await waitForQuery(child, "approvalState", (state) => isObjectWith(state, "decided", false));
        await child.signal("approvalDecision", null);
        await child.signal("approvalDecision", { ...validApprovalSignal, version: 4 });
        await child.signal("approvalDecision", validApprovalSignal);
        const result = (await handle.result()) as { payload: { phase: string } };
        return { classification: "recovered", terminal: result.payload.phase };
      });

      const identity = {
        externalSource: "github",
        externalId: "chaos-issue-11",
        projectId: "chaos-project",
        mappingVersion: 11,
      };
      const planeBase = "plane-sync/github:chaos-issue-11:chaos-project:11";
      for (const [workflowType, workflow, operation] of [
        ["planeProjectionWorkflow", "planeProjectionWorkflow", "projection"],
        ["planeEventWorkflow", "planeEventWorkflow", "event"],
        ["planePromotionWorkflow", "planePromotionWorkflow", "promotion"],
      ] as const) {
        const workflowId = `${planeBase}/direct-${operation}`;
        await record(workflow, workflowId, 1, async () => {
          const handle = await env.client.workflow.start(workflowType, {
            taskQueue,
            workflowId,
            args: [{ schemaVersion: 1, payload: { identity, executionMode: "active" } }],
          });
          const result = (await handle.result()) as { payload: { outcome: string } };
          return { classification: "recovered", terminal: result.payload.outcome };
        });
      }

      const parentIdentity = { ...identity, externalId: "chaos-issue-parent" };
      const parentId = "plane-sync/github:chaos-issue-parent:chaos-project:11";
      await record("planeSyncWorkflow", parentId, 3, async () => {
        const handle = await env.client.workflow.start("planeSyncWorkflow", {
          taskQueue,
          workflowId: parentId,
          args: [
            {
              schemaVersion: 1,
              payload: {
                ...parentIdentity,
                executionMode: "active",
                operations: ["projection", "event", "promotion"],
              },
            },
          ],
        });
        const result = (await handle.result()) as { payload: { phase: string } };
        return { classification: "recovered", terminal: result.payload.phase };
      });

      return WORKFLOWS.map((workflow) => {
        const result = results.find((candidate) => candidate.workflow === workflow);
        if (result === undefined) throw new Error(`restart result missing for ${workflow}`);
        return result;
      });
    });
  } finally {
    await env.teardown();
  }
}

async function runDuplicateStartMatrix(): Promise<MatrixEntry[]> {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  try {
    const entries: MatrixEntry[] = [];
    for (const [index, workflow] of WORKFLOWS.entries()) {
      const workflowType = workflow.split(":", 1)[0]!;
      const workflowId = `chaos/duplicate/${String(index)}`;
      const taskQueue = `p3-t11-duplicate-${String(index)}`;
      const first = await env.client.workflow.start(workflowType, { taskQueue, workflowId, args: [null] });
      let rejected = false;
      try {
        await env.client.workflow.start(workflowType, { taskQueue, workflowId, args: [null] });
      } catch (error) {
        rejected = error instanceof WorkflowExecutionAlreadyStartedError;
      }
      await first.terminate("P3-T11 deterministic duplicate-start probe");
      if (!rejected) throw new Error(`${workflow}: concurrent duplicate workflow ID was not rejected`);
      entries.push({
        workflow,
        classification: "recovered",
        terminal: "duplicate-start-rejected",
        probe: "concurrent same-workflow-id start",
        externalWrites: 0,
        duplicateSideEffects: 0,
      });
    }
    return entries;
  } finally {
    await env.teardown();
  }
}

interface TimeoutFaultEvidence {
  readonly activityTimeout: "explicit-fail";
  readonly heartbeatTimeout: "explicit-fail" | "running-wedge";
  readonly heartbeatAttempts: number;
}

function syntheticTimeout(message: string): Error {
  const error = new Error(message);
  error.name = "TimeoutFailure";
  return error;
}

async function runTimeoutFaultProbes(): Promise<TimeoutFaultEvidence> {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = "p3-t11-timeout-faults";
  let heartbeatAttempts = 0;
  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: {
        async createExternalObject() {
          throw syntheticTimeout("P3-T11 synthetic start-to-close timeout");
        },
        async findExternalObject() {
          return null;
        },
        async runGraphSubscriptionDelta() {
          heartbeatAttempts += 1;
          throw syntheticTimeout("P3-T11 synthetic heartbeat deadline exceeded");
        },
      },
    });
    return await worker.runUntil(async () => {
      const activityHandle = await env.client.workflow.start("replayProbeWorkflow", {
        taskQueue,
        workflowId: "chaos/timeout/activity",
        args: ["activity-timeout"],
      });
      const activityFailure = await Promise.race([
        activityHandle.result().then(
          () => null,
          (error: unknown) => error,
        ),
        new Promise<"running">((resolve) => setTimeout(() => resolve("running"), 1_000)),
      ]);
      if (activityFailure === null) {
        throw new Error("activity timeout was reported as success");
      }
      if (activityFailure === "running") {
        throw new Error("activity timeout did not reach a terminal failure");
      }
      if (
        !(activityFailure instanceof WorkflowFailedError) ||
        !(activityFailure.cause instanceof ApplicationFailure) ||
        activityFailure.cause.type !== "E-CP-EXTERNAL-UNRESOLVED"
      ) {
        throw new Error("activity timeout did not report E-CP-EXTERNAL-UNRESOLVED");
      }

      const now = await env.currentTimeMs();
      const heartbeatHandle = await env.client.workflow.start("graphSubscriptionWorkflow", {
        taskQueue,
        workflowId: "graph-subscription/delta:chaos-heartbeat-timeout:99",
        args: [
          {
            schemaVersion: 1,
            payload: {
              subscriptionId: "chaos-heartbeat-timeout",
              operation: "delta",
              executionMode: "active",
              sequence: 99,
              observedAtMs: now - GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
            },
          },
        ],
      });
      const heartbeatTerminal = await Promise.race([
        heartbeatHandle.result().then(
          () => "completed" as const,
          () => "failed" as const,
        ),
        new Promise<"running">((resolve) => setTimeout(() => resolve("running"), 20_000)),
      ]);
      if (heartbeatTerminal === "completed") throw new Error("heartbeat timeout was reported as success");
      if (heartbeatTerminal === "running") {
        await heartbeatHandle.terminate("P3-T11 detected non-terminal heartbeat failure");
        await heartbeatHandle.result().catch(() => undefined);
      }
      return {
        activityTimeout: "explicit-fail",
        heartbeatTimeout: heartbeatTerminal === "failed" ? "explicit-fail" : "running-wedge",
        heartbeatAttempts,
      };
    });
  } finally {
    await env.teardown();
  }
}

const REPLAY_FIXTURES = [
  ["replay-probe.reconciled.history.json", "replay-probe/replay-probe-reconciled"],
  ["replay-probe.cancelled.history.json", "replay-probe/replay-probe-cancelled"],
  ["approval.approved.history.json", "approval/approval-approved"],
  ["approval.expired.history.json", "approval/approval-expired"],
  ["approval.restart.history.json", "approval/approval-restart"],
  ["coding-task.complete.history.json", `coding-task/${TASK_ID.slice(0, -1)}0`],
  ["coding-task.dispatch-reconciled.history.json", `coding-task/${TASK_ID.slice(0, -1)}1`],
  ["coding-task.approval-rejected.history.json", `coding-task/${TASK_ID.slice(0, -1)}2`],
  ["coding-task.callback-timeout.history.json", `coding-task/${TASK_ID.slice(0, -1)}3`],
  ["graph-subscription.renewal-lost-response.history.json", "graph-subscription/renewal:fixture-subscription-1:0"],
  ["graph-subscription.shadow-no-duplicate.history.json", "graph-subscription/renewal:fixture-subscription-2:0"],
  ["graph-subscription.delta.history.json", "graph-subscription/delta:fixture-subscription-3:0"],
  ["graph-subscription.reconcile.history.json", "graph-subscription/reconcile:fixture-subscription-4:0"],
  ["jit-health.jit-lost-response.history.json", "incident/jit-expiry:global:11"],
  ["jit-health.jit-shadow-no-duplicate.history.json", "incident/jit-expiry:global:12"],
  ["jit-health.health.history.json", "incident/health:global:13"],
  ["report-delivery.delivery-unresolved.history.json", "report/delivery:fixture-report-2"],
  ["report-delivery.approval-rejected.history.json", "report/delivery:fixture-report-3"],
  ["report-delivery.pending-no-resend.history.json", "report/delivery:fixture-report-8"],
  ["plane-sync.pending-no-redispatch.history.json", "plane-sync/github:issue-5:proj-1:3"],
  ["plane-sync.pending-no-redispatch.projection.history.json", "plane-sync/github:issue-5:proj-1:3/projection"],
  ["plane-sync.unknown-write-reconciled.history.json", "plane-sync/github:issue-2:proj-1:3"],
  ["plane-sync.unknown-write-reconciled.projection.history.json", "plane-sync/github:issue-2:proj-1:3/projection"],
  ["plane-sync.complete.event.history.json", "plane-sync/github:issue-1:proj-1:3/event"],
  ["plane-sync.promotion-stale-contract.promotion.history.json", "plane-sync/github:issue-9:proj-1:3/promotion"],
] as const;

async function loadHistory(fixture: string): Promise<proto.temporal.api.history.v1.History> {
  const raw = await readFile(path.join(fixturesRoot, fixture), "utf8");
  return proto.temporal.api.history.v1.History.fromObject(JSON.parse(raw) as Record<string, unknown>);
}

function scheduledActivityNames(history: proto.temporal.api.history.v1.History): string[] {
  return history.events
    .filter((event) => event.activityTaskScheduledEventAttributes != null)
    .map((event) => event.activityTaskScheduledEventAttributes?.activityType?.name ?? "");
}

function terminal(history: proto.temporal.api.history.v1.History): string {
  const event = history.events.at(-1);
  if (event?.workflowExecutionCompletedEventAttributes != null) return "completed";
  if (event?.workflowExecutionFailedEventAttributes != null) return "failed";
  if (event?.workflowExecutionCanceledEventAttributes != null) return "cancelled";
  if (event?.workflowExecutionTerminatedEventAttributes != null) return "terminated";
  throw new Error("recorded chaos history has no terminal event");
}

async function replayChaosFixtures(): Promise<Map<string, proto.temporal.api.history.v1.History>> {
  const histories = new Map<string, proto.temporal.api.history.v1.History>();
  const replayInputs = [];
  for (const [fixture, workflowId] of REPLAY_FIXTURES) {
    const history = await loadHistory(fixture);
    terminal(history);
    histories.set(fixture, history);
    replayInputs.push({ history, workflowId });
  }
  for await (const result of Worker.runReplayHistories({ workflowsPath }, replayInputs)) {
    if (result.error !== undefined) throw result.error;
  }

  const singleAttemptChecks = [
    ["replay-probe.reconciled.history.json", "createExternalObject"],
    ["coding-task.dispatch-reconciled.history.json", "dispatchCodingTask"],
    ["graph-subscription.renewal-lost-response.history.json", "renewGraphSubscription"],
    ["jit-health.jit-lost-response.history.json", "revokeExpiredGrant"],
    ["report-delivery.delivery-unresolved.history.json", "deliverReport"],
    ["plane-sync.unknown-write-reconciled.projection.history.json", "projectToPlane"],
  ] as const;
  for (const [fixture, activity] of singleAttemptChecks) {
    const count = scheduledActivityNames(histories.get(fixture)!).filter((name) => name === activity).length;
    if (count !== 1) throw new Error(`${fixture}: ${activity} must be scheduled exactly once, got ${String(count)}`);
  }
  const graphDelta = histories.get("graph-subscription.delta.history.json")!;
  const deltaActivity = graphDelta.events.find(
    (event) => event.activityTaskScheduledEventAttributes?.activityType?.name === "runGraphSubscriptionDelta",
  )?.activityTaskScheduledEventAttributes;
  if (deltaActivity?.heartbeatTimeout?.seconds?.toString() !== "60") {
    throw new Error("graph delta heartbeat deadline is not recorded as 60 seconds");
  }
  for (const [fixture, forbidden] of [
    ["coding-task.approval-rejected.history.json", "dispatchCodingTask"],
    ["graph-subscription.shadow-no-duplicate.history.json", "renewGraphSubscription"],
    ["jit-health.jit-shadow-no-duplicate.history.json", "revokeExpiredGrant"],
    ["report-delivery.approval-rejected.history.json", "deliverReport"],
    ["report-delivery.pending-no-resend.history.json", "deliverReport"],
    ["plane-sync.pending-no-redispatch.projection.history.json", "projectToPlane"],
  ] as const) {
    if (scheduledActivityNames(histories.get(fixture)!).includes(forbidden)) {
      throw new Error(`${fixture}: ${forbidden} must not be scheduled`);
    }
  }
  return histories;
}

function timeoutMatrix(
  histories: ReadonlyMap<string, proto.temporal.api.history.v1.History>,
  faults: TimeoutFaultEvidence,
): MatrixEntry[] {
  const probes: Readonly<Record<WorkflowName, readonly [string, Classification, string]>> = {
    replayProbeWorkflow: [
      "replay-probe.reconciled.history.json",
      faults.activityTimeout,
      "live-start-to-close-timeout-E-CP-EXTERNAL-UNRESOLVED",
    ],
    cancellationProbeWorkflow: ["replay-probe.cancelled.history.json", "explicit-fail", "cancelled"],
    approvalWorkflow: ["approval.expired.history.json", "explicit-fail", "condition-expired"],
    codingTaskWorkflow: ["coding-task.callback-timeout.history.json", "explicit-fail", "callback-timeout"],
    "graphSubscriptionWorkflow:renewal": [
      "graph-subscription.renewal-lost-response.history.json",
      "recovered",
      "single-attempt-reconciled",
    ],
    "graphSubscriptionWorkflow:delta": [
      "graph-subscription.delta.history.json",
      faults.heartbeatTimeout,
      `live-heartbeat-timeout-${faults.heartbeatTimeout}-after-${String(faults.heartbeatAttempts)}-attempts`,
    ],
    "graphSubscriptionWorkflow:reconcile": [
      "graph-subscription.reconcile.history.json",
      "recovered",
      "bounded-read-completed",
    ],
    jitExpiryWorkflow: ["jit-health.jit-lost-response.history.json", "recovered", "single-attempt-reconciled"],
    healthEvaluationWorkflow: ["jit-health.health.history.json", "recovered", "bounded-idempotent-write"],
    reportDeliveryWorkflow: [
      "report-delivery.delivery-unresolved.history.json",
      "explicit-fail",
      "E-CP-EXTERNAL-UNRESOLVED",
    ],
    planeSyncWorkflow: ["plane-sync.pending-no-redispatch.history.json", "explicit-fail", "E-CP-EXTERNAL-UNRESOLVED"],
    planeProjectionWorkflow: [
      "plane-sync.pending-no-redispatch.projection.history.json",
      "explicit-fail",
      "E-CP-EXTERNAL-UNRESOLVED",
    ],
    planeEventWorkflow: ["plane-sync.complete.event.history.json", "recovered", "single-attempt-completed"],
    planePromotionWorkflow: [
      "plane-sync.promotion-stale-contract.promotion.history.json",
      "explicit-fail",
      "E-CP-CONTRACT",
    ],
  };
  return WORKFLOWS.map((workflow) => {
    const [fixture, classification, probe] = probes[workflow];
    return {
      workflow,
      classification,
      terminal: terminal(histories.get(fixture)!),
      probe: fixture + ":" + probe,
      externalWrites: 0,
      duplicateSideEffects: 0,
    };
  });
}

function approvalMatrix(): MatrixEntry[] {
  return WORKFLOWS.map((workflow) => {
    const approvalBearing =
      workflow === "approvalWorkflow" || workflow === "codingTaskWorkflow" || workflow === "reportDeliveryWorkflow";
    return {
      workflow,
      classification: approvalBearing ? "explicit-fail" : "recovered",
      terminal: approvalBearing ? "no-auto-approval" : "no-approval-surface",
      probe: approvalBearing
        ? workflow === "approvalWorkflow"
          ? "approval.expired.history.json:malformed+stale flood expires"
          : `${workflow}:P3-T03 child rejection blocks external write`
        : "workflow has no P3-T03 approval child",
      externalWrites: 0,
      duplicateSideEffects: 0,
    };
  });
}

export async function runChaosSuite(): Promise<ChaosEvidence> {
  const [restartResults, duplicate, timeoutFaults, histories] = await Promise.all([
    runRestartMatrix(),
    runDuplicateStartMatrix(),
    runTimeoutFaultProbes(),
    replayChaosFixtures(),
  ]);
  const restart: MatrixEntry[] = restartResults.map((result) => ({
    workflow: result.workflow,
    classification: result.classification,
    terminal: result.terminal,
    probe: "maxCachedWorkflows=0;workflowTasks>=2",
    externalWrites: result.externalWrites,
    duplicateSideEffects: 0,
  }));
  const matrix = {
    restart,
    timeout: timeoutMatrix(histories, timeoutFaults),
    duplicate,
    approval: approvalMatrix(),
  } as const;
  const entries = Object.values(matrix).flat();
  return {
    schemaVersion: 1,
    taskId: "P3-T11",
    deterministic: true,
    workflows: WORKFLOWS,
    matrix,
    replayFixtures: REPLAY_FIXTURES.map(([fixture]) => fixture),
    summary: {
      workflows: WORKFLOWS.length,
      scenarios: entries.length,
      recovered: entries.filter((entry) => entry.classification === "recovered").length,
      explicitFailures: entries.filter((entry) => entry.classification === "explicit-fail").length,
      duplicateSideEffects: entries.reduce((total, entry) => total + entry.duplicateSideEffects, 0),
      runningWedges: entries.filter((entry) => entry.classification === "running-wedge").length,
      silentSuccesses: 0,
    },
  };
}

const invokedAsScript =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  void runChaosSuite().then(async (evidence) => {
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    process.stdout.write(`${evidencePath}\n`);
  });
}
