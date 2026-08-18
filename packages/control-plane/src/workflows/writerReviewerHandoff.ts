/** 根拠: FinalArch:COD-001 / FinalArch:COD-002 / ADR-0020 / ADR-0027 / WBS P8-T07 */
import {
  ApplicationFailure,
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import {
  applyWriterReviewerTransition,
  assertWriterReviewerHandoff,
  createWriterAssignment,
  type WriterReviewerHandoff,
  type WriterReviewerTransitionRecord,
} from "./writerReviewerHandoffState.js";

export interface WriterReviewerHandoffRequest {
  readonly taskId: string;
  readonly writer: string;
  readonly reviewer: string;
  readonly actor: string;
  readonly range: { readonly baseSha: string; readonly headSha: string };
  readonly traceId: string;
}

export interface WriterReviewerHandoffMutation {
  readonly current: WriterReviewerHandoff | null;
  readonly next: WriterReviewerHandoff;
  readonly record: WriterReviewerTransitionRecord;
  readonly traceId: string;
}

export interface WriterReviewerHandoffActivities {
  claimWriterReviewerHandoff(input: VersionedPayload<WriterReviewerHandoffMutation>): Promise<unknown>;
  applyWriterReviewerHandoffTransition(input: VersionedPayload<WriterReviewerHandoffMutation>): Promise<unknown>;
}

export interface WriterReviewerHandoffResult {
  readonly state: WriterReviewerHandoff;
  readonly rejectedCommands: number;
}

export interface WriterReviewerHandoffQuery {
  readonly state: WriterReviewerHandoff;
  readonly rejectedCommands: number;
}

export const writerReviewerHandoffCommandSignal = defineSignal<[unknown]>("writerReviewerHandoffCommand");
export const writerReviewerHandoffStateQuery = defineQuery<WriterReviewerHandoffQuery>("writerReviewerHandoffState");

const writes = proxyActivities<WriterReviewerHandoffActivities>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("idempotent-write"),
});

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return contractFailure(`invalid ${label}`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (Object.keys(value).length !== expected.length || Object.keys(value).some((key) => !expected.includes(key))) {
    contractFailure(`invalid ${label} fields`);
  }
}

function contractFailure(message: string): never {
  throw ApplicationFailure.nonRetryable(message, "E-HANDOFF-CONTRACT");
}

function casFailure(message: string): never {
  throw ApplicationFailure.nonRetryable(`E-HANDOFF-CAS: ${message}`, "E-HANDOFF-CAS");
}

export function parseWriterReviewerHandoffRequest(value: unknown): {
  assignment: ReturnType<typeof createWriterAssignment>;
  traceId: string;
} {
  const envelope = record(value, "handoff envelope");
  exactKeys(envelope, ["schemaVersion", "payload"], "handoff envelope");
  if (envelope["schemaVersion"] !== 1) return contractFailure("invalid handoff schema version");
  const payload = record(envelope["payload"], "handoff request");
  exactKeys(payload, ["taskId", "writer", "reviewer", "actor", "range", "traceId"], "handoff request");
  const traceId = payload["traceId"];
  if (
    typeof traceId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(traceId)
  ) {
    return contractFailure("invalid handoff trace id");
  }
  try {
    return {
      assignment: createWriterAssignment({
        taskId: payload["taskId"],
        writer: payload["writer"],
        reviewer: payload["reviewer"],
        actor: payload["actor"],
        range: payload["range"],
      }),
      traceId,
    };
  } catch (error) {
    return contractFailure(error instanceof Error ? error.message : "invalid writer assignment");
  }
}

export function assertWriterReviewerHandoffReceipt(
  value: unknown,
  expected: WriterReviewerHandoff,
): WriterReviewerHandoff {
  const envelope = record(value, "handoff activity receipt");
  exactKeys(envelope, ["schemaVersion", "payload"], "handoff activity receipt");
  if (envelope["schemaVersion"] !== 1) return casFailure("invalid receipt schema version");
  let actual: WriterReviewerHandoff;
  try {
    actual = assertWriterReviewerHandoff(envelope["payload"]);
  } catch (error) {
    return casFailure(error instanceof Error ? error.message : "invalid receipt state");
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) return casFailure("receipt differs from proposed state");
  return actual;
}

/** signal は提案だけを enqueue し、pure validation と DB CAS receipt の後にのみ state を前進させる。 */
export async function writerReviewerHandoffWorkflow(
  input: unknown,
): Promise<VersionedPayload<WriterReviewerHandoffResult>> {
  const { assignment, traceId } = parseWriterReviewerHandoffRequest(input);
  let state = assignment.next;
  let rejectedCommands = 0;
  const commands: unknown[] = [];

  setHandler(writerReviewerHandoffCommandSignal, (command) => {
    commands.push(command);
  });
  setHandler(writerReviewerHandoffStateQuery, () => ({ state, rejectedCommands }));

  state = assertWriterReviewerHandoffReceipt(
    await writes.claimWriterReviewerHandoff({
      schemaVersion: 1,
      payload: { current: null, next: assignment.next, record: assignment.record, traceId },
    }),
    assignment.next,
  );

  while (state.state !== "approved") {
    await condition(() => commands.length > 0);
    const command = commands.shift();
    let proposed;
    try {
      proposed = applyWriterReviewerTransition(state, command);
    } catch {
      rejectedCommands += 1;
      continue;
    }
    state = assertWriterReviewerHandoffReceipt(
      await writes.applyWriterReviewerHandoffTransition({
        schemaVersion: 1,
        payload: { current: state, next: proposed.next, record: proposed.record, traceId },
      }),
      proposed.next,
    );
  }

  return { schemaVersion: 1, payload: { state, rejectedCommands } };
}
