/** 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001 */
import { describe, expect, it } from "vitest";

import {
  normalizeEmailStatusPayload,
  normalizeGithubStatusPayload,
  normalizeTeamsStatusPayload,
} from "../src/reporting/statusIngestChannels.js";

const update = {
  progress_pct: 62,
  self_status: "yellow" as const,
  achievements: "設計完了",
  plans: "実装着手",
  issues: "なし",
  risks: "なし",
};

describe("FinalArch:ING-001 three-channel status ingest normalization", () => {
  it("email / Teams / GitHub payloads map to one normalized contract", () => {
    const common = {
      receivedAt: "2026-08-16T06:00:00Z",
      reporterId: "ST-010",
      projectIdHintFromSender: "PJ-303",
      structured: update,
    };
    expect(
      normalizeEmailStatusPayload({
        ...common,
        internetMessageId: "email-001",
        conversationId: "email-thread-001",
        subject: "PJ-101 weekly",
        body: "PJ-202 body",
      }),
    ).toMatchObject({
      channel: "email",
      sourceMessageId: "email-001",
      threadId: "email-thread-001",
      projectId: "PJ-101",
    });
    expect(
      normalizeTeamsStatusPayload({
        ...common,
        messageId: "teams-001",
        rootMessageId: "teams-thread-001",
        body: "weekly update",
      }),
    ).toMatchObject({
      channel: "teams",
      sourceMessageId: "teams-001",
      threadId: "teams-thread-001",
      projectId: "PJ-303",
    });
    expect(
      normalizeGithubStatusPayload({
        ...common,
        deliveryId: "github-001",
        discussionId: "github-thread-001",
        title: "status",
        body: "for PJ-202",
      }),
    ).toMatchObject({
      channel: "github",
      sourceMessageId: "github-001",
      threadId: "github-thread-001",
      projectId: "PJ-202",
    });
  });

  it("sanitizes external text before the normalized event can be persisted", () => {
    const result = normalizeTeamsStatusPayload({
      messageId: "teams-002",
      rootMessageId: "teams-thread-002",
      receivedAt: "2026-08-16T06:00:00Z",
      reporterId: "ST-010",
      projectIdHintFromSender: "PJ-101",
      body: "api_key=super-secret-value-1234567890",
      structured: { ...update, achievements: "api_key=super-secret-value-1234567890" },
    });
    expect(result.body).not.toContain("super-secret-value");
    expect(result.update.achievements).not.toContain("super-secret-value");
  });

  it("rejects unknown fields, unbounded identifiers, and invalid timestamps", () => {
    expect(() =>
      normalizeGithubStatusPayload({
        deliveryId: "github-001",
        discussionId: "github-thread-001",
        receivedAt: "not-a-time",
        reporterId: "ST-010",
        body: "PJ-101",
        structured: update,
      }),
    ).toThrow(RangeError);
    expect(() =>
      normalizeEmailStatusPayload({
        internetMessageId: "x".repeat(121),
        conversationId: "thread",
        receivedAt: "2026-08-16T06:00:00Z",
        reporterId: "ST-010",
        body: "PJ-101",
        structured: update,
      }),
    ).toThrow(RangeError);
    expect(() =>
      normalizeTeamsStatusPayload({
        messageId: "teams-003",
        rootMessageId: "thread",
        receivedAt: "2026-08-16T06:00:00Z",
        reporterId: "ST-010",
        body: "PJ-101",
        structured: update,
        unexpected: true,
      }),
    ).toThrow(RangeError);
  });
});
