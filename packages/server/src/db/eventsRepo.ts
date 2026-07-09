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
  status: "queued" | "dispatched" | "delayed" | "done";
}

export class EventsRepo {
  constructor(private readonly db: PgQueryable) {}

  async enqueue(source: EventSource, payload: unknown, traceId: string): Promise<void> {
    await this.db.query("INSERT INTO events (trace_id, source, payload, status) VALUES ($1, $2, $3, 'queued')", [
      traceId,
      source,
      JSON.stringify(payload),
    ]);
  }

  /** 未処理イベントを取得しdispatched状態へ遷移させる（1件ずつの単純ディスパッチ。FOR UPDATE SKIP LOCKED） */
  async claimNextQueued(source?: EventSource): Promise<QueuedEvent | null> {
    const filter = source ? "AND source = $1" : "";
    const params = source ? [source] : [];
    const res = await this.db.query(
      `UPDATE events SET status = 'dispatched'
       WHERE event_id = (
         SELECT event_id FROM events WHERE status = 'queued' ${filter}
         ORDER BY received_at LIMIT 1 FOR UPDATE SKIP LOCKED
       )
       RETURNING event_id, trace_id, source, payload, status`,
      params,
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      eventId: String(row.event_id),
      traceId: String(row.trace_id),
      source: row.source as EventSource,
      payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
      status: row.status as QueuedEvent["status"],
    };
  }

  async markDone(eventId: string): Promise<void> {
    await this.db.query("UPDATE events SET status = 'done' WHERE event_id = $1", [eventId]);
  }

  /** 処理失敗イベントを遅延（delayed）へ。再試行はディスパッチャの再クレーム対象 */
  async markDelayed(eventId: string): Promise<void> {
    await this.db.query("UPDATE events SET status = 'delayed' WHERE event_id = $1", [eventId]);
  }
}
