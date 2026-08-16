// 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001
import { describe, expect, it, vi } from "vitest";

import { checkCompleteness } from "@aiops/shared/reporting/statusIngestContract.js";
import { PgStatusIngestStore, type StatusIngestPgPool } from "../src/data/pgStatusIngestStore.js";

type DbResult = { rows: Record<string, unknown>[]; rowCount?: number | null };

const completeUpdate = {
  progress_pct: 50,
  self_status: "green" as const,
  achievements: "done",
  plans: "next",
  issues: "none",
  risks: "none",
};

function event(sourceMessageId = "source-1", threadId = "thread-1", complete = true) {
  return {
    channel: "email" as const,
    sourceMessageId,
    threadId,
    receivedAt: "2026-08-16T06:00:00Z",
    reporterId: "ST-010",
    projectId: "PJ-001",
    subject: "PJ-001 status",
    body: "sanitized fixture",
    update: complete ? completeUpdate : { ...completeUpdate, risks: null },
  };
}

function transaction(responses: Array<DbResult | Error>) {
  const query = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) query.mockRejectedValueOnce(response);
    else query.mockResolvedValueOnce(response);
  }
  const release = vi.fn();
  const client = { query, release };
  const pool = { query: vi.fn(), connect: vi.fn().mockResolvedValue(client) } as unknown as StatusIngestPgPool;
  return { pool, query, release };
}

function receiptRow(overrides: Record<string, unknown> = {}) {
  return {
    source_key: "status-ingest:email:source-1",
    thread_key: "status-ingest:email:thread-1",
    prior_clarify_count: "0",
    clarify_count: "0",
    action: "accept",
    state: "pending",
    revision: "1",
    ...overrides,
  };
}

describe("PgStatusIngestStore DB-less coverage [FinalArch:ING-001]", () => {
  it("[FinalArch:ING-001] maps thread and side-effect reads without a live database", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ clarify_count: "2" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ receipt: { schemaVersion: 1 } }] });
    const store = new PgStatusIngestStore({ query, connect: vi.fn() } as unknown as StatusIngestPgPool);

    await expect(store.readThread("status-ingest:email:thread-1")).resolves.toEqual({
      schemaVersion: 1,
      payload: { threadKey: "status-ingest:email:thread-1", clarifyCount: 2 },
    });
    await expect(store.findSideEffect("missing")).resolves.toBeNull();
    await expect(store.findSideEffect("present")).resolves.toEqual({ schemaVersion: 1 });
    expect(query.mock.calls[0]![1]).toEqual(["status-ingest:email:thread-1"]);
  });

  it("[FinalArch:ING-001] claims a new source under source and thread locks", async () => {
    const candidate = event();
    const tx = transaction([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [{ clarify_count: "0" }] },
      { rows: [receiptRow()] },
      { rows: [] },
    ]);

    await expect(
      new PgStatusIngestStore(tx.pool).claim({ event: candidate, completeness: checkCompleteness(candidate.update) }),
    ).resolves.toEqual({
      schemaVersion: 1,
      payload: {
        sourceKey: "status-ingest:email:source-1",
        threadKey: "status-ingest:email:thread-1",
        duplicate: false,
        priorClarifyCount: 0,
        clarifyCount: 0,
        action: "accept",
        state: "pending",
        revision: 1,
      },
    });
    expect(tx.query.mock.calls.map(([sql]) => String(sql).trim().split(/\s/u)[0])).toEqual([
      "BEGIN",
      "SELECT",
      "SELECT",
      "SELECT",
      "SELECT",
      "INSERT",
      "COMMIT",
    ]);
    expect(tx.query.mock.calls[1]![1]).toEqual(["status-ingest:email:source-1"]);
    expect(tx.query.mock.calls[2]![1]).toEqual(["status-ingest:email:thread-1"]);
    expect(tx.query.mock.calls[5]![1]).toEqual([
      "status-ingest:email:source-1",
      "status-ingest:email:thread-1",
      "email",
      "source-1",
      0,
      0,
      "accept",
    ]);
    expect(tx.release).toHaveBeenCalledOnce();
  });

  it("[FinalArch:ING-001] returns an existing source as duplicate without inserting", async () => {
    const candidate = event("source-1", "thread-1", false);
    const tx = transaction([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      {
        rows: [
          receiptRow({ prior_clarify_count: 1, clarify_count: 2, action: "clarify", state: "complete", revision: 2 }),
        ],
      },
      { rows: [] },
    ]);

    await expect(
      new PgStatusIngestStore(tx.pool).claim({ event: candidate, completeness: checkCompleteness(candidate.update) }),
    ).resolves.toMatchObject({
      payload: { duplicate: true, priorClarifyCount: 1, clarifyCount: 2, action: "clarify", state: "complete" },
    });
    expect(tx.query).toHaveBeenCalledTimes(5);
    expect(tx.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO"))).toBe(false);
    expect(tx.release).toHaveBeenCalledOnce();
  });

  it("[FinalArch:ING-001] rolls back and releases when a claim query fails", async () => {
    const candidate = event();
    const tx = transaction([{ rows: [] }, new Error("lock failed"), { rows: [] }]);

    await expect(
      new PgStatusIngestStore(tx.pool).claim({ event: candidate, completeness: checkCompleteness(candidate.update) }),
    ).rejects.toThrow("lock failed");
    expect(tx.query.mock.calls.map(([sql]) => String(sql))).toEqual([
      "BEGIN",
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      "ROLLBACK",
    ]);
    expect(tx.release).toHaveBeenCalledOnce();
  });

  it("[FinalArch:ING-001] records only matching side-effect receipts", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const store = new PgStatusIngestStore({ query, connect: vi.fn() } as unknown as StatusIngestPgPool);
    const value = {
      schemaVersion: 1,
      payload: {
        sourceKey: "status-ingest:email:source-1",
        idempotencyKey: "effect-1",
        effect: "canonical",
        reference: "SU-1",
      },
    };

    await expect(store.recordSideEffect("effect-1", value)).resolves.toBeUndefined();
    expect(query.mock.calls[0]![1]).toEqual(["status-ingest:email:source-1", "effect-1", JSON.stringify(value)]);
    await expect(store.recordSideEffect("effect-1", value)).rejects.toThrow(/conflicts/u);
    await expect(store.recordSideEffect("effect-1", {})).rejects.toThrow(/requires sourceKey/u);
  });

  it("[FinalArch:ING-001] completes by CAS, reconciles a lost response, and rejects divergence", async () => {
    const completed = {
      source_key: "status-ingest:email:source-1",
      revision: "2",
      state: "complete",
      canonical_reference: "SU-1",
      notification_reference: "notify-1",
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [completed], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [completed], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const store = new PgStatusIngestStore({ query, connect: vi.fn() } as unknown as StatusIngestPgPool);
    const input = {
      sourceKey: "status-ingest:email:source-1",
      expectedRevision: 1,
      canonicalReference: "SU-1",
      notificationReference: "notify-1",
    };

    await expect(store.complete(input)).resolves.toEqual({
      schemaVersion: 1,
      payload: { sourceKey: input.sourceKey, revision: 2, state: "complete" },
    });
    await expect(store.complete(input)).resolves.toMatchObject({ payload: { state: "complete" } });
    await expect(store.complete(input)).rejects.toThrow(/CAS conflict/u);
  });
});
