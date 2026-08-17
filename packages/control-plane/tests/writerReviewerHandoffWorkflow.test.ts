/** 根拠: FinalArch:COD-001 / FinalArch:COD-002 / ADR-0020 / ADR-0027 / WBS P8-T07 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertWriterReviewerHandoffReceipt,
  parseWriterReviewerHandoffRequest,
  writerReviewerHandoffCommandSignal,
  writerReviewerHandoffStateQuery,
} from "../src/workflows/writerReviewerHandoff.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(packageRoot, "src", "workflows", "entry.ts");
const SHA = { base: "1".repeat(40), first: "2".repeat(40) };
type Environment = Awaited<ReturnType<typeof TestWorkflowEnvironment.createTimeSkipping>>;
let env: Environment;

describe("writer-reviewer workflow boundary [FinalArch:COD-001 / FinalArch:COD-002]", () => {
  it("validates the complete request envelope and exact CAS receipt outside the workflow sandbox", () => {
    const parsed = parseWriterReviewerHandoffRequest(request("P8-T07-WORKFLOW-C"));
    expect(parsed.traceId).toBe("11111111-1111-4111-8111-111111111111");
    expect(
      assertWriterReviewerHandoffReceipt({ schemaVersion: 1, payload: parsed.assignment.next }, parsed.assignment.next),
    ).toEqual(parsed.assignment.next);
  });

  it.each([
    null,
    { schemaVersion: 2, payload: request("P8-T07-WORKFLOW-D").payload },
    { schemaVersion: 1, payload: { ...request("P8-T07-WORKFLOW-D").payload, traceId: "not-a-uuid" } },
    { schemaVersion: 1, payload: { ...request("P8-T07-WORKFLOW-D").payload, extra: true } },
  ])("rejects malformed request envelope %#", (input) => {
    expect(() => parseWriterReviewerHandoffRequest(input)).toThrow();
  });

  it("rejects malformed or mismatched persistence receipts", () => {
    const expected = parseWriterReviewerHandoffRequest(request("P8-T07-WORKFLOW-E")).assignment.next;
    expect(() => assertWriterReviewerHandoffReceipt({ schemaVersion: 2, payload: expected }, expected)).toThrow(
      /E-HANDOFF-CAS/u,
    );
    expect(() =>
      assertWriterReviewerHandoffReceipt({ schemaVersion: 1, payload: { ...expected, version: 2 } }, expected),
    ).toThrow(/E-HANDOFF-CAS/u);
  });
});

describe("writer-reviewer Temporal handoff [FinalArch:COD-001 / FinalArch:COD-002]", () => {
  beforeEach(async () => {
    env = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterEach(async () => {
    if (env !== undefined) await env.teardown();
  });

  it("persists each validated transition through the injected CAS activity before advancing", async () => {
    const persisted: string[] = [];
    const taskQueue = "p8-t07-handoff-happy";
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: {
        async claimWriterReviewerHandoff(input: { payload: { next: unknown } }) {
          persisted.push("writer_assigned");
          return { schemaVersion: 1, payload: input.payload.next };
        },
        async applyWriterReviewerHandoffTransition(input: { payload: { next: { state: string } } }) {
          persisted.push(input.payload.next.state);
          return { schemaVersion: 1, payload: input.payload.next };
        },
      },
    });

    const result = await worker.runUntil(async () => {
      const handle = await env.client.workflow.start("writerReviewerHandoffWorkflow", {
        taskQueue,
        workflowId: "coding/P8-T07-handoff-happy",
        args: [request("P8-T07-WORKFLOW-A")],
      });
      await waitForState(handle, "writer_assigned");

      await handle.signal(writerReviewerHandoffCommandSignal, {
        kind: "submit_for_review",
        actor: "codex-deep-dot",
        expectedVersion: 1,
        range: { baseSha: SHA.base, headSha: SHA.first },
      });
      await waitForRejected(handle, 1);

      await handle.signal(writerReviewerHandoffCommandSignal, command("start_work", 1, SHA.base));
      await waitForState(handle, "in_progress");
      await handle.signal(writerReviewerHandoffCommandSignal, command("submit_for_review", 2, SHA.first));
      await waitForState(handle, "ready_for_review");
      await handle.signal(writerReviewerHandoffCommandSignal, {
        kind: "approve",
        actor: "claude-deep-dot",
        expectedVersion: 3,
        range: { baseSha: SHA.base, headSha: SHA.first },
      });
      return handle.result();
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      payload: { state: { state: "approved", version: 4 }, rejectedCommands: 1 },
    });
    expect(persisted).toEqual(["writer_assigned", "in_progress", "ready_for_review", "approved"]);
  });

  it("fails closed when an activity receipt differs from the proposed exact state", async () => {
    const taskQueue = "p8-t07-handoff-stale";
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: {
        async claimWriterReviewerHandoff(input: { payload: { next: unknown } }) {
          return { schemaVersion: 1, payload: input.payload.next };
        },
        async applyWriterReviewerHandoffTransition(input: { payload: { next: Record<string, unknown> } }) {
          return { schemaVersion: 1, payload: { ...input.payload.next, version: 99 } };
        },
      },
    });

    let failure: unknown;
    try {
      await worker.runUntil(async () => {
        const handle = await env.client.workflow.start("writerReviewerHandoffWorkflow", {
          taskQueue,
          workflowId: "coding/P8-T07-handoff-stale",
          args: [request("P8-T07-WORKFLOW-B")],
        });
        await waitForState(handle, "writer_assigned");
        await handle.signal(writerReviewerHandoffCommandSignal, command("start_work", 1, SHA.base));
        return handle.result();
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error & { cause?: Error }).cause?.message).toMatch(/E-HANDOFF-CAS/u);
  });
});

function request(taskId: string) {
  return {
    schemaVersion: 1,
    payload: {
      taskId,
      writer: "codex-deep-dot",
      reviewer: "claude-deep-dot",
      actor: "codex-deep-dot",
      range: { baseSha: SHA.base, headSha: SHA.base },
      traceId: "11111111-1111-4111-8111-111111111111",
    },
  };
}

function command(kind: "start_work" | "submit_for_review", expectedVersion: number, headSha: string) {
  return {
    kind,
    actor: "codex-deep-dot",
    expectedVersion,
    range: { baseSha: SHA.base, headSha },
  };
}

async function waitForState(handle: { query(query: unknown): Promise<unknown> }, state: string): Promise<void> {
  for (;;) {
    const result = (await handle.query(writerReviewerHandoffStateQuery)) as { state: { state: string } };
    if (result.state.state === state) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function waitForRejected(handle: { query(query: unknown): Promise<unknown> }, count: number): Promise<void> {
  for (;;) {
    const result = (await handle.query(writerReviewerHandoffStateQuery)) as { rejectedCommands: number };
    if (result.rejectedCommands === count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
