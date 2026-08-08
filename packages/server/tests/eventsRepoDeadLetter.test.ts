/**
 * packages/server/tests/eventsRepoDeadLetter.test.ts
 *
 * 根拠: DevOps:SPEC-INT-010 / ADV-OPS-008。dead event の検知と手動再投入を検証する。
 */
import type { PgQueryable } from "@aiops/shared";
import { describe, expect, it } from "vitest";
import { EventsRepo } from "../src/db/eventsRepo.js";

interface Call {
  text: string;
  params: unknown[] | undefined;
}

function makeMockDb(rows: Array<Record<string, unknown>>) {
  const calls: Call[] = [];
  const db: PgQueryable = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return { rows };
    },
  };
  return { db, calls };
}

function makeRequeueDb(row?: Record<string, unknown>, failAudit = false) {
  const calls: Call[] = [];
  let released = false;
  const client = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      if (text.includes("UPDATE events")) return { rows: row ? [row] : [] };
      if (text.includes("INSERT INTO audit_log")) {
        if (failAudit) throw new Error("audit failed");
        return { rows: [{ log_id: 1 }] };
      }
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };
  const db: PgQueryable & { connect(): Promise<typeof client> } = {
    query: async () => ({ rows: [] }),
    connect: async () => client,
  };
  return { db, calls, wasReleased: () => released };
}

describe("EventsRepo dead-letter recovery [DevOps:SPEC-INT-010]", () => {
  it("dead だけを queued に戻し、累積 attempts を保持する", async () => {
    const { db, calls, wasReleased } = makeRequeueDb({ event_id: "evt-dead", attempts: 5 });
    const repo = new EventsRepo(db);

    const result = await repo.requeueDead("evt-dead", {
      actor: "operator-1",
      reason: "INC-123: upstream outage resolved",
      traceId: "11111111-1111-4111-8111-111111111111",
      now: new Date("2026-08-07T00:00:00Z"),
    });

    expect(result).toEqual({ eventId: "evt-dead", attempts: 5 });
    expect(calls[0]!.text).toBe("BEGIN");
    expect(calls[1]!.text).toContain("SET status = 'queued'");
    expect(calls[1]!.text).toContain("WHERE event_id = $1 AND status = 'dead'");
    expect(calls[1]!.text).not.toMatch(/SET[\s\S]*attempts\s*=/);
    expect(calls[1]!.params).toEqual(["evt-dead", "2026-08-07T00:00:00.000Z"]);
    expect(calls[2]!.text).toContain("INSERT INTO audit_log");
    expect(calls[2]!.params?.slice(0, 5)).toEqual([
      "devops_1y",
      "11111111-1111-4111-8111-111111111111",
      "operator-1",
      "status_override",
      "DevOps:SPEC-INT-010",
    ]);
    expect(JSON.parse(String(calls[2]!.params?.[5]))).toMatchObject({
      eventId: "evt-dead",
      fromStatus: "dead",
      toStatus: "queued",
      attemptsPolicy: "preserve",
      reason: "INC-123: upstream outage resolved",
    });
    expect(calls[3]!.text).toBe("COMMIT");
    expect(wasReleased()).toBe(true);
  });

  it("dead 以外には status predicate により干渉しない", async () => {
    const { db, calls } = makeRequeueDb();
    const repo = new EventsRepo(db);

    await expect(
      repo.requeueDead("evt-not-dead", {
        actor: "operator-1",
        reason: "INC-123: verify stale recovery request",
        traceId: "11111111-1111-4111-8111-111111111111",
        now: new Date("2026-08-07T00:00:00Z"),
      }),
    ).resolves.toBeNull();

    expect(calls[1]!.text).toContain("status = 'dead'");
    expect(calls.some((call) => call.text.includes("INSERT INTO audit_log"))).toBe(false);
    expect(calls.at(-1)!.text).toBe("COMMIT");
  });

  it("reason が空なら監査も状態変更も行わない", async () => {
    const { db, calls } = makeRequeueDb({ event_id: "evt-dead", attempts: 5 });
    const repo = new EventsRepo(db);

    await expect(
      repo.requeueDead("evt-dead", {
        actor: "operator-1",
        reason: " ",
        traceId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow(/E-AUD01/);

    expect(calls).toHaveLength(0);
  });

  it("actor が空なら監査も状態変更も行わない", async () => {
    const { db, calls } = makeRequeueDb({ event_id: "evt-dead", attempts: 5 });
    const repo = new EventsRepo(db);

    await expect(
      repo.requeueDead("evt-dead", {
        actor: " ",
        reason: "INC-123: upstream outage resolved",
        traceId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("valid actor identifier");

    expect(calls).toHaveLength(0);
  });

  it("actor が識別子形式でなければ監査も状態変更も行わない [DevOps:SPEC-INT-010]", async () => {
    const { db, calls } = makeRequeueDb({ event_id: "evt-dead", attempts: 5 });
    const repo = new EventsRepo(db);

    await expect(
      repo.requeueDead("evt-dead", {
        actor: "operator name\nforged",
        reason: "INC-123: upstream outage resolved",
        traceId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("valid actor identifier");

    expect(calls).toHaveLength(0);
  });

  it("secretを含むreasonをredactして再投入と監査追記を成功させる [DevOps:SPEC-INT-010]", async () => {
    const { db, calls } = makeRequeueDb({ event_id: "evt-dead", attempts: 5 });
    const repo = new EventsRepo(db);
    // Runtimeでは sanitizer の検知対象を再現しつつ、静的secret scannerには偽資格情報を直書きしない。
    const secret = ["api", "_key=", "fake-example-", "credential-123456"].join("");

    await expect(
      repo.requeueDead("evt-dead", {
        actor: "operator-1",
        reason: `INC-123: rotated ${secret}`,
        traceId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toEqual({ eventId: "evt-dead", attempts: 5 });

    const detail = String(calls.find((call) => call.text.includes("INSERT INTO audit_log"))?.params?.[5]);
    expect(detail).toContain("***REDACTED:generic_api_key_kv***");
    expect(detail).not.toContain(secret);
    expect(calls.at(-1)!.text).toBe("COMMIT");
  });

  it("監査追記に失敗したら状態変更も rollback する", async () => {
    const { db, calls, wasReleased } = makeRequeueDb({ event_id: "evt-dead", attempts: 5 }, true);
    const repo = new EventsRepo(db);

    await expect(
      repo.requeueDead("evt-dead", {
        actor: "operator-1",
        reason: "INC-123: upstream outage resolved",
        traceId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("audit failed");

    expect(calls.at(-1)!.text).toBe("ROLLBACK");
    expect(wasReleased()).toBe(true);
  });

  it("queue metrics が dead depth を実値として集計する", async () => {
    const { db, calls } = makeMockDb([{ status: "dead", depth: 2, oldest_age_seconds: 300 }]);
    const repo = new EventsRepo(db);

    await expect(repo.getQueueMetrics(new Date("2026-08-07T00:00:00Z"))).resolves.toEqual([
      { status: "dead", depth: 2, oldestAgeSeconds: 300 },
    ]);

    expect(calls[0]!.text).toContain("'dead'");
  });
});
