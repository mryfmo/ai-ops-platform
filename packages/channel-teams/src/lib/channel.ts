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

export interface ChannelAttachmentRef {
  readonly platformAttachmentId: string;
  readonly name: string | null;
  readonly contentType: string | null;
}

export interface ChannelInboundMessage {
  readonly ref: ChannelMessageRef;
  readonly address: ChannelAddress;
  readonly user: ChannelUserIdentity;
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
  readonly conversationId: string;
  readonly threadId: string;
  readonly workflowId: string;
}

export interface ConversationMappingAuthority {
  lookup(address: ChannelAddress): Promise<AuthoritativeConversationMapping | null>;
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

const mappingMismatch: ChannelResult<never> = {
  ok: false,
  error: {
    code: "E-CHANNEL-MAPPING-MISMATCH",
    recoverable: true,
    message: "The conversation mapping is unavailable.",
  },
};

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
    expected.platformThreadId !== actual.platformThreadId
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
