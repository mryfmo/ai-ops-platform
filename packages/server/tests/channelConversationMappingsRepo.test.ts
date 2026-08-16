/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-006 / ADR-0025 / UX-001 */
import { describe, expect, it } from "vitest";

import type { PgQueryable } from "@aiops/shared";
import {
  ChannelConversationMappingsRepo,
  type ChannelConversationMappingRegistration,
} from "../src/db/channelConversationMappingsRepo.js";

const registration: ChannelConversationMappingRegistration = {
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
  workflowId: "incident/1",
};

const row = {
  source: "teams",
  platform_conversation_id: "conversation-1",
  platform_thread_id: "thread-1",
  identity_provider: "microsoft-entra",
  tenant_id: "tenant-1",
  subject_id: "user-1",
  conversation_id: "conversation-internal-1",
  thread_id: "thread-internal-1",
  workflow_id: "incident/1",
};

function mockDb(results: Array<{ rows: Array<Record<string, unknown>>; rowCount?: number }> = []) {
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  const db: PgQueryable = {
    query: async (text, params) => {
      calls.push({ text, params });
      return results.shift() ?? { rows: [] };
    },
  };
  return { db, calls };
}

describe("ChannelConversationMappingsRepo [FinalArch:FR-UI-001 / UX-001]", () => {
  it("requires source/address/provider/tenant/subject in the authoritative lookup", async () => {
    const { db, calls } = mockDb([{ rows: [row] }]);
    const repo = new ChannelConversationMappingsRepo(db);

    await expect(repo.lookup(registration.address, registration.identity)).resolves.toEqual(registration);
    expect(calls[0]!.text).toContain("platform_thread_id IS NOT DISTINCT FROM $3");
    expect(calls[0]!.text).toContain("identity_provider = $4");
    expect(calls[0]!.text).toContain("tenant_id = $5");
    expect(calls[0]!.text).toContain("subject_id = $6");
    expect(calls[0]!.params).toEqual(["teams", "conversation-1", "thread-1", "microsoft-entra", "tenant-1", "user-1"]);
  });

  it("returns null without querying when tenant identity is absent", async () => {
    const { db, calls } = mockDb();
    const repo = new ChannelConversationMappingsRepo(db);

    await expect(repo.lookup(registration.address, { ...registration.identity, tenantId: null })).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("registers once and reconciles an exact replay without changing authority", async () => {
    const { db, calls } = mockDb([{ rows: [], rowCount: 1 }, { rows: [], rowCount: 0 }, { rows: [row] }]);
    const repo = new ChannelConversationMappingsRepo(db);

    await expect(repo.register(registration)).resolves.toBe("created");
    await expect(repo.register(registration)).resolves.toBe("replayed");
    expect(calls[0]!.text).toContain("ON CONFLICT DO NOTHING");
    expect(calls[2]!.text).not.toMatch(/UPDATE|DELETE/u);
  });

  it("rejects a conflicting replay without exposing the existing workflow", async () => {
    const { db } = mockDb([{ rows: [], rowCount: 0 }, { rows: [row] }]);
    const repo = new ChannelConversationMappingsRepo(db);

    await expect(
      repo.register({ ...registration, identity: { ...registration.identity, subjectId: "attacker" } }),
    ).rejects.toThrow("conversation mapping conflict");
    expect("findByWorkflowId" in repo).toBe(false);
  });
});
