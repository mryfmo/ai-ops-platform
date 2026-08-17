/**
 * 根拠: FinalArch:COD-001 / FinalArch:COD-002 / FinalArch:COD-003 / ADR-0027 / WBS P8-T07。
 * one-writer handoff の current authority を version CAS し、成立した transition だけを追記監査する。
 */
import { sanitizeSecrets, type AuditLogWriter, type PgQueryable } from "@aiops/shared";

export type HandoffState = "writer_assigned" | "in_progress" | "ready_for_review" | "rework_requested" | "approved";
export type HandoffEvent =
  "start_work" | "submit_for_review" | "approve" | "request_rework" | "resume_rework" | "reviewer_takeover";

export interface HandoffCommitRange {
  baseSha: string;
  headSha: string;
}

export interface HandoffSnapshot {
  taskId: string;
  writer: string;
  reviewer: string;
  state: HandoffState;
  range: HandoffCommitRange;
  reviewRange: HandoffCommitRange | null;
  version: number;
}

export interface HandoffRecord extends HandoffSnapshot {
  traceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimWriterInput {
  taskId: string;
  writer: string;
  reviewer: string;
  actor: string;
  range: HandoffCommitRange;
  traceId: string;
}

export interface PersistHandoffTransitionInput {
  current: HandoffSnapshot;
  next: HandoffSnapshot;
  event: HandoffEvent;
  actor: string;
  oldWriter: string | null;
  newWriter: string | null;
  reason: string | null;
  traceId: string;
}

export interface HandoffTransactionContext {
  db: PgQueryable;
  auditLog: AuditLogWriter;
}

export type HandoffTransactionRunner = <T>(work: (context: HandoffTransactionContext) => Promise<T>) => Promise<T>;

export class WriterClaimConflictError extends Error {
  constructor(
    taskId: string,
    public readonly current: Pick<HandoffSnapshot, "writer" | "reviewer" | "state" | "version"> | null,
  ) {
    super(`Writer is already claimed for ${taskId}`);
    this.name = "WriterClaimConflictError";
  }
}

export class HandoffCasConflictError extends Error {
  constructor(
    taskId: string,
    public readonly expectedVersion: number,
    public readonly observedVersion: number | null,
  ) {
    super(`Handoff ${taskId} does not match version ${expectedVersion}`);
    this.name = "HandoffCasConflictError";
  }
}

const SHA = /^[a-f0-9]{40}$/u;
const TASK_ID = /^[A-Z][A-Z0-9._-]{1,127}$/u;
const AGENT_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const STATES = new Set<HandoffState>([
  "writer_assigned",
  "in_progress",
  "ready_for_review",
  "rework_requested",
  "approved",
]);
const TRANSITIONS: Record<HandoffEvent, { readonly from: readonly HandoffState[]; readonly to: HandoffState }> = {
  start_work: { from: ["writer_assigned"], to: "in_progress" },
  submit_for_review: { from: ["in_progress"], to: "ready_for_review" },
  approve: { from: ["ready_for_review"], to: "approved" },
  request_rework: { from: ["ready_for_review"], to: "rework_requested" },
  resume_rework: { from: ["rework_requested"], to: "in_progress" },
  reviewer_takeover: { from: ["ready_for_review", "rework_requested"], to: "in_progress" },
};
const COLUMNS = `task_id, writer, reviewer, state, base_sha, head_sha, review_base_sha, review_head_sha,
  version, trace_id, created_at, updated_at`;

function validText(value: string, pattern: RegExp, label: string): void {
  if (!pattern.test(value)) throw new TypeError(`Invalid handoff ${label}`);
}

function validRange(value: HandoffCommitRange, label: string): void {
  if (value === null || typeof value !== "object") throw new TypeError(`Invalid handoff ${label}`);
  validText(value.baseSha, SHA, `${label} base SHA`);
  validText(value.headSha, SHA, `${label} head SHA`);
}

function sameRange(left: HandoffCommitRange, right: HandoffCommitRange): boolean {
  return left.baseSha === right.baseSha && left.headSha === right.headSha;
}

function validSnapshot(value: HandoffSnapshot): void {
  validText(value.taskId, TASK_ID, "task id");
  validText(value.writer, AGENT_ID, "writer");
  validText(value.reviewer, AGENT_ID, "reviewer");
  if (value.writer === value.reviewer) throw new TypeError("Invalid one-writer roles");
  if (!STATES.has(value.state)) throw new TypeError("Invalid handoff state");
  if (!Number.isSafeInteger(value.version) || value.version < 1) throw new TypeError("Invalid handoff version");
  validRange(value.range, "range");
  if (value.reviewRange !== null) validRange(value.reviewRange, "review range");
  const needsReview =
    value.state === "ready_for_review" || value.state === "rework_requested" || value.state === "approved";
  if (needsReview !== (value.reviewRange !== null)) throw new TypeError("Invalid handoff review state");
  if (value.reviewRange !== null && !sameRange(value.range, value.reviewRange)) {
    throw new TypeError("Invalid handoff review range");
  }
}

function validReason(value: string | null, required: boolean): string | null {
  if (value === null) {
    if (required) throw new TypeError("Invalid takeover or rework reason");
    return null;
  }
  if (
    !required ||
    value.trim().length === 0 ||
    value.length > 2_000 ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new TypeError("Invalid takeover or rework reason");
  }
  return sanitizeSecrets(value.trim()).sanitized;
}

function rowToRecord(row: Record<string, unknown>): HandoffRecord {
  const reviewRange =
    row.review_base_sha === null || row.review_head_sha === null
      ? null
      : { baseSha: String(row.review_base_sha), headSha: String(row.review_head_sha) };
  return {
    taskId: String(row.task_id),
    writer: String(row.writer),
    reviewer: String(row.reviewer),
    state: row.state as HandoffState,
    range: { baseSha: String(row.base_sha), headSha: String(row.head_sha) },
    reviewRange,
    version: Number(row.version),
    traceId: String(row.trace_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function sameSnapshot(record: HandoffRecord, snapshot: HandoffSnapshot): boolean {
  return (
    record.taskId === snapshot.taskId &&
    record.writer === snapshot.writer &&
    record.reviewer === snapshot.reviewer &&
    record.state === snapshot.state &&
    sameRange(record.range, snapshot.range) &&
    ((record.reviewRange === null && snapshot.reviewRange === null) ||
      (record.reviewRange !== null &&
        snapshot.reviewRange !== null &&
        sameRange(record.reviewRange, snapshot.reviewRange))) &&
    record.version === snapshot.version
  );
}

function sameTransitionEvidence(
  row: Record<string, unknown>,
  input: PersistHandoffTransitionInput,
  sanitizedReason: string | null,
): boolean {
  const nullableText = (value: unknown): string | null => (value === null ? null : String(value));
  return (
    row.event === input.event &&
    row.from_state === input.current.state &&
    row.to_state === input.next.state &&
    row.actor === input.actor &&
    nullableText(row.old_writer) === input.oldWriter &&
    nullableText(row.new_writer) === input.newWriter &&
    nullableText(row.reason) === sanitizedReason &&
    row.base_sha === input.next.range.baseSha &&
    row.head_sha === input.next.range.headSha &&
    Number(row.expected_version) === input.current.version &&
    Number(row.resulting_version) === input.next.version &&
    row.trace_id === input.traceId
  );
}

function validateMutation(input: PersistHandoffTransitionInput): string | null {
  validSnapshot(input.current);
  validSnapshot(input.next);
  validText(input.actor, AGENT_ID, "actor");
  validText(input.traceId, UUID, "trace id");
  if (input.current.taskId !== input.next.taskId || input.next.version !== input.current.version + 1) {
    throw new TypeError("Invalid handoff version transition");
  }
  const expected = TRANSITIONS[input.event];
  if (expected === undefined || !expected.from.includes(input.current.state) || expected.to !== input.next.state) {
    throw new TypeError("Invalid handoff state transition");
  }
  const reviewerEvent =
    input.event === "approve" || input.event === "request_rework" || input.event === "reviewer_takeover";
  if (input.actor !== (reviewerEvent ? input.current.reviewer : input.current.writer)) {
    throw new TypeError("Invalid handoff transition actor");
  }
  const takeover = input.event === "reviewer_takeover";
  const sanitizedReason = validReason(input.reason, takeover || input.event === "request_rework");
  if (takeover) {
    if (
      input.oldWriter !== input.current.writer ||
      input.newWriter !== input.current.reviewer ||
      input.next.writer !== input.current.reviewer ||
      input.next.reviewer !== input.current.writer
    ) {
      throw new TypeError("Invalid takeover roles");
    }
    if (
      input.next.range.baseSha !== input.current.range.headSha ||
      input.next.range.headSha === input.next.range.baseSha
    ) {
      throw new TypeError("Invalid takeover commit range");
    }
  } else {
    if (
      input.oldWriter !== null ||
      input.newWriter !== null ||
      input.next.writer !== input.current.writer ||
      input.next.reviewer !== input.current.reviewer
    ) {
      throw new TypeError("Invalid implicit role change");
    }
  }
  if (input.event === "start_work" && !sameRange(input.next.range, input.current.range)) {
    throw new TypeError("Invalid start range");
  }
  if (
    input.event === "submit_for_review" &&
    (input.next.range.baseSha !== input.current.range.baseSha || input.next.range.headSha === input.next.range.baseSha)
  ) {
    throw new TypeError("Invalid review range");
  }
  if (
    (input.event === "approve" || input.event === "request_rework") &&
    (!sameRange(input.next.range, input.current.range) || input.current.reviewRange === null)
  ) {
    throw new TypeError("Invalid exact review range");
  }
  if (
    input.event === "resume_rework" &&
    (input.next.range.baseSha !== input.current.range.headSha ||
      input.next.range.headSha !== input.current.range.headSha)
  ) {
    throw new TypeError("Invalid rework resume range");
  }
  return sanitizedReason;
}

export class AgentHandoffsRepo {
  constructor(
    private readonly db: PgQueryable,
    private readonly runTransaction: HandoffTransactionRunner,
  ) {}

  async claimWriter(input: ClaimWriterInput): Promise<HandoffRecord> {
    validText(input.taskId, TASK_ID, "task id");
    validText(input.writer, AGENT_ID, "writer");
    validText(input.reviewer, AGENT_ID, "reviewer");
    validText(input.actor, AGENT_ID, "actor");
    validText(input.traceId, UUID, "trace id");
    validRange(input.range, "assignment range");
    if (input.writer === input.reviewer || input.actor !== input.writer)
      throw new TypeError("Invalid one-writer claim");
    if (input.range.baseSha !== input.range.headSha)
      throw new TypeError("Writer claim must start at the pinned base head");

    return this.runTransaction(async ({ db, auditLog }) => {
      const result = await db.query(
        `INSERT INTO agent_handoffs (
           task_id, writer, reviewer, state, base_sha, head_sha, version, trace_id
         ) VALUES ($1, $2, $3, 'writer_assigned', $4, $5, 1, $6::uuid)
         ON CONFLICT (task_id) DO NOTHING
         RETURNING ${COLUMNS}`,
        [input.taskId, input.writer, input.reviewer, input.range.baseSha, input.range.headSha, input.traceId],
      );
      if (!result.rows[0]) {
        const existing = await db.query(`SELECT ${COLUMNS} FROM agent_handoffs WHERE task_id = $1`, [input.taskId]);
        const row = existing.rows[0];
        if (row) {
          const record = rowToRecord(row);
          if (
            record.traceId === input.traceId &&
            sameSnapshot(record, {
              taskId: input.taskId,
              writer: input.writer,
              reviewer: input.reviewer,
              state: "writer_assigned",
              range: input.range,
              reviewRange: null,
              version: 1,
            })
          ) {
            return record;
          }
        }
        throw new WriterClaimConflictError(
          input.taskId,
          row
            ? {
                writer: String(row.writer),
                reviewer: String(row.reviewer),
                state: row.state as HandoffState,
                version: Number(row.version),
              }
            : null,
        );
      }
      await db.query(
        `INSERT INTO agent_handoff_transitions (
           task_id, event, from_state, to_state, actor, old_writer, new_writer, reason,
           base_sha, head_sha, expected_version, resulting_version, trace_id
         ) VALUES ($1, 'writer_assigned', NULL, 'writer_assigned', $2, NULL, $3, NULL,
                   $4, $5, 0, 1, $6::uuid)`,
        [input.taskId, input.actor, input.writer, input.range.baseSha, input.range.headSha, input.traceId],
      );
      const record = rowToRecord(result.rows[0]);
      await auditLog.append({
        trace_id: input.traceId,
        actor: input.actor,
        action: "agent_handoff_writer_assigned",
        basis: "FinalArch:COD-001/FinalArch:COD-002/ADR-0027",
        detail: {
          taskId: input.taskId,
          writer: input.writer,
          reviewer: input.reviewer,
          baseSha: input.range.baseSha,
          headSha: input.range.headSha,
          version: 1,
        },
        at: new Date().toISOString(),
      });
      return record;
    });
  }

  async transition(input: PersistHandoffTransitionInput): Promise<HandoffRecord> {
    const sanitizedReason = validateMutation(input);
    const { current, next } = input;
    return this.runTransaction(async ({ db, auditLog }) => {
      const result = await db.query(
        `UPDATE agent_handoffs SET
           writer = $2, reviewer = $3, state = $4, base_sha = $5, head_sha = $6,
           review_base_sha = $7, review_head_sha = $8, version = $9, trace_id = $10::uuid,
           updated_at = now()
         WHERE task_id = $1
           AND version = $11 AND writer = $12 AND reviewer = $13 AND state = $14
           AND base_sha = $15 AND head_sha = $16
           AND review_base_sha IS NOT DISTINCT FROM $17
           AND review_head_sha IS NOT DISTINCT FROM $18
         RETURNING ${COLUMNS}`,
        [
          next.taskId,
          next.writer,
          next.reviewer,
          next.state,
          next.range.baseSha,
          next.range.headSha,
          next.reviewRange?.baseSha ?? null,
          next.reviewRange?.headSha ?? null,
          next.version,
          input.traceId,
          current.version,
          current.writer,
          current.reviewer,
          current.state,
          current.range.baseSha,
          current.range.headSha,
          current.reviewRange?.baseSha ?? null,
          current.reviewRange?.headSha ?? null,
        ],
      );
      if (!result.rows[0]) {
        const observed = await db.query(`SELECT ${COLUMNS} FROM agent_handoffs WHERE task_id = $1`, [current.taskId]);
        const row = observed.rows[0];
        if (row) {
          const record = rowToRecord(row);
          if (sameSnapshot(record, next)) {
            const evidence = await db.query(
              `SELECT event, from_state, to_state, actor, old_writer, new_writer, reason,
                      base_sha, head_sha, expected_version, resulting_version, trace_id
                 FROM agent_handoff_transitions
                WHERE task_id = $1 AND resulting_version = $2`,
              [current.taskId, next.version],
            );
            if (evidence.rows[0] && sameTransitionEvidence(evidence.rows[0], input, sanitizedReason)) return record;
          }
        }
        throw new HandoffCasConflictError(current.taskId, current.version, row ? Number(row.version) : null);
      }
      await db.query(
        `INSERT INTO agent_handoff_transitions (
           task_id, event, from_state, to_state, actor, old_writer, new_writer, reason,
           base_sha, head_sha, expected_version, resulting_version, trace_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::uuid)`,
        [
          next.taskId,
          input.event,
          current.state,
          next.state,
          input.actor,
          input.oldWriter,
          input.newWriter,
          sanitizedReason,
          next.range.baseSha,
          next.range.headSha,
          current.version,
          next.version,
          input.traceId,
        ],
      );
      const record = rowToRecord(result.rows[0]);
      await auditLog.append({
        trace_id: input.traceId,
        actor: input.actor,
        action: `agent_handoff_${input.event}`,
        basis: "FinalArch:COD-001/FinalArch:COD-002/ADR-0027",
        detail: {
          taskId: next.taskId,
          fromState: current.state,
          toState: next.state,
          oldWriter: input.oldWriter,
          newWriter: input.newWriter,
          baseSha: next.range.baseSha,
          headSha: next.range.headSha,
          expectedVersion: current.version,
          resultingVersion: next.version,
        },
        reason: sanitizedReason ?? undefined,
        at: new Date().toISOString(),
      });
      return record;
    });
  }
}
