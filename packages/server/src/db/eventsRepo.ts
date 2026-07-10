/**
 * packages/server/src/db/eventsRepo.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-010: webhook受信は検証後ただちにeventsテーブルへキューイングし、
 *   重い処理（Graph本文取得・LLM解釈・GitHub操作）はディスパッチャが非同期に行う。
 */
import type { PgQueryable } from "@aiops/shared";

export type EventSource = "github" | "monitor" | "inbound";

export interface QueuedEvent {
  eventId: string;
  traceId: string;
  source: EventSource;
  payload: unknown;
  status: "queued" | "dispatched" | "delayed" | "done" | "dead";
  attempts: number;
}

export interface EnqueueOptions {
  dedupeKey?: string | null;
}

export interface ClaimOptions {
  source?: EventSource;
  now?: Date;
  leaseMs?: number;
  maxAttempts?: number;
}

export interface MarkFailedOptions {
  maxAttempts: number;
  nextAttemptAt: Date;
}

export interface MarkFailedResult {
  status: "queued" | "dead";
  attempts: number;
}

interface PgTransactionClient extends PgQueryable {
  release(): void;
}

interface PgConnectable extends PgQueryable {
  connect(): Promise<PgTransactionClient>;
}

export type EventDispositionAction = "claim" | "dead" | "skip";

export interface EventDispositionInput {
  status: QueuedEvent["status"];
  attempts: number;
  nextAttemptAt: string | null;
  claimedAt: string | null;
}

export interface EventDispositionOptions {
  now: Date;
  leaseMs: number;
  maxAttempts: number;
}

export function decideEventDisposition(
  event: EventDispositionInput,
  options: EventDispositionOptions,
): { action: EventDispositionAction; attempts: number } {
  if (event.status === "done" || event.status === "dead") return { action: "skip", attempts: event.attempts };

  if (event.status === "queued" || event.status === "delayed") {
    if (!event.nextAttemptAt || new Date(event.nextAttemptAt).getTime() <= options.now.getTime()) {
      return { action: "claim", attempts: event.attempts };
    }
    return { action: "skip", attempts: event.attempts };
  }

  if (!event.claimedAt) return { action: "skip", attempts: event.attempts };
  const leaseCutoffMs = options.now.getTime() - options.leaseMs;
  if (new Date(event.claimedAt).getTime() >= leaseCutoffMs) return { action: "skip", attempts: event.attempts };

  const attempts = event.attempts + 1;
  return attempts >= options.maxAttempts ? { action: "dead", attempts } : { action: "claim", attempts };
}

function hasConnect(db: PgQueryable): db is PgConnectable {
  return typeof (db as { connect?: unknown }).connect === "function";
}

export class EventsRepo {
  constructor(private readonly db: PgQueryable) {}

  async enqueue(
    source: EventSource,
    payload: unknown,
    traceId: string,
    options: EnqueueOptions = {},
  ): Promise<boolean> {
    if (options.dedupeKey) {
      const res = await this.db.query(
        `INSERT INTO events (trace_id, source, payload, status, dedupe_key, next_attempt_at)
         VALUES ($1, $2, $3, 'queued', $4, now())
         ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING event_id`,
        [traceId, source, JSON.stringify(payload), options.dedupeKey],
      );
      return res.rows.length > 0;
    }

    await this.db.query(
      "INSERT INTO events (trace_id, source, payload, status, next_attempt_at) VALUES ($1, $2, $3, 'queued', now())",
      [traceId, source, JSON.stringify(payload)],
    );
    return true;
  }

  /** 未処理イベントを取得しdispatched状態へ遷移させる（1件ずつの単純ディスパッチ。FOR UPDATE SKIP LOCKED） */
  async claimNextQueued(sourceOrOptions?: EventSource | ClaimOptions): Promise<QueuedEvent | null> {
    const options: ClaimOptions =
      typeof sourceOrOptions === "string" ? { source: sourceOrOptions } : (sourceOrOptions ?? {});
    const now = options.now ?? new Date();
    const leaseMs = options.leaseMs ?? 5 * 60_000;
    const maxAttempts = options.maxAttempts ?? 5;
    const leaseCutoff = new Date(now.getTime() - leaseMs);
    const params: unknown[] = [now.toISOString(), leaseCutoff.toISOString()];
    const sourceParam = options.source ? `$${params.push(options.source)}` : null;
    const filter = sourceParam ? `AND source = ${sourceParam}` : "";

    const client = hasConnect(this.db) ? await this.db.connect() : null;
    const tx = client ?? this.db;
    try {
      await tx.query("BEGIN");
      const candidates = await tx.query(
        `SELECT event_id, trace_id, source, payload, status, attempts, next_attempt_at, claimed_at
         FROM events
         WHERE (
           (status IN ('queued', 'delayed') AND (next_attempt_at IS NULL OR next_attempt_at <= $1::timestamptz))
           OR (status = 'dispatched' AND claimed_at IS NOT NULL AND claimed_at < $2::timestamptz)
         )
         ${filter}
         ORDER BY received_at LIMIT 10 FOR UPDATE SKIP LOCKED`,
        params,
      );

      let claimedEvent: QueuedEvent | null = null;
      for (const row of candidates.rows) {
        const disposition = decideEventDisposition(
          {
            status: row.status as QueuedEvent["status"],
            attempts: Number(row.attempts ?? 0),
            nextAttemptAt: row.next_attempt_at ? new Date(String(row.next_attempt_at)).toISOString() : null,
            claimedAt: row.claimed_at ? new Date(String(row.claimed_at)).toISOString() : null,
          },
          { now, leaseMs, maxAttempts },
        );

        if (disposition.action === "skip") continue;

        if (disposition.action === "dead") {
          await tx.query(
            `UPDATE events
             SET status = 'dead', attempts = $2, next_attempt_at = NULL, claimed_at = NULL
             WHERE event_id = $1`,
            [row.event_id, disposition.attempts],
          );
          continue;
        }

        const claimed = await tx.query(
          `UPDATE events
           SET status = 'dispatched', attempts = $2, claimed_at = $3::timestamptz
           WHERE event_id = $1
           RETURNING event_id, trace_id, source, payload, status, attempts`,
          [row.event_id, disposition.attempts, now.toISOString()],
        );
        const claimedRow = claimed.rows[0];
        if (!claimedRow) continue;
        claimedEvent = {
          eventId: String(claimedRow.event_id),
          traceId: String(claimedRow.trace_id),
          source: claimedRow.source as EventSource,
          payload: typeof claimedRow.payload === "string" ? JSON.parse(claimedRow.payload) : claimedRow.payload,
          status: claimedRow.status as QueuedEvent["status"],
          attempts: Number(claimedRow.attempts ?? 0),
        };
        break;
      }

      await tx.query("COMMIT");
      return claimedEvent;
    } catch (error) {
      await tx.query("ROLLBACK");
      throw error;
    } finally {
      client?.release();
    }
  }

  async markDone(eventId: string): Promise<void> {
    await this.db.query("UPDATE events SET status = 'done' WHERE event_id = $1", [eventId]);
  }

  /** 処理失敗イベントを再試行可能に戻す。上限到達時はdead終端にする。 */
  async markFailed(eventId: string, options: MarkFailedOptions): Promise<MarkFailedResult> {
    const res = await this.db.query(
      `UPDATE events
       SET attempts = attempts + 1,
           status = CASE WHEN attempts + 1 >= $2 THEN 'dead' ELSE 'queued' END,
           next_attempt_at = CASE WHEN attempts + 1 >= $2 THEN NULL ELSE $3::timestamptz END,
           claimed_at = NULL
       WHERE event_id = $1
       RETURNING status, attempts`,
      [eventId, options.maxAttempts, options.nextAttemptAt.toISOString()],
    );
    const row = res.rows[0] ?? { status: "dead", attempts: options.maxAttempts };
    return { status: row.status as MarkFailedResult["status"], attempts: Number(row.attempts) };
  }
}
