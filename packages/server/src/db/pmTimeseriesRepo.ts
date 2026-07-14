/**
 * packages/server/src/db/pmTimeseriesRepo.ts
 *
 * 根拠: ADR-0007 / PrjOps:SPEC-INT-062 / DevOps:SPEC-INT-081.
 * GitHub PM webhookイベントと定期snapshotを蓄積する薄いPostgreSQL repo。
 */
import { sanitizeSecrets, type PgQueryable } from "@aiops/shared";

export type PmSubjectType = "issue" | "pull_request" | "milestone" | "project_item" | "project_status" | "deployment";

export interface PmEventRecordInput {
  traceId: string;
  eventName: string;
  action: string | null;
  projectId: string | null;
  repository: string | null;
  subjectType: PmSubjectType;
  subjectId: string | null;
  occurredAt: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  normalized: unknown;
  rawPayload: unknown;
}

export interface PmSnapshotRecordInput {
  traceId: string;
  projectId: string | null;
  repository: string | null;
  sourceType: PmSubjectType;
  sourceId: string;
  state: string | null;
  capturedAt: string;
  payload: unknown;
}

function sanitizedJson(value: unknown): string {
  return sanitizeSecrets(JSON.stringify(value)).sanitized;
}

export class PmTimeseriesRepo {
  constructor(private readonly db: PgQueryable) {}

  async recordEvent(input: PmEventRecordInput): Promise<void> {
    await this.db.query(
      `INSERT INTO pm_events (
         trace_id, event_name, action, project_id, repository, subject_type, subject_id,
         occurred_at, from_status, to_status, normalized, raw_payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        input.traceId,
        input.eventName,
        input.action,
        input.projectId,
        input.repository,
        input.subjectType,
        input.subjectId,
        input.occurredAt,
        input.fromStatus ?? null,
        input.toStatus ?? null,
        sanitizedJson(input.normalized),
        sanitizedJson(input.rawPayload),
      ],
    );
  }

  async recordSnapshot(input: PmSnapshotRecordInput): Promise<void> {
    await this.db.query(
      `INSERT INTO pm_snapshots (
         trace_id, project_id, repository, source_type, source_id, state, captured_at, payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (source_type, source_id, captured_at) DO NOTHING`,
      [
        input.traceId,
        input.projectId,
        input.repository,
        input.sourceType,
        input.sourceId,
        input.state,
        input.capturedAt,
        sanitizedJson(input.payload),
      ],
    );
  }

  async listEventsBetween(periodStart: string, periodEnd: string): Promise<unknown[]> {
    const res = await this.db.query(
      `SELECT event_name, action, project_id, occurred_at, from_status, to_status, normalized
       FROM pm_events WHERE occurred_at >= $1 AND occurred_at < $2 ORDER BY occurred_at`,
      [periodStart, periodEnd],
    );
    return res.rows;
  }

  async listSnapshotsBetween(periodStart: string, periodEnd: string): Promise<unknown[]> {
    const res = await this.db.query(
      `SELECT project_id, source_type, source_id, state, captured_at, payload
       FROM pm_snapshots WHERE captured_at >= $1 AND captured_at < $2 ORDER BY captured_at`,
      [periodStart, periodEnd],
    );
    return res.rows;
  }
}
