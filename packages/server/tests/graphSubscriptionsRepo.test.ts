/**
 * packages/server/tests/graphSubscriptionsRepo.test.ts
 *
 * 根拠: ADR-0005（Graphサブスクリプション台帳のCRUD。renew対象抽出・deltaLink永続化・mode切替の正本）
 */
import { describe, it, expect } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { GraphSubscriptionsRepo } from "../src/db/graphSubscriptionsRepo.js";

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

const SAMPLE_ROW = {
  subscription_id: "sub-1",
  resource: "teams('t-1')/channels('c-1')/messages",
  team_id: "t-1",
  channel_id: "c-1",
  expires_at: "2026-07-07T01:00:00.000Z",
  delta_link: "https://graph.microsoft.com/delta-token",
  mode: "notification",
  updated_at: "2026-07-07T00:00:00.000Z",
};

describe("GraphSubscriptionsRepo (ADR-0005)", () => {
  it("upsert: INSERT ... ON CONFLICT でクエリを発行する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new GraphSubscriptionsRepo(db);
    await repo.upsert({
      subscriptionId: "sub-1",
      resource: "teams('t-1')/channels('c-1')/messages",
      teamId: "t-1",
      channelId: "c-1",
      expiresAt: "2026-07-07T01:00:00.000Z",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("INSERT INTO graph_subscriptions");
    expect(calls[0]!.text).toContain("ON CONFLICT (subscription_id)");
    expect(calls[0]!.params).toEqual([
      "sub-1",
      "teams('t-1')/channels('c-1')/messages",
      "t-1",
      "c-1",
      "2026-07-07T01:00:00.000Z",
      null,
      "notification",
    ]);
  });

  it("findBySubscriptionId: 見つかればドメイン型へマッピングする", async () => {
    const { db } = makeMockDb([SAMPLE_ROW]);
    const repo = new GraphSubscriptionsRepo(db);
    const sub = await repo.findBySubscriptionId("sub-1");
    expect(sub).toEqual({
      subscriptionId: "sub-1",
      resource: "teams('t-1')/channels('c-1')/messages",
      teamId: "t-1",
      channelId: "c-1",
      expiresAt: "2026-07-07T01:00:00.000Z",
      deltaLink: "https://graph.microsoft.com/delta-token",
      mode: "notification",
      updatedAt: "2026-07-07T00:00:00.000Z",
    });
  });

  it("findBySubscriptionId: 見つからなければnull", async () => {
    const { db } = makeMockDb([]);
    const repo = new GraphSubscriptionsRepo(db);
    expect(await repo.findBySubscriptionId("missing")).toBeNull();
  });

  it("listByMode: modeでフィルタするクエリを発行する", async () => {
    const { db, calls } = makeMockDb([SAMPLE_ROW]);
    const repo = new GraphSubscriptionsRepo(db);
    const subs = await repo.listByMode("notification");
    expect(subs).toHaveLength(1);
    expect(calls[0]!.text).toContain("WHERE mode = $1");
    expect(calls[0]!.params).toEqual(["notification"]);
  });

  it("updateDeltaLink: delta_linkとupdated_atを更新する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new GraphSubscriptionsRepo(db);
    await repo.updateDeltaLink("sub-1", "new-delta-token");
    expect(calls[0]!.text).toContain("SET delta_link = $2");
    expect(calls[0]!.params).toEqual(["sub-1", "new-delta-token"]);
  });

  it("switchMode: modeを更新する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new GraphSubscriptionsRepo(db);
    await repo.switchMode("sub-1", "polling");
    expect(calls[0]!.text).toContain("SET mode = $2");
    expect(calls[0]!.params).toEqual(["sub-1", "polling"]);
  });

  it("updateExpiresAt: expires_atを更新する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new GraphSubscriptionsRepo(db);
    await repo.updateExpiresAt("sub-1", "2026-07-07T02:00:00.000Z");
    expect(calls[0]!.text).toContain("SET expires_at = $2");
    expect(calls[0]!.params).toEqual(["sub-1", "2026-07-07T02:00:00.000Z"]);
  });
});
