/**
 * packages/server/tests/channelAuthorization.test.ts
 *
 * 根拠: ADR-0005（project_channels未登録/paused/closedの取込拒否。RSC権限とのアプリ側二重防御）
 */
import { describe, it, expect } from "vitest";
import { decideChannelIngestion } from "../src/lib/channelAuthorization.js";
import type { ProjectChannel } from "../src/db/projectChannelsRepo.js";

function makeChannel(overrides: Partial<ProjectChannel> = {}): ProjectChannel {
  return {
    teamId: "t-1",
    channelId: "c-1",
    projectId: "PJ-001",
    createdBy: "ST-001",
    ingestion: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    githubOwner: null,
    githubRepo: null,
    ...overrides,
  };
}

describe("decideChannelIngestion (ADR-0005)", () => {
  it("未登録（null）は拒否", () => {
    const result = decideChannelIngestion(null);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("unregistered_channel");
  });

  it("ingestion=pausedは拒否", () => {
    const result = decideChannelIngestion(makeChannel({ ingestion: "paused" }));
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("ingestion_paused");
  });

  it("ingestion=closedは拒否", () => {
    const result = decideChannelIngestion(makeChannel({ ingestion: "closed" }));
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("ingestion_closed");
  });

  it("ingestion=activeは許可", () => {
    const result = decideChannelIngestion(makeChannel({ ingestion: "active" }));
    expect(result.accepted).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
