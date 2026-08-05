/**
 * packages/server/tests/eventsRepo.test.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-010（eventsキューの at-least-once 再試行、DLQ、dedupe）。
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

function makeTransactionalMockDb(
  results: Array<Array<Record<string, unknown>>>,
  options: { failOnQueryContaining?: string; failRollback?: boolean } = {},
) {
  const calls: Call[] = [];
  let released = false;
  let releaseError: Error | undefined;
  const client = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      const command = text.trim();
      if (options.failRollback && command === "ROLLBACK") throw new Error("rollback failed");
      if (options.failOnQueryContaining && text.includes(options.failOnQueryContaining))
        throw new Error("update failed");
      if (command === "BEGIN" || command === "COMMIT" || command === "ROLLBACK") return { rows: [] };
      return { rows: results.shift() ?? [] };
    },
    release: (err?: Error) => {
      released = true;
      releaseError = err;
    },
  };
  const db: PgQueryable & { connect(): Promise<typeof client> } = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return { rows: [] };
    },
    connect: async () => client,
  };
  return { db, calls, wasReleased: () => released, releaseError: () => releaseError };
}

describe("EventsRepo retry and dedupe (DevOps:SPEC-INT-010)", () => {
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
    const { db, calls, wasReleased } = makeTransactionalMockDb([
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
          claimed_at: "2026-07-10T00:00:00.000Z",
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
    expect(event?.claimedAt).toBe("2026-07-10T00:00:00.000Z");
    expect(calls.map((c) => c.text.trim())).toEqual([
      "BEGIN",
      expect.stringContaining("FOR UPDATE SKIP LOCKED"),
      expect.stringContaining("status = 'dispatched'"),
      "COMMIT",
    ]);
    expect(wasReleased()).toBe(true);
  });

  it("claimNextQueued: lease切れdispatchedは純粋判定を通してattemptsを増やす", async () => {
    const { db, calls } = makeTransactionalMockDb([
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
          claimed_at: "2026-07-10T00:00:00.000Z",
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
    expect(calls[1]!.text).toContain("FOR UPDATE SKIP LOCKED");
    expect(calls[2]!.text).toContain("attempts = $2");
    expect(calls[2]!.params).toContain(3);
  });

  it("claimNextQueued: lease切れdispatchedがmaxAttempts到達ならdeadにし、dispatch対象を返さない", async () => {
    const { db, calls } = makeTransactionalMockDb([
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
    expect(calls[2]!.text).toContain("status = 'dead'");
    expect(calls[2]!.params).toContain(5);
    expect(calls.at(-1)!.text.trim()).toBe("COMMIT");
  });

  it("claimNextQueued: SELECTでclaimable行だけに絞り、古い非claimable行による飢餓を避ける", async () => {
    const { db, calls } = makeTransactionalMockDb([
      [
        {
          event_id: "evt-due",
          trace_id: "11111111-1111-4111-8111-111111111111",
          source: "inbound",
          payload: "{}",
          status: "queued",
          attempts: 0,
          next_attempt_at: "2026-07-10T00:00:00.000Z",
          claimed_at: null,
        },
      ],
      [
        {
          event_id: "evt-due",
          trace_id: "11111111-1111-4111-8111-111111111111",
          source: "inbound",
          payload: "{}",
          status: "dispatched",
          attempts: 0,
          claimed_at: "2026-07-10T00:00:00.000Z",
        },
      ],
    ]);
    const repo = new EventsRepo(db);

    await repo.claimNextQueued({ now: new Date("2026-07-10T00:00:00Z"), leaseMs: 60_000, maxAttempts: 5 });

    const select = calls[1]!;
    expect(select.text).toContain("next_attempt_at <= $1::timestamptz");
    expect(select.text).toContain("claimed_at < $2::timestamptz");
    expect(select.text).toContain("ORDER BY received_at LIMIT 10 FOR UPDATE SKIP LOCKED");
    expect(select.params).toEqual(["2026-07-10T00:00:00.000Z", "2026-07-09T23:59:00.000Z"]);
  });

  it("claimNextQueued: UPDATE失敗時はROLLBACKしてclientをreleaseする", async () => {
    const { db, calls, wasReleased, releaseError } = makeTransactionalMockDb(
      [
        [
          {
            event_id: "evt-fail",
            trace_id: "11111111-1111-4111-8111-111111111111",
            source: "inbound",
            payload: "{}",
            status: "queued",
            attempts: 0,
            next_attempt_at: null,
            claimed_at: null,
          },
        ],
      ],
      { failOnQueryContaining: "SET status = 'dispatched'" },
    );
    const repo = new EventsRepo(db);

    await expect(repo.claimNextQueued({ now: new Date("2026-07-10T00:00:00Z") })).rejects.toThrow("update failed");

    expect(calls.at(-1)!.text.trim()).toBe("ROLLBACK");
    expect(wasReleased()).toBe(true);
    expect(releaseError()).toBeUndefined();
  });

  it("claimNextQueued: ROLLBACK失敗時はpoison接続としてreleaseする", async () => {
    const { db, wasReleased, releaseError } = makeTransactionalMockDb(
      [
        [
          {
            event_id: "evt-rollback-fail",
            trace_id: "11111111-1111-4111-8111-111111111111",
            source: "inbound",
            payload: "{}",
            status: "queued",
            attempts: 0,
            next_attempt_at: null,
            claimed_at: null,
          },
        ],
      ],
      { failOnQueryContaining: "SET status = 'dispatched'", failRollback: true },
    );
    const repo = new EventsRepo(db);

    await expect(repo.claimNextQueued({ now: new Date("2026-07-10T00:00:00Z") })).rejects.toThrow("rollback failed");

    expect(wasReleased()).toBe(true);
    expect(releaseError()?.message).toBe("rollback failed");
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
    expect(calls[0]!.text).toContain("status = 'dispatched'");
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

  it("markFailed: claimed_atが一致しないstale workerは現行状態を上書きしない", async () => {
    const { db, calls } = makeMockDb([]);
    const repo = new EventsRepo(db);

    const result = await repo.markFailed("evt-1", {
      maxAttempts: 5,
      nextAttemptAt: new Date("2026-07-10T00:01:00Z"),
      claimedAt: "2026-07-10T00:00:00.000Z",
    });

    expect(result).toEqual({ status: "stale", attempts: 0 });
    expect(calls[0]!.text).toContain("claimed_at = $4::timestamptz");
    expect(calls[0]!.params).toEqual(["evt-1", 5, "2026-07-10T00:01:00.000Z", "2026-07-10T00:00:00.000Z"]);
  });
});

describe("decideEventDisposition (DevOps:SPEC-INT-010)", () => {
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

describe("enqueue payload sanitization [DevOps:REQ-030 / PrjOps:REQ-032 / DevOps:SPEC-INT-010]", () => {
  const leaked = `gh${"p"}_${"a".repeat(36)}`;

  it("GitHub webhook payloadの秘密をDB保存前にREDACTする", async () => {
    const { db, calls } = makeMockDb([{ event_id: "e1" }]);
    const repo = new EventsRepo(db);

    await repo.enqueue(
      "github",
      { eventName: "push", payload: { head_commit: { message: `token ${leaked}` } } },
      "t-1",
      {
        dedupeKey: "github:d1",
      },
    );

    const stored = String(calls[0]!.params![2]);
    expect(stored).not.toContain(leaked);
    expect(stored).toContain("***REDACTED:");
  });

  it("dedupeKeyなしの経路でも同じゲートを通る", async () => {
    const { db, calls } = makeMockDb();
    const repo = new EventsRepo(db);

    await repo.enqueue("inbound", { note: `secret ${leaked}` }, "t-2");

    const stored = String(calls[0]!.params![2]);
    expect(stored).not.toContain(leaked);
  });

  it("REDACT後もJSONとして妥当なまま構造を保つ", async () => {
    const { db, calls } = makeMockDb();
    const repo = new EventsRepo(db);

    await repo.enqueue("github", { eventName: "push", nested: { token: leaked } }, "t-3");

    const parsed = JSON.parse(String(calls[0]!.params![2])) as { eventName: string; nested: { token: string } };
    expect(parsed.eventName).toBe("push");
    expect(parsed.nested.token).toContain("***REDACTED:");
  });

  it("サニタイズ済みテキストへの二重適用でも壊れない（冪等）", async () => {
    const { db, calls } = makeMockDb();
    const repo = new EventsRepo(db);

    await repo.enqueue("graph", { body: "***REDACTED:github_pat***" }, "t-4");

    const parsed = JSON.parse(String(calls[0]!.params![2])) as { body: string };
    expect(parsed.body).toBe("***REDACTED:github_pat***");
  });
});
