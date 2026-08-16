// 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001 / ADR-0020
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deriveStatusIngestDecision } from "../src/lib/statusIngestState.js";
import { buildStatusIngestWorkflowId } from "../src/workflows/statusIngest.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");
const channels = ["email", "teams", "github"] as const;
type Channel = (typeof channels)[number];
type Environment = Awaited<ReturnType<typeof TestWorkflowEnvironment.createTimeSkipping>>;
let env: Environment;

beforeEach(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping();
});

afterEach(async () => {
  if (env !== undefined) await env.teardown();
});

function event(channel: Channel, complete: boolean, suffix: string) {
  return {
    channel,
    sourceMessageId: `${channel}-${suffix}`,
    threadId: `${channel}-thread-${suffix}`,
    receivedAt: "2026-08-16T06:00:00Z",
    reporterId: "ST-010",
    projectId: "PJ-001",
    subject: "PJ-001 weekly status",
    body: "sanitized fixture",
    update: {
      progress_pct: 50,
      self_status: "green" as const,
      achievements: "done",
      plans: "next",
      issues: "none",
      risks: complete ? "none" : null,
    },
  };
}

function harness(priorClarifyCount: number, duplicate = false) {
  const calls = { canonical: 0, notification: 0, complete: 0, audit: [] as string[] };
  const sideEffects = new Map<string, unknown>();
  return {
    calls,
    sideEffects,
    activities: {
      async readStatusIngestThread(input: { payload: { threadKey: string } }) {
        return { schemaVersion: 1, payload: { threadKey: input.payload.threadKey, clarifyCount: priorClarifyCount } };
      },
      async claimStatusIngest(input: {
        payload: { event: ReturnType<typeof event>; completeness: { complete: boolean; missingFields: string[] } };
      }) {
        const decision = deriveStatusIngestDecision(input.payload.event.update, priorClarifyCount);
        return {
          schemaVersion: 1,
          payload: {
            sourceKey: `status-ingest:${input.payload.event.channel}:${input.payload.event.sourceMessageId}`,
            threadKey: `status-ingest:${input.payload.event.channel}:${input.payload.event.threadId}`,
            duplicate,
            priorClarifyCount,
            clarifyCount: decision.action === "clarify" ? priorClarifyCount + 1 : priorClarifyCount,
            action: decision.action,
            state: duplicate ? "complete" : "pending",
            revision: 1,
          },
        };
      },
      async findStatusIngestSideEffect(_input: unknown, key: string) {
        return sideEffects.get(key) ?? null;
      },
      async persistCanonicalStatusUpdate(input: { payload: { sourceKey: string } }, key: string) {
        calls.canonical += 1;
        const receipt = {
          schemaVersion: 1,
          payload: { sourceKey: input.payload.sourceKey, idempotencyKey: key, effect: "canonical", reference: "SU-1" },
        };
        sideEffects.set(key, receipt);
        return receipt;
      },
      async sendStatusIngestNotification(input: { payload: { sourceKey: string; action: string } }, key: string) {
        calls.notification += 1;
        const receipt = {
          schemaVersion: 1,
          payload: {
            sourceKey: input.payload.sourceKey,
            idempotencyKey: key,
            effect: "notification",
            reference: `notify-${input.payload.action}`,
          },
        };
        sideEffects.set(key, receipt);
        return receipt;
      },
      async completeStatusIngest(input: { payload: { sourceKey: string; expectedRevision: number } }) {
        calls.complete += 1;
        return {
          schemaVersion: 1,
          payload: {
            sourceKey: input.payload.sourceKey,
            revision: input.payload.expectedRevision + 1,
            state: "complete",
          },
        };
      },
      async appendStatusIngestAudit(input: { payload: { sourceKey: string; code: string } }, key: string) {
        calls.audit.push(input.payload.code);
        const receipt = {
          schemaVersion: 1,
          payload: {
            sourceKey: input.payload.sourceKey,
            idempotencyKey: key,
            effect: "audit",
            reference: input.payload.code,
          },
        };
        sideEffects.set(key, receipt);
        return receipt;
      },
    },
  };
}

async function execute(
  channel: Channel,
  complete: boolean,
  suffix: string,
  activityHarness: ReturnType<typeof harness>,
) {
  const normalized = event(channel, complete, suffix);
  const taskQueue = `status-ingest-${channel}-${suffix}`;
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath,
    activities: activityHarness.activities,
  });
  return worker.runUntil(
    env.client.workflow.execute("statusIngestWorkflow", {
      taskQueue,
      workflowId: buildStatusIngestWorkflowId(normalized),
      args: [{ schemaVersion: 1, payload: { executionMode: "active", event: normalized } }],
    }),
  );
}

describe("FinalArch:ING-001 three-channel status ingest workflow", () => {
  it.each(channels)("%s accepts a complete update once and records every E-ING transition", async (channel) => {
    const h = harness(0);
    await expect(execute(channel, true, "accept", h)).resolves.toMatchObject({
      payload: { outcome: "accepted", action: "accept", clarifyCount: 0, duplicate: false },
    });
    expect(h.calls).toMatchObject({ canonical: 1, notification: 1, complete: 1 });
    expect(h.calls.audit).toEqual(["E-ING-RECEIVED", "E-ING-ACCEPTED"]);
  });

  it.each(channels)("%s preserves clarification parity at prior counts 0, 1, and 2", async (channel) => {
    for (const prior of [0, 1, 2]) {
      const h = harness(prior);
      await expect(execute(channel, false, `clarify-${prior}`, h)).resolves.toMatchObject({
        payload: { outcome: "clarified", action: "clarify", clarifyCount: prior + 1 },
      });
      expect(h.calls).toMatchObject({ canonical: 0, notification: 1, complete: 1 });
      expect(h.calls.audit).toEqual(["E-ING-RECEIVED", "E-ING-CLARIFIED"]);
    }
  });

  it.each(channels)("%s escalates only after three persisted clarifications", async (channel) => {
    const h = harness(3);
    await expect(execute(channel, false, "escalate", h)).resolves.toMatchObject({
      payload: { outcome: "escalated", action: "escalate_incomplete", clarifyCount: 3 },
    });
    expect(h.calls).toMatchObject({ canonical: 0, notification: 1, complete: 1 });
    expect(h.calls.audit).toEqual(["E-ING-RECEIVED", "E-ING-ESCALATED"]);
  });

  it.each(channels)("%s suppresses all ingestion effects for an already-complete source message", async (channel) => {
    const h = harness(0, true);
    await expect(execute(channel, true, "duplicate", h)).resolves.toMatchObject({
      payload: { outcome: "duplicate", duplicate: true },
    });
    expect(h.calls).toMatchObject({ canonical: 0, notification: 0, complete: 0 });
    expect(h.calls.audit).toEqual(["E-ING-RECEIVED", "E-ING-DUPLICATE"]);
  });

  it("shadow evaluates persistent count but structurally performs no write", async () => {
    const h = harness(2);
    const normalized = event("email", false, "shadow");
    const taskQueue = "status-ingest-shadow";
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: h.activities,
    });
    await expect(
      worker.runUntil(
        env.client.workflow.execute("statusIngestWorkflow", {
          taskQueue,
          workflowId: buildStatusIngestWorkflowId(normalized),
          args: [{ schemaVersion: 1, payload: { executionMode: "shadow", event: normalized } }],
        }),
      ),
    ).resolves.toMatchObject({ payload: { outcome: "shadowed", action: "clarify", clarifyCount: 2 } });
    expect(h.calls).toEqual({ canonical: 0, notification: 0, complete: 0, audit: [] });
  });

  it("reconciles a lost canonical response without writing the canonical update twice", async () => {
    const h = harness(0);
    let writes = 0;
    h.activities.persistCanonicalStatusUpdate = async (input, key) => {
      writes += 1;
      const receipt = {
        schemaVersion: 1,
        payload: {
          sourceKey: input.payload.sourceKey,
          idempotencyKey: key,
          effect: "canonical",
          reference: "SU-lost-response",
        },
      };
      h.sideEffects.set(key, receipt);
      throw new Error("synthetic response loss");
    };
    await expect(execute("email", true, "lost-response", h)).resolves.toMatchObject({
      payload: { outcome: "accepted" },
    });
    expect(writes).toBe(1);
  });
});
