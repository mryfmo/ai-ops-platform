// 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001
import { readFileSync } from "node:fs";

import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { checkCompleteness } from "@aiops/shared/reporting/statusIngestContract.js";
import { PgStatusIngestStore } from "../src/data/pgStatusIngestStore.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 8 }) : undefined;
const migration = readFileSync(
  new URL("../../devops/src/db/migrations/202608160200_status_ingest_records.sql", import.meta.url),
  "utf8",
);

const complete = {
  progress_pct: 50,
  self_status: "green" as const,
  achievements: "done",
  plans: "next",
  issues: "none",
  risks: "none",
};

function event(sourceMessageId: string, threadId = "thread-1", completeUpdate = true) {
  return {
    channel: "email" as const,
    sourceMessageId,
    threadId,
    receivedAt: "2026-08-16T06:00:00Z",
    reporterId: "ST-010",
    projectId: "PJ-001",
    subject: "PJ-001 status",
    body: "sanitized fixture",
    update: completeUpdate ? complete : { ...complete, risks: null },
  };
}

describe.skipIf(!databaseUrl)("FinalArch:ING-001 status ingest real PostgreSQL authority", () => {
  beforeAll(async () => {
    await pool!.query(migration);
    await pool!.query(migration);
  });

  beforeEach(async () => {
    await pool!.query("DELETE FROM status_ingest_records");
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("allows exactly one winner for concurrent claims of the same source message", async () => {
    const store = new PgStatusIngestStore(pool!);
    const candidate = event("same-source");
    const input = { event: candidate, completeness: checkCompleteness(candidate.update) };
    const claims = (await Promise.all([store.claim(input), store.claim(input)])) as Array<{
      payload: { duplicate: boolean };
    }>;
    expect(claims.map(({ payload }) => payload.duplicate).sort()).toEqual([false, true]);
    const rows = await pool!.query("SELECT count(*)::integer AS n FROM status_ingest_records");
    expect(rows.rows[0]!.n).toBe(1);
  });

  it("serializes concurrent thread claims at clarify 1/2/3 then escalate without exceeding 3", async () => {
    const store = new PgStatusIngestStore(pool!);
    const claims = (await Promise.all(
      [0, 1, 2, 3].map((index) => {
        const candidate = event(`thread-source-${index}`, "shared-thread", false);
        return store.claim({ event: candidate, completeness: checkCompleteness(candidate.update) });
      }),
    )) as Array<{ payload: { priorClarifyCount: number; clarifyCount: number; action: string } }>;
    expect(claims.map(({ payload }) => payload.priorClarifyCount).sort()).toEqual([0, 1, 2, 3]);
    expect(claims.map(({ payload }) => payload.clarifyCount).sort()).toEqual([1, 2, 3, 3]);
    expect(claims.map(({ payload }) => payload.action).sort()).toEqual([
      "clarify",
      "clarify",
      "clarify",
      "escalate_incomplete",
    ]);
  });

  it("persists bounded side-effect receipts and makes terminal CAS idempotent but not divergent", async () => {
    const store = new PgStatusIngestStore(pool!);
    const candidate = event("receipt-source", "receipt-thread");
    const claim = (await store.claim({
      event: candidate,
      completeness: checkCompleteness(candidate.update),
    })) as { payload: { sourceKey: string; revision: number } };
    const key = "report/status-ingest:email:receipt-source#persistCanonicalStatusUpdate#0";
    const effect = {
      schemaVersion: 1,
      payload: {
        sourceKey: claim.payload.sourceKey,
        idempotencyKey: key,
        effect: "canonical",
        reference: "SU-1",
      },
    };
    await store.recordSideEffect(key, effect);
    await store.recordSideEffect(key, effect);
    await expect(store.findSideEffect(key)).resolves.toEqual(effect);

    const completion = {
      sourceKey: claim.payload.sourceKey,
      expectedRevision: claim.payload.revision,
      canonicalReference: "SU-1",
      notificationReference: "notification-1",
    };
    await expect(store.complete(completion)).resolves.toMatchObject({ payload: { revision: 2, state: "complete" } });
    await expect(store.complete(completion)).resolves.toMatchObject({ payload: { revision: 2, state: "complete" } });
    await expect(store.complete({ ...completion, notificationReference: "notification-divergent" })).rejects.toThrow(
      /CAS conflict/u,
    );
  });

  it("stores no original message content and rejects count/source identity constraint violations", async () => {
    const columns = await pool!.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'status_ingest_records'`,
    );
    expect(columns.rows.map(({ column_name }) => column_name)).not.toEqual(
      expect.arrayContaining(["body", "subject", "update", "event", "raw_payload"]),
    );
    await expect(
      pool!.query(
        `INSERT INTO status_ingest_records
           (source_key, thread_key, channel, source_message_id, prior_clarify_count, clarify_count, action)
         VALUES ('forged', 'status-ingest:email:t', 'email', 'm', 3, 4, 'clarify')`,
      ),
    ).rejects.toThrow(/check constraint/u);
  });
});
