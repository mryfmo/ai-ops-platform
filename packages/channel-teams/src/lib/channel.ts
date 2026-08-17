// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-006 / ADR-0025

export interface ChannelMessageRef {
  readonly source: string;
  readonly platformMessageId: string;
}

export interface ChannelAddress {
  readonly source: string;
  readonly platformConversationId: string;
  readonly platformThreadId: string | null;
}

export interface ChannelUserIdentity {
  readonly provider: string;
  readonly tenantId: string | null;
  readonly subjectId: string;
  readonly displayName: string | null;
}

export interface ChannelSenderIdentity {
  readonly kind: "human" | "bot" | "app";
  readonly platformId: string;
}

export interface ChannelAttachmentRef {
  readonly platformAttachmentId: string;
  readonly name: string | null;
  readonly contentType: string | null;
}

export interface ChannelInboundMessage {
  readonly ref: ChannelMessageRef;
  readonly address: ChannelAddress;
  readonly user: ChannelUserIdentity;
  readonly sender: ChannelSenderIdentity;
  readonly mentionTargetIds: readonly string[] | null;
  readonly attachmentRefs: readonly ChannelAttachmentRef[];
  readonly text: string;
}

export type RecoverableChannelErrorCode = "E-CHANNEL-INVALID-INPUT" | "E-CHANNEL-MAPPING-MISMATCH";

export interface RecoverableChannelError {
  readonly code: RecoverableChannelErrorCode;
  readonly recoverable: true;
  readonly message: string;
}

export type ChannelResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RecoverableChannelError };

export interface ChannelAdapter {
  readonly source: string;
  normalize(input: unknown): ChannelResult<ChannelInboundMessage>;
}

export interface AuthoritativeConversationMapping {
  readonly address: ChannelAddress;
  readonly identity: {
    readonly provider: string;
    readonly tenantId: string;
    readonly subjectId: string;
  };
  readonly conversationId: string;
  readonly threadId: string;
  readonly workflowId: string;
}

export interface ConversationMappingAuthority {
  lookup(address: ChannelAddress, identity: ChannelUserIdentity): Promise<AuthoritativeConversationMapping | null>;
}

export interface ChannelBotIdentity {
  readonly platformId: string;
}

export interface ConversationMappingRegistrationRequest {
  readonly address: ChannelAddress;
  readonly identity: AuthoritativeConversationMapping["identity"];
  readonly sourceMessage: ChannelMessageRef;
}

export interface AgUiRunRequest {
  readonly conversationId: string;
  readonly threadId: string;
  readonly workflowId: string;
  readonly userIdentity: ChannelUserIdentity;
  readonly attachmentRefs: readonly ChannelAttachmentRef[];
  readonly sourceMessage: ChannelMessageRef;
  readonly inputText: string;
}

export interface AgUiEvent {
  readonly type: string;
  readonly payload: unknown;
}

export interface AgUiClient {
  stream(request: AgUiRunRequest): AsyncIterable<AgUiEvent>;
}

export type ChannelFlowDecision =
  | { readonly kind: "start"; readonly registration: ConversationMappingRegistrationRequest }
  | { readonly kind: "follow_up"; readonly request: AgUiRunRequest }
  | { readonly kind: "ignore" }
  | { readonly kind: "error_report"; readonly error: RecoverableChannelError };

const mappingMismatchError: RecoverableChannelError = {
  code: "E-CHANNEL-MAPPING-MISMATCH",
  recoverable: true,
  message: "The conversation mapping is unavailable.",
};
const mappingMismatch: ChannelResult<never> = { ok: false, error: mappingMismatchError };
const invalidInputError: RecoverableChannelError = {
  code: "E-CHANNEL-INVALID-INPUT",
  recoverable: true,
  message: "The channel message is invalid.",
};
const ignored: ChannelFlowDecision = { kind: "ignore" };

export function makeDedupeKey(ref: ChannelMessageRef): string {
  if (!ref.source.trim() || !ref.platformMessageId.trim()) {
    throw new TypeError("source and platformMessageId must be non-empty");
  }
  return JSON.stringify([ref.source, ref.platformMessageId]);
}

export function buildAgUiRunRequest(
  message: ChannelInboundMessage,
  mapping: AuthoritativeConversationMapping,
): ChannelResult<AgUiRunRequest> {
  const expected = message.address;
  const actual = mapping.address;
  if (
    expected.source !== actual.source ||
    expected.platformConversationId !== actual.platformConversationId ||
    expected.platformThreadId !== actual.platformThreadId ||
    message.user.provider !== mapping.identity.provider ||
    message.user.tenantId !== mapping.identity.tenantId ||
    message.user.subjectId !== mapping.identity.subjectId
  ) {
    return mappingMismatch;
  }

  return {
    ok: true,
    value: {
      conversationId: mapping.conversationId,
      threadId: mapping.threadId,
      workflowId: mapping.workflowId,
      userIdentity: message.user,
      attachmentRefs: message.attachmentRefs,
      sourceMessage: message.ref,
      inputText: message.text,
    },
  };
}

export function decideChannelFlow(
  message: ChannelInboundMessage,
  mapping: AuthoritativeConversationMapping | null,
  bot: ChannelBotIdentity,
): ChannelFlowDecision {
  if ([message.sender.platformId, bot.platformId].some((value) => !value.trim() || value !== value.trim())) {
    return { kind: "error_report", error: invalidInputError };
  }
  if (message.sender.kind !== "human" || message.sender.platformId === bot.platformId) return ignored;
  if (
    message.mentionTargetIds === null ||
    message.mentionTargetIds.some((value) => !value.trim() || value !== value.trim())
  ) {
    return { kind: "error_report", error: invalidInputError };
  }

  if (mapping) {
    if (message.address.platformThreadId === null) {
      return { kind: "error_report", error: mappingMismatchError };
    }
    const request = buildAgUiRunRequest(message, mapping);
    return request.ok ? { kind: "follow_up", request: request.value } : { kind: "error_report", error: request.error };
  }

  const botMentionCount = message.mentionTargetIds.filter((id) => id === bot.platformId).length;
  if (botMentionCount !== 1) return ignored;
  if (message.user.tenantId === null) return { kind: "error_report", error: invalidInputError };

  return {
    kind: "start",
    registration: {
      address: message.address,
      identity: {
        provider: message.user.provider,
        tenantId: message.user.tenantId,
        subjectId: message.user.subjectId,
      },
      sourceMessage: message.ref,
    },
  };
}
