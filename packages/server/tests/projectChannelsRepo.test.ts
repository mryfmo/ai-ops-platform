/**
 * packages/server/tests/projectChannelsRepo.test.ts
 *
 * 根拠: ADR-0005（project_channels台帳のCRUD）/ ADR-0006（findByProjectId:
 *   coding-task確認フローがprojectIdのみからGitHubリポジトリを解決するために使用）
 */
import { describe, it, expect } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { ProjectChannelsRepo } from "../src/db/projectChannelsRepo.js";

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
  team_id: "t-1",
  channel_id: "c-1",
  project_id: "PJ-001",
  created_by: "ST-001",
  ingestion: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  closed_at: null,
  github_owner: "acme",
  github_repo: "widget",
};

describe("ProjectChannelsRepo (ADR-0005 / ADR-0006)", () => {
  it("findByChannel: team+channelでactiveなチャネルのみ返す", async () => {
    const { db, calls } = makeMockDb([SAMPLE_ROW]);
    const repo = new ProjectChannelsRepo(db);
    const channel = await repo.findByChannel("t-1", "c-1");
    expect(channel?.projectId).toBe("PJ-001");
    expect(calls[0]!.text).toContain("WHERE team_id = $1 AND channel_id = $2 AND ingestion = 'active'");
  });

  it("findByChannel: 見つからなければnull", async () => {
    const { db } = makeMockDb([]);
    const repo = new ProjectChannelsRepo(db);
    expect(await repo.findByChannel("t-x", "c-x")).toBeNull();
  });

  it("findByProjectId: projectIdでactiveなチャネルを解決する (ADR-0006)", async () => {
    const { db, calls } = makeMockDb([SAMPLE_ROW]);
    const repo = new ProjectChannelsRepo(db);
    const channel = await repo.findByProjectId("PJ-001");
    expect(channel).toEqual({
      teamId: "t-1",
      channelId: "c-1",
      projectId: "PJ-001",
      createdBy: "ST-001",
      ingestion: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      closedAt: null,
      githubOwner: "acme",
      githubRepo: "widget",
    });
    expect(calls[0]!.text).toContain("WHERE project_id = $1 AND ingestion = 'active'");
    expect(calls[0]!.params).toEqual(["PJ-001"]);
  });

  it("findByProjectId: 未登録プロジェクトはnull（ADR-0006: GitHubリポジトリ未登録として扱われる）", async () => {
    const { db } = makeMockDb([]);
    const repo = new ProjectChannelsRepo(db);
    expect(await repo.findByProjectId("PJ-999")).toBeNull();
  });

  it("list: 全件をcreated_at順で返す", async () => {
    const { db, calls } = makeMockDb([SAMPLE_ROW]);
    const repo = new ProjectChannelsRepo(db);
    const channels = await repo.list();
    expect(channels).toHaveLength(1);
    expect(calls[0]!.text).toContain("ORDER BY created_at");
  });
});
