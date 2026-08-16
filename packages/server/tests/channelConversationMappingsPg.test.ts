/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / ADR-0025 / UX-001 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ChannelConversationMappingsRepo,
  type ChannelConversationMappingRegistration,
} from "../src/db/channelConversationMappingsRepo.js";
import { ChannelMessagesRepo } from "../src/db/channelMessagesRepo.js";
import { applySchemaSerialized } from "./pgTestSchema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const isolatedSchema = `p7t02_${randomUUID().replaceAll("-", "")}`;
const adminPool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : undefined;
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 4, options: `-c search_path=${isolatedSchema}` })
  : undefined;
const TRACE = "72000000-0000-4000-8000-000000000002";

const mapping: ChannelConversationMappingRegistration = {
  address: {
    source: "teams",
    platformConversationId: "conversation-1",
    platformThreadId: "thread-1",
  },
  identity: {
    provider: "microsoft-entra",
    tenantId: "tenant-1",
    subjectId: "user-1",
  },
  conversationId: "conversation-internal-1",
  threadId: "thread-internal-1",
  workflowId: "incident/p7t02",
};

describe.skipIf(!databaseUrl)("Channel mapping real PostgreSQL security [FinalArch:FR-UI-001 / UX-001]", () => {
  beforeAll(async () => {
    await adminPool!.query(`CREATE SCHEMA "${isolatedSchema}"`);
    const migration = new URL(
      "../../devops/src/db/migrations/202608160300_channel_identity_thread_mapping.sql",
      import.meta.url,
    );
    await applySchemaSerialized(pool!, [
      new URL("../../devops/src/db/schema.sql", import.meta.url),
      migration,
      migration,
    ]);
    await pool!.query(
      `INSERT INTO workflow_runs (
         workflow_id, run_id, workflow_type, business_key, project_id, status,
         trace_id, correlation_id, started_at
       ) VALUES ('incident/p7t02', 'run-p7t02', 'incident', 'p7t02', 'PJ-P7', 'running', $1, $1, now())`,
      [TRACE],
    );
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`DROP SCHEMA IF EXISTS "${isolatedSchema}" CASCADE`);
    await adminPool?.end();
  });

  it("keeps one immutable mapping under concurrent registration and exact replay", async () => {
    const repo = new ChannelConversationMappingsRepo(pool!);
    const outcomes = await Promise.all([repo.register(mapping), repo.register(mapping)]);
    expect(outcomes.sort()).toEqual(["created", "replayed"]);

    const before = await pool!.query(
      "SELECT xmin::text, created_at FROM channel_conversation_mappings WHERE workflow_id = $1",
      [mapping.workflowId],
    );
    await expect(repo.register(mapping)).resolves.toBe("replayed");
    const after = await pool!.query(
      "SELECT xmin::text, created_at FROM channel_conversation_mappings WHERE workflow_id = $1",
      [mapping.workflowId],
    );
    expect(after.rows).toEqual(before.rows);
  });

  it("returns the same null for wrong user, wrong thread, cross-tenant, and missing address", async () => {
    const repo = new ChannelConversationMappingsRepo(pool!);
    await expect(repo.lookup(mapping.address, mapping.identity)).resolves.toEqual(mapping);

    const denied = await Promise.all([
      repo.lookup(mapping.address, { ...mapping.identity, subjectId: "wrong-user" }),
      repo.lookup({ ...mapping.address, platformThreadId: "wrong-thread" }, mapping.identity),
      repo.lookup(mapping.address, { ...mapping.identity, tenantId: "wrong-tenant" }),
      repo.lookup({ ...mapping.address, platformConversationId: "missing" }, mapping.identity),
    ]);
    expect(denied).toEqual([null, null, null, null]);
  });

  it("deduplicates concurrent source messages and rejects a cross-channel identity collision", async () => {
    await pool!.query(
      `INSERT INTO project_channels (team_id, channel_id, project_id, created_by)
       VALUES ('team-1', 'channel-1', 'PJ-P7', 'p7t02'), ('team-2', 'channel-2', 'PJ-P7', 'p7t02')`,
    );
    const repo = new ChannelMessagesRepo(pool!);
    const message = {
      source: "teams",
      teamId: "team-1",
      channelId: "channel-1",
      messageId: "message-1",
      replyToId: "thread-1",
      authorAadId: "user-1",
      authorName: "Operator",
      contentType: "text" as const,
      content: "status",
      createdAt: "2026-08-16T00:00:00.000Z",
      lastModifiedAt: null,
      deletedAt: null,
    };

    await Promise.all([repo.upsert(message), repo.upsert(message)]);
    const count = await pool!.query(
      "SELECT count(*)::int AS n FROM channel_messages WHERE source = 'teams' AND message_id = 'message-1'",
    );
    expect(count.rows[0]!.n).toBe(1);
    await expect(repo.upsert({ ...message, teamId: "team-2", channelId: "channel-2" })).rejects.toThrow(
      "source message identity conflict",
    );
  });
});
