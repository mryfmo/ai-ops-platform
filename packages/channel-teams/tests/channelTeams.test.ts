// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-006 / ADR-0025
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  buildAgUiRunRequest,
  decideChannelFlow,
  makeDedupeKey,
  teamsAdapter,
  type AuthoritativeConversationMapping,
  type ChannelAdapter,
  type ChannelBotIdentity,
  type ChannelFlowDecision,
  type ChannelInboundMessage,
  type ConversationMappingAuthority,
} from "../src/index.js";

const teamsInput = {
  id: "message-1",
  conversation: { id: "conversation-1" },
  replyToId: "thread-1",
  from: {
    id: "teams-user-1",
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
        sender: { kind: "human", platformId: "teams-user-1" },
        mentionTargetIds: [],
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

describe("FinalArch:FR-UI-001 mention and subscribed-thread flow", () => {
  const bot: ChannelBotIdentity = { platformId: "28:aiops-bot" };

  function normalizeFlowMessage(input: {
    mentioned: boolean;
    reply: boolean;
    sender: "human" | "bot";
  }): ChannelInboundMessage {
    const result = teamsAdapter.normalize({
      ...teamsInput,
      replyToId: input.reply ? "thread-1" : undefined,
      from:
        input.sender === "human"
          ? teamsInput.from
          : { id: "28:other-bot", role: "bot", tenantId: "tenant-1", name: "Other bot" },
      entities: input.mentioned
        ? [{ type: "mention", mentioned: { id: bot.platformId, name: "AI Ops" }, text: "<at>AI Ops</at>" }]
        : [],
    });
    if (!result.ok) throw new Error("matrix fixture must normalize");
    return result.value;
  }

  function mappingFor(message: ChannelInboundMessage): AuthoritativeConversationMapping {
    return {
      address: message.address,
      identity: {
        provider: message.user.provider,
        tenantId: message.user.tenantId ?? "tenant-1",
        subjectId: message.user.subjectId,
      },
      conversationId: "agui-conversation-1",
      threadId: "agui-thread-1",
      workflowId: "workflow-1",
    };
  }

  const matrix = ([false, true] as const).flatMap((mentioned) =>
    ([false, true] as const).flatMap((reply) =>
      (["human", "bot"] as const).flatMap((sender) =>
        ([false, true] as const).map((mapped) => {
          const expected: ChannelFlowDecision["kind"] =
            sender === "bot"
              ? "ignore"
              : mapped
                ? reply
                  ? "follow_up"
                  : "error_report"
                : mentioned
                  ? "start"
                  : "ignore";
          return { mentioned, reply, sender, mapped, expected };
        }),
      ),
    ),
  );

  it.each(matrix)(
    "decides mention=$mentioned reply=$reply sender=$sender mapped=$mapped as $expected",
    ({ mentioned, reply, sender, mapped, expected }) => {
      const message = normalizeFlowMessage({ mentioned, reply, sender });
      const decision = decideChannelFlow(message, mapped ? mappingFor(message) : null, bot);

      expect(decision.kind).toBe(expected);
      if (decision.kind === "follow_up") {
        expect(decision.request).toMatchObject({
          conversationId: "agui-conversation-1",
          threadId: "agui-thread-1",
          workflowId: "workflow-1",
          sourceMessage: message.ref,
        });
      }
      if (decision.kind === "start") {
        expect(decision.registration).toEqual({
          address: message.address,
          identity: {
            provider: "microsoft-entra",
            tenantId: "tenant-1",
            subjectId: "user-1",
          },
          sourceMessage: message.ref,
        });
      }
      if (decision.kind === "error_report") {
        expect(decision.error).toMatchObject({ code: "E-CHANNEL-MAPPING-MISMATCH", recoverable: true });
      }
    },
  );

  it("uses mention entity IDs, permits bot plus human, and ignores display-name spoofing or duplicate bot targets", () => {
    const activity = {
      ...teamsInput,
      replyToId: undefined,
      text: "<at>AI Ops</at> deploy",
    };
    const fake = teamsAdapter.normalize({
      ...activity,
      entities: [{ type: "mention", mentioned: { id: "user-2", name: "AI Ops" }, text: "<at>AI Ops</at>" }],
    });
    const mixed = teamsAdapter.normalize({
      ...activity,
      entities: [
        { type: "mention", mentioned: { id: bot.platformId, name: "Renamed bot" }, text: "<at>x</at>" },
        { type: "mention", mentioned: { id: "user-2", name: "Colleague" }, text: "<at>y</at>" },
      ],
    });
    const duplicate = teamsAdapter.normalize({
      ...activity,
      entities: [
        { type: "mention", mentioned: { id: bot.platformId }, text: "<at>x</at>" },
        { type: "mention", mentioned: { id: bot.platformId }, text: "<at>x</at>" },
      ],
    });
    if (!fake.ok || !mixed.ok || !duplicate.ok) throw new Error("valid mention fixtures must normalize");

    expect(decideChannelFlow(fake.value, null, bot)).toEqual({ kind: "ignore" });
    expect(decideChannelFlow(mixed.value, null, bot).kind).toBe("start");
    expect(decideChannelFlow(duplicate.value, null, bot)).toEqual({ kind: "ignore" });
  });

  it.each([
    { entities: [{}], label: "empty entity" },
    { entities: [{ type: "mention", mentioned: {} }], label: "empty mention target" },
    { entities: [{ type: "mention", mentioned: { id: bot.platformId }, text: "" }], label: "empty mention text" },
  ])("returns a fixed recoverable error for $label", ({ entities }) => {
    const result = teamsAdapter.normalize({ ...teamsInput, entities });
    if (!result.ok) throw new Error("malformed mentions must remain normalized for machine-sender suppression");
    expect(decideChannelFlow(result.value, null, bot)).toEqual({
      kind: "error_report",
      error: {
        code: "E-CHANNEL-INVALID-INPUT",
        recoverable: true,
        message: "The channel message is invalid.",
      },
    });
  });

  it("reports fixed recoverable errors for invalid bot identity or tenantless start", () => {
    const result = teamsAdapter.normalize({
      ...teamsInput,
      replyToId: undefined,
      from: { ...teamsInput.from, tenantId: undefined },
      entities: [{ type: "mention", mentioned: { id: bot.platformId }, text: "<at>bot</at>" }],
    });
    if (!result.ok) throw new Error("tenantless normalized fixture must be valid before flow authorization");
    const fixedError = {
      kind: "error_report",
      error: {
        code: "E-CHANNEL-INVALID-INPUT",
        recoverable: true,
        message: "The channel message is invalid.",
      },
    };

    expect(decideChannelFlow(result.value, null, bot)).toEqual(fixedError);
    expect(
      decideChannelFlow({ ...result.value, user: { ...result.value.user, tenantId: "tenant-1" } }, null, {
        platformId: " ",
      }),
    ).toEqual(fixedError);
  });

  it.each([
    { from: { id: bot.platformId, aadObjectId: "forged-human", tenantId: "tenant-1" }, label: "self echo" },
    { from: { id: "28:other-bot", role: "bot", tenantId: "tenant-1" }, label: "other bot" },
    { from: { id: "skill-1", role: "skill", tenantId: "tenant-1" }, label: "Bot Framework skill" },
    { from: { id: "app-1", role: "application", tenantId: "tenant-1" }, label: "app activity" },
  ])("ignores $label before mapping or mention decisions", ({ from }) => {
    const result = teamsAdapter.normalize({
      ...teamsInput,
      replyToId: undefined,
      from,
      entities: [{}],
    });
    if (!result.ok) throw new Error("loop fixture must normalize");

    expect(decideChannelFlow(result.value, mappingFor(result.value), bot)).toEqual({ kind: "ignore" });
  });
});

describe("FinalArch:FR-UI-003 AG-UI mapping boundary", () => {
  it("maps only the supplied server-authoritative conversation record", () => {
    const normalized = teamsAdapter.normalize(teamsInput);
    if (!normalized.ok) throw new Error("fixture must normalize");

    const mapping: AuthoritativeConversationMapping = {
      address: normalized.value.address,
      identity: {
        provider: "microsoft-entra",
        tenantId: "tenant-1",
        subjectId: "user-1",
      },
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
        identity: {
          provider: "microsoft-entra",
          tenantId: "tenant-1",
          subjectId: "user-1",
        },
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

  it("fails closed when the authoritative mapping belongs to another user", () => {
    const normalized = teamsAdapter.normalize(teamsInput);
    if (!normalized.ok) throw new Error("fixture must normalize");

    expect(
      buildAgUiRunRequest(normalized.value, {
        address: normalized.value.address,
        identity: {
          provider: "microsoft-entra",
          tenantId: "tenant-1",
          subjectId: "other-user",
        },
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
      lookup: async (_address, _identity) => null,
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
  sender: { kind: "human" | "bot" | "app"; platformId: string };
  mentionTargetIds: readonly string[] | null;
}>();
