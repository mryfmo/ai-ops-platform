// 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001
// advisory transaction lock + source PK で thread count と重複 claim を一つの authority に保つ。
import type { NormalizedStatusIngestEvent } from "@aiops/shared/reporting/statusIngestChannels.js";
import { decideClarificationAction, type CompletenessResult } from "@aiops/shared/reporting/statusIngestContract.js";

import type { StatusIngestStore } from "../agents/statusIngestActivities.js";

interface QueryResult {
  readonly rows: Record<string, unknown>[];
  readonly rowCount?: number | null;
}

interface StatusIngestPgClient {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
}

export interface StatusIngestPgPool {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  connect(): Promise<StatusIngestPgClient>;
}

function sourceKey(event: NormalizedStatusIngestEvent): string {
  return `status-ingest:${event.channel}:${event.sourceMessageId}`;
}

function threadKey(event: NormalizedStatusIngestEvent): string {
  return `status-ingest:${event.channel}:${event.threadId}`;
}

function claimReceipt(row: Record<string, unknown>, duplicate: boolean) {
  return {
    schemaVersion: 1 as const,
    payload: {
      sourceKey: String(row.source_key),
      threadKey: String(row.thread_key),
      duplicate,
      priorClarifyCount: Number(row.prior_clarify_count),
      clarifyCount: Number(row.clarify_count),
      action: String(row.action),
      state: String(row.state),
      revision: Number(row.revision),
    },
  };
}

/** PostgreSQL の unique/CAS と transaction-scoped advisory lock を使う operational store。 */
export class PgStatusIngestStore implements StatusIngestStore {
  constructor(private readonly db: StatusIngestPgPool) {}

  async readThread(key: string): Promise<unknown> {
    const result = await this.db.query(
      "SELECT COALESCE(MAX(clarify_count), 0)::integer AS clarify_count FROM status_ingest_records WHERE thread_key = $1",
      [key],
    );
    return { schemaVersion: 1, payload: { threadKey: key, clarifyCount: Number(result.rows[0]?.clarify_count ?? 0) } };
  }

  async claim(input: { event: NormalizedStatusIngestEvent; completeness: CompletenessResult }): Promise<unknown> {
    const source = sourceKey(input.event);
    const thread = threadKey(input.event);
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [source]);
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [thread]);
      const existing = await client.query(
        "SELECT source_key, thread_key, prior_clarify_count, clarify_count, action, state, revision FROM status_ingest_records WHERE source_key = $1",
        [source],
      );
      if (existing.rows[0] !== undefined) {
        await client.query("COMMIT");
        return claimReceipt(existing.rows[0], true);
      }
      const countResult = await client.query(
        "SELECT COALESCE(MAX(clarify_count), 0)::integer AS clarify_count FROM status_ingest_records WHERE thread_key = $1",
        [thread],
      );
      const prior = Number(countResult.rows[0]?.clarify_count ?? 0);
      const action = decideClarificationAction(input.completeness, { clarifyCount: prior }).action;
      const count = action === "clarify" ? prior + 1 : prior;
      const inserted = await client.query(
        `INSERT INTO status_ingest_records
           (source_key, thread_key, channel, source_message_id, prior_clarify_count, clarify_count, action)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING source_key, thread_key, prior_clarify_count, clarify_count, action, state, revision`,
        [source, thread, input.event.channel, input.event.sourceMessageId, prior, count, action],
      );
      await client.query("COMMIT");
      return claimReceipt(inserted.rows[0]!, false);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findSideEffect(idempotencyKey: string): Promise<unknown> {
    const result = await this.db.query(
      "SELECT side_effects -> $1 AS receipt FROM status_ingest_records WHERE side_effects ? $1",
      [idempotencyKey],
    );
    return result.rows[0]?.receipt ?? null;
  }

  async recordSideEffect(idempotencyKey: string, value: unknown): Promise<void> {
    const source = (value as { payload?: { sourceKey?: unknown } }).payload?.sourceKey;
    if (typeof source !== "string") throw new RangeError("status ingest side-effect receipt requires sourceKey");
    const result = await this.db.query(
      `UPDATE status_ingest_records
       SET side_effects = side_effects || jsonb_build_object($2::text, $3::jsonb), updated_at = now()
       WHERE source_key = $1 AND (NOT side_effects ? $2 OR side_effects -> $2 = $3::jsonb)`,
      [source, idempotencyKey, JSON.stringify(value)],
    );
    if (result.rowCount !== 1) throw new Error("status ingest side-effect receipt conflicts with existing authority");
  }

  async complete(input: {
    sourceKey: string;
    expectedRevision: number;
    canonicalReference: string | null;
    notificationReference: string;
  }): Promise<unknown> {
    const updated = await this.db.query(
      `UPDATE status_ingest_records
       SET state = 'complete', revision = revision + 1, canonical_reference = $3,
           notification_reference = $4, updated_at = now()
       WHERE source_key = $1 AND revision = $2 AND state = 'pending'
       RETURNING source_key, revision, state, canonical_reference, notification_reference`,
      [input.sourceKey, input.expectedRevision, input.canonicalReference, input.notificationReference],
    );
    const row =
      updated.rows[0] ??
      (
        await this.db.query(
          `SELECT source_key, revision, state, canonical_reference, notification_reference
           FROM status_ingest_records WHERE source_key = $1`,
          [input.sourceKey],
        )
      ).rows[0];
    if (
      row === undefined ||
      row.state !== "complete" ||
      Number(row.revision) !== input.expectedRevision + 1 ||
      row.canonical_reference !== input.canonicalReference ||
      row.notification_reference !== input.notificationReference
    ) {
      throw new Error("status ingest completion CAS conflict");
    }
    return {
      schemaVersion: 1,
      payload: { sourceKey: String(row.source_key), revision: Number(row.revision), state: "complete" },
    };
  }
}
