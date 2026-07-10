/**
 * packages/server/tests/eventsRepo.test.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-010（eventsキューの at-least-once 再試行、DLQ、dedupe）。
 */
import { describe, expect, it } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { decideEventDisposition, EventsRepo } from "../src/db/eventsRepo.js";

interface Call {
  text: string;
  params: unknown[] | undefined;
}

function makeMockDb(rows: Array<Record<string, unknown>> = []) {
  const calls: Call[] = [];
  const db: PgQueryable = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return { rows };
    },
  };
  return { db, calls };
}

function makeSequentialMockDb(results: Array<Array<Record<string, unknown>>>) {
  const calls: Call[] = [];
  const db: PgQueryable = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return { rows: results.shift() ?? [] };
    },
  };
  return { db, calls };
}

describe("EventsRepo retry and dedupe (SPEC-INT-010)", () => {
  it("enqueue: dedupe_key がある場合は ON CONFLICT DO NOTHING で重複投入しない", async () => {
    const { db, calls } = makeMockDb([{ event_id: "evt-1" }]);
    const repo = new EventsRepo(db);

    const inserted = await repo.enqueue("github", { ok: true }, "11111111-1111-4111-8111-111111111111", {
      dedupeKey: "github:delivery-1",
    });

    expect(inserted).toBe(true);
    expect(calls[0]!.text).toContain("dedupe_key");
    expect(calls[0]!.text).toContain("ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING");
    expect(calls[0]!.params).toContain("github:delivery-1");
  });

  it("claimNextQueued: due queued と lease切れ dispatched を再クレーム対象にする", async () => {
    const { db, calls } = makeSequentialMockDb([
      [
        {
          event_id: "evt-1",
          trace_id: "11111111-1111-4111-8111-111111111111",
          source: "inbound",
          payload: "{}",
          status: "queued",
          attempts: 1,
          next_attempt_at: "2026-07-10T00:00:00.000Z",
          claimed_at: null,
        },
      ],
      [
        {
          event_id: "evt-1",
          trace_id: "11111111-1111-4111-8111-111111111111",
          source: "inbound",
          payload: "{}",
          status: "dispatched",
          attempts: 1,
        },
      ],
    ]);
    const repo = new EventsRepo(db);

    const event = await repo.claimNextQueued({
      now: new Date("2026-07-10T00:00:00Z"),
      leaseMs: 60_000,
      maxAttempts: 5,
    });

    expect(event?.eventId).toBe("evt-1");
    expect(event?.attempts).toBe(1);
    expect(calls[0]!.text).toContain("FOR UPDATE SKIP LOCKED");
    expect(calls[1]!.text).toContain("status = 'dispatched'");
  });

  it("claimNextQueued: lease切れdispatchedは純粋判定を通してattemptsを増やす", async () => {
    const { db, calls } = makeSequentialMockDb([
      [
        {
          event_id: "evt-lease",
          trace_id: "11111111-1111-4111-8111-111111111111",
          source: "inbound",
          payload: "{}",
          status: "dispatched",
          attempts: 2,
          next_attempt_at: null,
          claimed_at: "2026-07-09T23:58:59.999Z",
        },
      ],
      [
        {
          event_id: "evt-lease",
          trace_id: "11111111-1111-4111-8111-111111111111",
          source: "inbound",
          payload: "{}",
          status: "dispatched",
          attempts: 3,
        },
      ],
    ]);
    const repo = new EventsRepo(db);

    const event = await repo.claimNextQueued({
      now: new Date("2026-07-10T00:00:00Z"),
      leaseMs: 60_000,
      maxAttempts: 5,
    });

    expect(event?.attempts).toBe(3);
    expect(calls[0]!.text).toContain("FOR UPDATE SKIP LOCKED");
    expect(calls[1]!.text).toContain("attempts = $2");
    expect(calls[1]!.params).toContain(3);
  });

  it("claimNextQueued: lease切れdispatchedがmaxAttempts到達ならdeadにし、dispatch対象を返さない", async () => {
    const { db, calls } = makeSequentialMockDb([
      [
        {
          event_id: "evt-poison",
          trace_id: "11111111-1111-4111-8111-111111111111",
          source: "inbound",
          payload: "{}",
          status: "dispatched",
          attempts: 4,
          next_attempt_at: null,
          claimed_at: "2026-07-09T23:58:59.999Z",
        },
      ],
      [],
    ]);
    const repo = new EventsRepo(db);

    const event = await repo.claimNextQueued({
      now: new Date("2026-07-10T00:00:00Z"),
      leaseMs: 60_000,
      maxAttempts: 5,
    });

    expect(event).toBeNull();
    expect(calls[1]!.text).toContain("status = 'dead'");
    expect(calls[1]!.params).toContain(5);
  });

  it("markFailed: 上限未満は attempts を増やして queued に戻す", async () => {
    const { db, calls } = makeMockDb([{ status: "queued", attempts: 2 }]);
    const repo = new EventsRepo(db);

    const result = await repo.markFailed("evt-1", {
      maxAttempts: 5,
      nextAttemptAt: new Date("2026-07-10T00:01:00Z"),
    });

    expect(result).toEqual({ status: "queued", attempts: 2 });
    expect(calls[0]!.text).toContain("attempts = attempts + 1");
    expect(calls[0]!.text).toContain("status = CASE");
    expect(calls[0]!.text).toContain("'dead'");
  });

  it("markFailed: 上限到達時は dead にして再クレーム対象から外す", async () => {
    const { db } = makeMockDb([{ status: "dead", attempts: 5 }]);
    const repo = new EventsRepo(db);

    await expect(
      repo.markFailed("evt-1", {
        maxAttempts: 5,
        nextAttemptAt: new Date("2026-07-10T00:01:00Z"),
      }),
    ).resolves.toEqual({ status: "dead", attempts: 5 });
  });
});

describe("decideEventDisposition (SPEC-INT-010)", () => {
  const now = new Date("2026-07-10T00:00:00Z");

  it("queued/delayed は next_attempt_at 到来後だけclaimする", () => {
    expect(
      decideEventDisposition(
        { status: "queued", attempts: 0, nextAttemptAt: "2026-07-10T00:00:00.000Z", claimedAt: null },
        { now, leaseMs: 60_000, maxAttempts: 5 },
      ),
    ).toEqual({ action: "claim", attempts: 0 });
    expect(
      decideEventDisposition(
        { status: "delayed", attempts: 1, nextAttemptAt: "2026-07-10T00:00:01.000Z", claimedAt: null },
        { now, leaseMs: 60_000, maxAttempts: 5 },
      ),
    ).toEqual({ action: "skip", attempts: 1 });
  });

  it("lease内dispatchedはskip、lease切れdispatchedはattemptsを増やしてclaimする", () => {
    expect(
      decideEventDisposition(
        { status: "dispatched", attempts: 2, nextAttemptAt: null, claimedAt: "2026-07-09T23:59:30.000Z" },
        { now, leaseMs: 60_000, maxAttempts: 5 },
      ),
    ).toEqual({ action: "skip", attempts: 2 });
    expect(
      decideEventDisposition(
        { status: "dispatched", attempts: 2, nextAttemptAt: null, claimedAt: "2026-07-09T23:58:59.999Z" },
        { now, leaseMs: 60_000, maxAttempts: 5 },
      ),
    ).toEqual({ action: "claim", attempts: 3 });
  });

  it("lease切れdispatchedがmaxAttempts到達ならdeadにする", () => {
    expect(
      decideEventDisposition(
        { status: "dispatched", attempts: 4, nextAttemptAt: null, claimedAt: "2026-07-09T23:58:59.999Z" },
        { now, leaseMs: 60_000, maxAttempts: 5 },
      ),
    ).toEqual({ action: "dead", attempts: 5 });
  });

  it("done/deadはclaimしない", () => {
    for (const status of ["done", "dead"] as const) {
      expect(
        decideEventDisposition(
          { status, attempts: 5, nextAttemptAt: null, claimedAt: null },
          { now, leaseMs: 60_000, maxAttempts: 5 },
        ),
      ).toEqual({ action: "skip", attempts: 5 });
    }
  });
});
