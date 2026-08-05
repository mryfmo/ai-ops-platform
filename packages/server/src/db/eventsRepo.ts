/**
 * packages/server/src/db/eventsRepo.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-010: webhook受信は検証後ただちにeventsテーブルへキューイングし、
 *   重い処理（Graph本文取得・LLM解釈・GitHub操作）はディスパッチャが非同期に行う。
 */
import type { PgQueryable } from "@aiops/shared";
import type { EventQueueMetric } from "../observability/metrics.js";
import { sanitizeSecrets } from "@aiops/shared";

export type EventSource = "github" | "monitor" | "inbound";

export interface QueuedEvent {
  eventId: string;
  traceId: string;
  source: EventSource;
  payload: unknown;
  status: "queued" | "dispatched" | "delayed" | "done" | "dead";
  attempts: number;
  claimedAt: string;
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
  claimedAt?: string;
}

export interface MarkFailedResult {
  status: "queued" | "dead" | "stale";
  attempts: number;
}

interface PgTransactionClient extends PgQueryable {
  release(err?: Error): void;
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * JSONBカラムへ入れる値のサニタイズ。
 *
 * 直列化した文字列へ sanitizeSecrets を適用してはならない。generic_api_key_kv などの
 * key=value パターンは値を囲む引用符ごと置換するため、`{"api_key":"..."}` が
 * `{"***REDACTED:generic_api_key_kv***}` になりJSONとして壊れる。events.payload は
 * JSONB なのでINSERT自体が失敗し、イベントを取りこぼす（サニタイズ漏れより悪い）。
 * 文字列走査は auditLog.ts と同じく「検知」にのみ使える手法で、置換結果は使えない。
 *
 * そこで構造を保ったまま値だけを置換する。加えて、JSONでは key と value が分離して
 * いるため key=value パターンが値単体には一致しない。秘密であることを示す情報が key
 * 側にあるので、key名が秘密を示唆する場合は値ごと落とす。過剰REDACTは events テーブル
 * の可読性が落ちるだけだが、漏れは実害になるためこちら側に倒している。
 */
const SECRET_KEY_RE = /(secret|token|password|passwd|credential|authorization|cookie|apikey)|(^|_)keys?$/;

/** camelCase・kebab-case を snake_case へ寄せてから判定する（accessToken / x-api-key 等に対応）。 */
function normalizeKeyName(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

export function sanitizePayloadDeep(value: unknown, keyHint?: string): unknown {
  // key名が資格情報を示す場合、値が文字列でも構造化されていても落とす。
  // 子へ降りるときに親のkeyHintを失うと {clientSecret:{value:"..."}} のように
  // 平文を一段包むだけで素通りしてしまうため、ここで打ち切る。
  // 判定は部分一致にする。apikey / accesstoken のように区切りの無い綴りが
  // 実際のwebhook JSONに現れ、区切りを前提にした境界一致では取りこぼすため。
  // 加えて key/keys で終わる名前（privateKey / signingKey / api_key 等）を拾う。
  // tokenizer のような無関係な語や idempotency_key も落ちるが、events テーブルの
  // 可読性が下がるだけで実害は無い側に倒している。
  if (keyHint !== undefined && SECRET_KEY_RE.test(normalizeKeyName(keyHint))) {
    // 数値のPIN/OTPのように、資格情報がスカラーで来ることもある。null だけは
    // それ自体が情報を持たないのでそのまま残す。
    return value === null ? null : "***REDACTED:secret_key_name***";
  }
  if (typeof value === "string") {
    return sanitizeSecrets(value).sanitized;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadDeep(item, keyHint));
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    // { name: "Authorization", value: "Basic ..." } のように、秘密であることを
    // 隣の name/key フィールドが示す形。value 側のkey名は "value" でしかないため
    // key名判定では拾えない。ラベル側を見て対になる値を落とす。
    const labelledSecret = entries.some(
      ([key, item]) =>
        (key === "name" || key === "key") && typeof item === "string" && SECRET_KEY_RE.test(normalizeKeyName(item)),
    );
    return Object.fromEntries(
      entries.map(([key, item]) => {
        if (labelledSecret && (key === "value" || key === "values")) {
          return [key, "***REDACTED:secret_name_value_pair***"];
        }
        return [key, sanitizePayloadDeep(item, key)];
      }),
    );
  }
  return value;
}

export class EventsRepo {
  constructor(private readonly db: PgQueryable) {}

  async enqueue(
    source: EventSource,
    payload: unknown,
    traceId: string,
    options: EnqueueOptions = {},
  ): Promise<boolean> {
    const serializedPayload = JSON.stringify(sanitizePayloadDeep(payload));
    if (options.dedupeKey) {
      const res = await this.db.query(
        `INSERT INTO events (trace_id, source, payload, status, dedupe_key, next_attempt_at)
         VALUES ($1, $2, $3, 'queued', $4, now())
         ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING event_id`,
        [traceId, source, serializedPayload, options.dedupeKey],
      );
      return res.rows.length > 0;
    }

    await this.db.query(
      "INSERT INTO events (trace_id, source, payload, status, next_attempt_at) VALUES ($1, $2, $3, 'queued', now())",
      [traceId, source, serializedPayload],
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
    let released = false;
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
         -- ponytail: LIMIT 10 batches dead-row cleanup; use LIMIT 1 if worker contention shows up.
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
           RETURNING event_id, trace_id, source, payload, status, attempts, claimed_at`,
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
          claimedAt: new Date(String(claimedRow.claimed_at)).toISOString(),
        };
        break;
      }

      await tx.query("COMMIT");
      return claimedEvent;
    } catch (error) {
      try {
        await tx.query("ROLLBACK");
      } catch (rollbackError) {
        const releaseError = toError(rollbackError);
        client?.release(releaseError);
        released = true;
        throw releaseError;
      }
      throw error;
    } finally {
      if (!released) client?.release();
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
         AND status = 'dispatched'
         AND ($4::timestamptz IS NULL OR claimed_at = $4::timestamptz)
       RETURNING status, attempts`,
      [eventId, options.maxAttempts, options.nextAttemptAt.toISOString(), options.claimedAt ?? null],
    );
    const row = res.rows[0] ?? { status: "stale", attempts: 0 };
    return { status: row.status as MarkFailedResult["status"], attempts: Number(row.attempts) };
  }

  async getQueueMetrics(now: Date = new Date()): Promise<EventQueueMetric[]> {
    const res = await this.db.query(
      `SELECT status,
              count(*)::int AS depth,
              COALESCE(EXTRACT(EPOCH FROM ($1::timestamptz - MIN(received_at))), 0) AS oldest_age_seconds
       FROM events
       WHERE status IN ('queued', 'delayed', 'dispatched')
       GROUP BY status`,
      [now.toISOString()],
    );
    return res.rows.map((row) => ({
      status: String(row.status),
      depth: Number(row.depth ?? 0),
      oldestAgeSeconds: Math.max(0, Number(row.oldest_age_seconds ?? 0)),
    }));
  }
}
