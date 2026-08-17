/** 根拠: FinalArch:COD-001 / FinalArch:COD-002 / FinalArch:COD-003 / ADR-0027 / WBS P8-T07 */
import { randomUUID } from "node:crypto";

import { InMemoryAuditLog, type AuditLogWriter, type PgQueryable } from "@aiops/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  AgentHandoffsRepo,
  HandoffCasConflictError,
  WriterClaimConflictError,
  type HandoffSnapshot,
  type HandoffTransactionRunner,
} from "../src/db/agentHandoffsRepo.js";
import { applySchemaSerialized } from "./pgTestSchema.js";

const SHA = { base: "1".repeat(40), first: "2".repeat(40), second: "3".repeat(40) };
const TRACE = "11111111-1111-4111-8111-111111111111";

const assigned: HandoffSnapshot = {
  taskId: "P8-T07",
  writer: "codex-deep-dot",
  reviewer: "claude-deep-dot",
  state: "writer_assigned",
  range: { baseSha: SHA.base, headSha: SHA.base },
  reviewRange: null,
  version: 1,
};

const assignedRow = {
  task_id: assigned.taskId,
  writer: assigned.writer,
  reviewer: assigned.reviewer,
  state: assigned.state,
  base_sha: SHA.base,
  head_sha: SHA.base,
  review_base_sha: null,
  review_head_sha: null,
  version: 1,
  trace_id: TRACE,
  created_at: "2026-08-18T00:00:00.000Z",
  updated_at: "2026-08-18T00:00:00.000Z",
};

const startEvidenceRow = {
  event: "start_work",
  from_state: "writer_assigned",
  to_state: "in_progress",
  actor: assigned.writer,
  old_writer: null,
  new_writer: null,
  reason: null,
  base_sha: SHA.base,
  head_sha: SHA.base,
  expected_version: 1,
  resulting_version: 2,
  trace_id: TRACE,
};

function transaction(db: PgQueryable, auditLog: AuditLogWriter): HandoffTransactionRunner {
  return async (work) => work({ db, auditLog });
}

function mockRepo(results: Array<{ rows: Record<string, unknown>[]; rowCount?: number }>) {
  const query = vi.fn(async () => results.shift() ?? { rows: [], rowCount: 0 });
  const db = { query } as PgQueryable;
  const audit = new InMemoryAuditLog();
  return { repo: new AgentHandoffsRepo(db, transaction(db, audit)), query, audit };
}

function claim(taskId = "P8-T07", writer = "codex-deep-dot", reviewer = "claude-deep-dot") {
  return {
    taskId,
    writer,
    reviewer,
    actor: writer,
    range: { baseSha: SHA.base, headSha: SHA.base },
    traceId: TRACE,
  };
}

function mutation(
  current: HandoffSnapshot,
  next: HandoffSnapshot,
  event: "start_work" | "submit_for_review" | "approve",
  actor: string,
) {
  return { current, next, event, actor, oldWriter: null, newWriter: null, reason: null, traceId: TRACE };
}

describe("AgentHandoffsRepo [FinalArch:COD-001 / FinalArch:COD-002]", () => {
  it("claims one writer and appends the transition and audit in the injected transaction", async () => {
    const { repo, query, audit } = mockRepo([
      { rows: [assignedRow], rowCount: 1 },
      { rows: [], rowCount: 1 },
    ]);

    await expect(repo.claimWriter(claim())).resolves.toMatchObject(assigned);
    expect(String(query.mock.calls[0]?.[0])).toContain("INSERT INTO agent_handoffs");
    expect(String(query.mock.calls[1]?.[0])).toContain("INSERT INTO agent_handoff_transitions");
    expect(await audit.readAll()).toEqual([
      expect.objectContaining({ action: "agent_handoff_writer_assigned", actor: "codex-deep-dot" }),
    ]);
  });

  it("rejects a duplicate writer claim without transition or audit", async () => {
    const { repo, query, audit } = mockRepo([{ rows: [], rowCount: 0 }, { rows: [assignedRow] }]);

    await expect(repo.claimWriter(claim("P8-T07", "claude-deep-dot", "codex-deep-dot"))).rejects.toBeInstanceOf(
      WriterClaimConflictError,
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(await audit.readAll()).toEqual([]);
  });

  it("recovers the exact writer claim after a committed response loss without duplicate evidence", async () => {
    const { repo, query, audit } = mockRepo([{ rows: [], rowCount: 0 }, { rows: [assignedRow] }]);

    await expect(repo.claimWriter(claim())).resolves.toMatchObject(assigned);
    expect(query).toHaveBeenCalledTimes(2);
    expect(await audit.readAll()).toEqual([]);
  });

  it("updates the exact current snapshot with version CAS before append-only evidence", async () => {
    const next: HandoffSnapshot = { ...assigned, state: "in_progress", version: 2 };
    const row = { ...assignedRow, state: "in_progress", version: 2 };
    const { repo, query, audit } = mockRepo([
      { rows: [row], rowCount: 1 },
      { rows: [], rowCount: 1 },
    ]);

    await expect(repo.transition(mutation(assigned, next, "start_work", assigned.writer))).resolves.toMatchObject(next);
    expect(String(query.mock.calls[0]?.[0])).toContain("version = $9");
    expect(String(query.mock.calls[0]?.[0])).toContain("review_head_sha IS NOT DISTINCT FROM $18");
    expect(String(query.mock.calls[1]?.[0])).toContain("INSERT INTO agent_handoff_transitions");
    expect(await audit.readAll()).toEqual([expect.objectContaining({ action: "agent_handoff_start_work" })]);
  });

  it("rejects a stale CAS in a second statement without transition or audit", async () => {
    const next: HandoffSnapshot = { ...assigned, state: "in_progress", version: 2 };
    const { repo, query, audit } = mockRepo([{ rows: [], rowCount: 0 }, { rows: [assignedRow] }]);

    await expect(repo.transition(mutation(assigned, next, "start_work", assigned.writer))).rejects.toBeInstanceOf(
      HandoffCasConflictError,
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(await audit.readAll()).toEqual([]);
  });

  it("recovers an exact committed transition after response loss without duplicate evidence", async () => {
    const next: HandoffSnapshot = { ...assigned, state: "in_progress", version: 2 };
    const nextRow = { ...assignedRow, state: "in_progress", version: 2 };
    const { repo, query, audit } = mockRepo([
      { rows: [], rowCount: 0 },
      { rows: [nextRow] },
      { rows: [startEvidenceRow] },
    ]);

    await expect(repo.transition(mutation(assigned, next, "start_work", assigned.writer))).resolves.toMatchObject(next);
    expect(query).toHaveBeenCalledTimes(3);
    expect(await audit.readAll()).toEqual([]);
  });

  it("rejects a matching next snapshot when the committed transition evidence differs", async () => {
    const next: HandoffSnapshot = { ...assigned, state: "in_progress", version: 2 };
    const nextRow = { ...assignedRow, state: "in_progress", version: 2 };
    const { repo, audit } = mockRepo([
      { rows: [], rowCount: 0 },
      { rows: [nextRow] },
      { rows: [{ ...startEvidenceRow, trace_id: "22222222-2222-4222-8222-222222222222" }] },
    ]);

    await expect(repo.transition(mutation(assigned, next, "start_work", assigned.writer))).rejects.toBeInstanceOf(
      HandoffCasConflictError,
    );
    expect(await audit.readAll()).toEqual([]);
  });

  it("rejects implicit role changes and incomplete takeover before querying", async () => {
    const { repo, query } = mockRepo([]);
    const started = { ...assigned, state: "in_progress" as const, version: 2 };
    await expect(
      repo.transition({
        ...mutation(started, { ...started, writer: started.reviewer, version: 3 }, "submit_for_review", started.writer),
      }),
    ).rejects.toThrow(/role/u);
    await expect(
      repo.transition({
        current: { ...assigned, state: "ready_for_review", reviewRange: assigned.range, version: 3 },
        next: { ...assigned, state: "in_progress", version: 4 },
        event: "reviewer_takeover",
        actor: assigned.reviewer,
        oldWriter: null,
        newWriter: assigned.reviewer,
        reason: "reassigned",
        traceId: TRACE,
      }),
    ).rejects.toThrow(/takeover/u);
    expect(query).not.toHaveBeenCalled();
  });
});

const databaseUrl = process.env.TEST_DATABASE_URL;
const isolatedSchema = `p8t07_${randomUUID().replaceAll("-", "")}`;
const adminPool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : undefined;
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 6, options: `-c search_path=${isolatedSchema}` })
  : undefined;

describe.skipIf(!databaseUrl)("AgentHandoffsRepo real PostgreSQL authority [FinalArch:COD-001 / COD-003]", () => {
  function realTransaction(auditLog: AuditLogWriter): HandoffTransactionRunner {
    return async (work) => {
      const client = await pool!.connect();
      try {
        await client.query("BEGIN");
        const result = await work({ db: client, auditLog });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    };
  }

  beforeAll(async () => {
    await adminPool!.query(`CREATE SCHEMA "${isolatedSchema}"`);
    await applySchemaSerialized(pool!, [
      new URL("../../devops/src/db/schema.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608180000_agent_handoffs.sql", import.meta.url),
    ]);
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`DROP SCHEMA IF EXISTS "${isolatedSchema}" CASCADE`);
    await adminPool?.end();
  });

  it("allows exactly one concurrent writer claim for one task", async () => {
    const audit = new InMemoryAuditLog();
    const repo = new AgentHandoffsRepo(pool!, realTransaction(audit));
    const results = await Promise.allSettled([
      repo.claimWriter(claim("P8-T07-CONCURRENT-A")),
      repo.claimWriter(claim("P8-T07-CONCURRENT-A", "claude-deep-dot", "codex-deep-dot")),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(
      WriterClaimConflictError,
    );
    await expect(
      pool!.query("SELECT count(*)::int AS count FROM agent_handoff_transitions WHERE task_id = $1", [
        "P8-T07-CONCURRENT-A",
      ]),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    expect((await audit.readAll()).filter((record) => record.action === "agent_handoff_writer_assigned")).toHaveLength(
      1,
    );
  });

  it("allows one version-CAS winner and rolls back state when audit append fails", async () => {
    const audit = new InMemoryAuditLog();
    const repo = new AgentHandoffsRepo(pool!, realTransaction(audit));
    const current = await repo.claimWriter(claim("P8-T07-CAS-A"));
    const next: HandoffSnapshot = { ...current, state: "in_progress", version: 2 };
    const command = mutation(current, next, "start_work", current.writer);
    const results = await Promise.allSettled([repo.transition(command), repo.transition(command)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    await expect(
      pool!.query("SELECT count(*)::int AS count FROM agent_handoff_transitions WHERE task_id = $1", [current.taskId]),
    ).resolves.toMatchObject({ rows: [{ count: 2 }] });
    expect((await audit.readAll()).filter((record) => record.action === "agent_handoff_start_work")).toHaveLength(1);

    const rollbackCurrent = await repo.claimWriter(claim("P8-T07-ROLLBACK-A"));
    const failingAudit: AuditLogWriter = {
      append: async () => Promise.reject(new Error("audit failed")),
      readAll: async () => [],
    };
    const failingRepo = new AgentHandoffsRepo(pool!, realTransaction(failingAudit));
    await expect(
      failingRepo.transition(
        mutation(
          rollbackCurrent,
          { ...rollbackCurrent, state: "in_progress", version: 2 },
          "start_work",
          rollbackCurrent.writer,
        ),
      ),
    ).rejects.toThrow("audit failed");
    await expect(
      pool!.query("SELECT state, version::int FROM agent_handoffs WHERE task_id = $1", [rollbackCurrent.taskId]),
    ).resolves.toMatchObject({
      rows: [{ state: "writer_assigned", version: 1 }],
    });
  });

  it("blocks UPDATE and DELETE of append-only transition evidence", async () => {
    for (const sql of [
      "UPDATE agent_handoff_transitions SET actor = 'tampered' WHERE task_id = 'P8-T07-CONCURRENT-A'",
      "DELETE FROM agent_handoff_transitions WHERE task_id = 'P8-T07-CONCURRENT-A'",
    ]) {
      await expect(pool!.query(sql)).rejects.toThrow(/append-only/u);
    }
  });
});
