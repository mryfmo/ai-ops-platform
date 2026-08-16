// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-006 / ADR-0025
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  buildAgUiRunRequest,
  makeDedupeKey,
  teamsAdapter,
  type AuthoritativeConversationMapping,
  type ChannelAdapter,
  type ChannelInboundMessage,
  type ConversationMappingAuthority,
} from "../src/index.js";

const teamsInput = {
  id: "message-1",
  conversation: { id: "conversation-1" },
  replyToId: "thread-1",
  from: {
    aadObjectId: "user-1",
    tenantId: "tenant-1",
    name: "Operator",
  },
  text: "Show the deployment status",
  attachments: [
    {
      id: "attachment-1",
      name: "request.txt",
      contentType: "text/plain",
    },
  ],
};

describe("FinalArch:FR-UI-001 Teams channel normalization", () => {
  it("maps Teams transport fields to the channel-neutral boundary", () => {
    expect(teamsAdapter.normalize(teamsInput)).toEqual({
      ok: true,
      value: {
        ref: { source: "teams", platformMessageId: "message-1" },
        address: {
          source: "teams",
          platformConversationId: "conversation-1",
          platformThreadId: "thread-1",
        },
        user: {
          provider: "microsoft-entra",
          tenantId: "tenant-1",
          subjectId: "user-1",
          displayName: "Operator",
        },
        attachmentRefs: [
          {
            platformAttachmentId: "attachment-1",
            name: "request.txt",
            contentType: "text/plain",
          },
        ],
        text: "Show the deployment status",
      },
    });
  });

  it("returns a fixed recoverable error without reflecting untrusted content", () => {
    const secret = "Bearer should-not-be-reflected";
    const result = teamsAdapter.normalize({ ...teamsInput, id: "", text: secret });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "E-CHANNEL-INVALID-INPUT",
        recoverable: true,
        message: "The channel message is invalid.",
      },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

describe("FinalArch:FR-UI-003 AG-UI mapping boundary", () => {
  it("maps only the supplied server-authoritative conversation record", () => {
    const normalized = teamsAdapter.normalize(teamsInput);
    if (!normalized.ok) throw new Error("fixture must normalize");

    const mapping: AuthoritativeConversationMapping = {
      address: normalized.value.address,
      conversationId: "agui-conversation-1",
      threadId: "agui-thread-1",
      workflowId: "workflow-1",
    };

    expect(buildAgUiRunRequest(normalized.value, mapping)).toEqual({
      ok: true,
      value: {
        conversationId: "agui-conversation-1",
        threadId: "agui-thread-1",
        workflowId: "workflow-1",
        userIdentity: normalized.value.user,
        attachmentRefs: normalized.value.attachmentRefs,
        sourceMessage: normalized.value.ref,
        inputText: normalized.value.text,
      },
    });
  });

  it("fails closed when the authoritative mapping belongs to another thread", () => {
    const normalized = teamsAdapter.normalize(teamsInput);
    if (!normalized.ok) throw new Error("fixture must normalize");

    expect(
      buildAgUiRunRequest(normalized.value, {
        address: { ...normalized.value.address, platformThreadId: "other-thread" },
        conversationId: "agui-conversation-1",
        threadId: "agui-thread-1",
        workflowId: "workflow-1",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "E-CHANNEL-MAPPING-MISMATCH",
        recoverable: true,
        message: "The conversation mapping is unavailable.",
      },
    });
  });
});

describe("FinalArch:FR-UI-006 replaceable stateless adapter contract", () => {
  it("accepts another channel without Teams-specific types", () => {
    const webAdapter = {
      source: "web",
      normalize: (_input: unknown) => ({
        ok: false as const,
        error: {
          code: "E-CHANNEL-INVALID-INPUT" as const,
          recoverable: true as const,
          message: "The channel message is invalid.",
        },
      }),
    } satisfies ChannelAdapter;

    expectTypeOf(webAdapter).toMatchTypeOf<ChannelAdapter>();
    expect(webAdapter.source).toBe("web");
  });

  it("exposes no persistence API or mutable business state", () => {
    expect(Object.keys(teamsAdapter).sort()).toEqual(["normalize", "source"]);
    expect(Object.isFrozen(teamsAdapter)).toBe(true);
  });

  it("defines server-side mapping lookup as an injected authority only", () => {
    const authority: ConversationMappingAuthority = {
      lookup: async (_address) => null,
    };

    expectTypeOf(authority.lookup).returns.resolves.toEqualTypeOf<AuthoritativeConversationMapping | null>();
  });
});

describe("FinalArch:FR-UI-001 channel deduplication", () => {
  it("keys by source and platform message ID without delimiter collisions", () => {
    const first = makeDedupeKey({ source: "teams:a", platformMessageId: "b" });
    const second = makeDedupeKey({ source: "teams", platformMessageId: "a:b" });

    expect(first).toBe('["teams:a","b"]');
    expect(second).toBe('["teams","a:b"]');
    expect(first).not.toBe(second);
  });

  it("rejects blank key components", () => {
    expect(() => makeDedupeKey({ source: "teams", platformMessageId: " " })).toThrow(
      "source and platformMessageId must be non-empty",
    );
  });
});

expectTypeOf<ChannelInboundMessage>().toMatchTypeOf<{
  ref: { source: string; platformMessageId: string };
  address: {
    source: string;
    platformConversationId: string;
    platformThreadId: string | null;
  };
}>();
