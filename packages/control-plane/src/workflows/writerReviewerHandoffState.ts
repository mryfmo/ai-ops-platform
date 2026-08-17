/** 根拠: FinalArch:COD-001 / FinalArch:COD-002 / ADR-0027 / WBS P8-T07 */

export type WriterReviewerHandoffState =
  "writer_assigned" | "in_progress" | "ready_for_review" | "rework_requested" | "approved";

export interface CommitRange {
  readonly baseSha: string;
  readonly headSha: string;
}

export interface WriterReviewerHandoff {
  readonly taskId: string;
  readonly writer: string;
  readonly reviewer: string;
  readonly state: WriterReviewerHandoffState;
  readonly range: CommitRange;
  readonly reviewRange: CommitRange | null;
  readonly version: number;
}

export type WriterReviewerHandoffEvent =
  | "writer_assigned"
  | "start_work"
  | "submit_for_review"
  | "approve"
  | "request_rework"
  | "resume_rework"
  | "reviewer_takeover";

export interface WriterReviewerTransitionRecord {
  readonly event: WriterReviewerHandoffEvent;
  readonly fromState: WriterReviewerHandoffState | null;
  readonly toState: WriterReviewerHandoffState;
  readonly actor: string;
  readonly oldWriter: string | null;
  readonly newWriter: string | null;
  readonly reason: string | null;
  readonly range: CommitRange;
  readonly expectedVersion: number;
  readonly resultingVersion: number;
}

export interface WriterReviewerTransitionResult {
  readonly next: WriterReviewerHandoff;
  readonly record: WriterReviewerTransitionRecord;
}

const SHA = /^[a-f0-9]{40}$/u;
const TASK_ID = /^[A-Z][A-Z0-9._-]{1,127}$/u;
const AGENT_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const STATES = new Set<WriterReviewerHandoffState>([
  "writer_assigned",
  "in_progress",
  "ready_for_review",
  "rework_requested",
  "approved",
]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`invalid ${label}`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label} has unexpected field: ${key}`);
  }
}

function text(value: unknown, label: string, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) throw new TypeError(`invalid ${label}`);
  return value;
}

function reason(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 2_000 ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new TypeError("invalid handoff reason");
  }
  return value.trim();
}

function version(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new TypeError(`invalid ${label}`);
  return Number(value);
}

function range(value: unknown): CommitRange {
  const candidate = object(value, "commit range");
  exactKeys(candidate, ["baseSha", "headSha"], "commit range");
  return {
    baseSha: text(candidate["baseSha"], "base SHA", SHA),
    headSha: text(candidate["headSha"], "head SHA", SHA),
  };
}

function sameRange(left: CommitRange, right: CommitRange): boolean {
  return left.baseSha === right.baseSha && left.headSha === right.headSha;
}

function assertExactRange(actual: CommitRange, expected: CommitRange, label: string): void {
  if (!sameRange(actual, expected)) throw new TypeError(`${label} must match the exact review range`);
}

function snapshot(value: unknown): WriterReviewerHandoff {
  const candidate = object(value, "handoff state");
  exactKeys(candidate, ["taskId", "writer", "reviewer", "state", "range", "reviewRange", "version"], "handoff state");
  const state = candidate["state"];
  if (typeof state !== "string" || !STATES.has(state as WriterReviewerHandoffState)) {
    throw new TypeError("invalid handoff state");
  }
  const current: WriterReviewerHandoff = {
    taskId: text(candidate["taskId"], "task id", TASK_ID),
    writer: text(candidate["writer"], "writer", AGENT_ID),
    reviewer: text(candidate["reviewer"], "reviewer", AGENT_ID),
    state: state as WriterReviewerHandoffState,
    range: range(candidate["range"]),
    reviewRange: candidate["reviewRange"] === null ? null : range(candidate["reviewRange"]),
    version: version(candidate["version"], "handoff version"),
  };
  if (current.version < 1 || current.writer === current.reviewer) throw new TypeError("invalid one-writer state");
  const reviewRequired =
    current.state === "ready_for_review" || current.state === "rework_requested" || current.state === "approved";
  if (reviewRequired !== (current.reviewRange !== null)) throw new TypeError("invalid review range state");
  if (current.reviewRange !== null && !sameRange(current.range, current.reviewRange)) {
    throw new TypeError("current and review ranges differ");
  }
  return current;
}

export function createWriterAssignment(input: unknown): WriterReviewerTransitionResult {
  const candidate = object(input, "writer assignment");
  exactKeys(candidate, ["taskId", "writer", "reviewer", "actor", "range"], "writer assignment");
  const writer = text(candidate["writer"], "writer", AGENT_ID);
  const reviewer = text(candidate["reviewer"], "reviewer", AGENT_ID);
  const actor = text(candidate["actor"], "actor", AGENT_ID);
  const commitRange = range(candidate["range"]);
  if (writer === reviewer) throw new TypeError("writer and reviewer must differ");
  if (actor !== writer) throw new TypeError("only the assigned writer may claim the task");
  if (commitRange.baseSha !== commitRange.headSha) throw new TypeError("assignment must start at the pinned base head");

  const next: WriterReviewerHandoff = {
    taskId: text(candidate["taskId"], "task id", TASK_ID),
    writer,
    reviewer,
    state: "writer_assigned",
    range: commitRange,
    reviewRange: null,
    version: 1,
  };
  return {
    next,
    record: {
      event: "writer_assigned",
      fromState: null,
      toState: "writer_assigned",
      actor,
      oldWriter: null,
      newWriter: writer,
      reason: null,
      range: commitRange,
      expectedVersion: 0,
      resultingVersion: 1,
    },
  };
}

export function applyWriterReviewerTransition(
  currentValue: WriterReviewerHandoff,
  commandValue: unknown,
): WriterReviewerTransitionResult {
  const current = snapshot(currentValue);
  const command = object(commandValue, "handoff command");
  const kind = command["kind"];
  if (typeof kind !== "string") throw new TypeError("invalid handoff event");
  const takeover = kind === "reviewer_takeover";
  const hasReason = kind === "request_rework" || takeover;
  exactKeys(
    command,
    [
      "kind",
      "actor",
      "expectedVersion",
      "range",
      ...(hasReason ? ["reason"] : []),
      ...(takeover ? ["oldWriter", "newWriter"] : []),
    ],
    "handoff command",
  );
  const actor = text(command["actor"], "actor", AGENT_ID);
  const expectedVersion = version(command["expectedVersion"], "expected version");
  const commitRange = range(command["range"]);
  if (expectedVersion !== current.version) throw new TypeError("stale handoff version");

  let toState: WriterReviewerHandoffState;
  let writer = current.writer;
  let reviewer = current.reviewer;
  let reviewRange: CommitRange | null = current.reviewRange;
  let oldWriter: string | null = null;
  let newWriter: string | null = null;
  let transitionReason: string | null = null;

  switch (kind) {
    case "start_work":
      if (current.state !== "writer_assigned") throw new TypeError("illegal start_work transition");
      if (actor !== current.writer) throw new TypeError("only the writer may start work");
      assertExactRange(commitRange, current.range, "start_work range");
      toState = "in_progress";
      break;
    case "submit_for_review":
      if (current.state !== "in_progress") throw new TypeError("illegal submit_for_review transition");
      if (actor !== current.writer) throw new TypeError("only the writer may submit for review");
      if (commitRange.baseSha !== current.range.baseSha || commitRange.headSha === commitRange.baseSha) {
        throw new TypeError("review submission must pin a new head from the assigned base");
      }
      toState = "ready_for_review";
      reviewRange = commitRange;
      break;
    case "approve":
      if (current.state !== "ready_for_review" || current.reviewRange === null) {
        throw new TypeError("illegal approve transition");
      }
      if (actor !== current.reviewer) throw new TypeError("only the reviewer may approve");
      assertExactRange(commitRange, current.reviewRange, "approval range");
      toState = "approved";
      break;
    case "request_rework":
      if (current.state !== "ready_for_review" || current.reviewRange === null) {
        throw new TypeError("illegal request_rework transition");
      }
      if (actor !== current.reviewer) throw new TypeError("only the reviewer may request rework");
      assertExactRange(commitRange, current.reviewRange, "rework range");
      transitionReason = reason(command["reason"]);
      toState = "rework_requested";
      break;
    case "resume_rework":
      if (current.state !== "rework_requested") throw new TypeError("illegal resume_rework transition");
      if (actor !== current.writer) throw new TypeError("only the writer may resume rework");
      if (commitRange.baseSha !== current.range.headSha || commitRange.headSha !== current.range.headSha) {
        throw new TypeError("rework must restart from the reviewed head");
      }
      toState = "in_progress";
      reviewRange = null;
      break;
    case "reviewer_takeover": {
      if (current.state !== "ready_for_review" && current.state !== "rework_requested") {
        throw new TypeError("illegal reviewer_takeover transition");
      }
      if (actor !== current.reviewer) throw new TypeError("only the reviewer may take over");
      oldWriter = text(command["oldWriter"], "old writer", AGENT_ID);
      newWriter = text(command["newWriter"], "new writer", AGENT_ID);
      transitionReason = reason(command["reason"]);
      if (oldWriter !== current.writer || newWriter !== current.reviewer) {
        throw new TypeError("takeover roles do not match the current assignments");
      }
      if (commitRange.baseSha !== current.range.headSha || commitRange.headSha === commitRange.baseSha) {
        throw new TypeError("takeover must record a new commit range from the reviewed head");
      }
      writer = current.reviewer;
      reviewer = current.writer;
      toState = "in_progress";
      reviewRange = null;
      break;
    }
    default:
      throw new TypeError("invalid handoff event");
  }

  const next: WriterReviewerHandoff = {
    ...current,
    writer,
    reviewer,
    state: toState,
    range: commitRange,
    reviewRange,
    version: current.version + 1,
  };
  return {
    next,
    record: {
      event: kind,
      fromState: current.state,
      toState,
      actor,
      oldWriter,
      newWriter,
      reason: transitionReason,
      range: commitRange,
      expectedVersion,
      resultingVersion: next.version,
    },
  };
}

export function assertWriterReviewerHandoff(value: unknown): WriterReviewerHandoff {
  return snapshot(value);
}
