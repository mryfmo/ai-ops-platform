/**
 * packages/server/tests/eventsRepo.test.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-010（eventsキューの at-least-once 再試行、DLQ、dedupe）。
 */
import { describe, expect, it } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { EventsRepo } from "../src/db/eventsRepo.js";

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
    const { db, calls } = makeMockDb([
      {
        event_id: "evt-1",
        trace_id: "11111111-1111-4111-8111-111111111111",
        source: "inbound",
        payload: "{}",
        status: "dispatched",
        attempts: 1,
      },
    ]);
    const repo = new EventsRepo(db);

    await repo.claimNextQueued({ now: new Date("2026-07-10T00:00:00Z"), leaseMs: 60_000 });

    expect(calls[0]!.text).toContain("next_attempt_at <= $");
    expect(calls[0]!.text).toContain("status = 'dispatched'");
    expect(calls[0]!.text).toContain("claimed_at <");
    expect(calls[0]!.text).toContain("attempts");
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
