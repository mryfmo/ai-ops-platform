// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-006 / ADR-0025
import type { ChannelAdapter, ChannelAttachmentRef, ChannelResult } from "../lib/channel.js";

const invalidInput: ChannelResult<never> = {
  ok: false,
  error: {
    code: "E-CHANNEL-INVALID-INPUT",
    recoverable: true,
    message: "The channel message is invalid.",
  },
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalString(value: unknown): string | null | undefined {
  return value === undefined ? null : (nonBlank(value) ?? undefined);
}

function parseAttachments(value: unknown): readonly ChannelAttachmentRef[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const attachments: ChannelAttachmentRef[] = [];
  for (const item of value) {
    const attachment = record(item);
    const platformAttachmentId = nonBlank(attachment?.id);
    const name = optionalString(attachment?.name);
    const contentType = optionalString(attachment?.contentType);
    if (!attachment || !platformAttachmentId || name === undefined || contentType === undefined) {
      return null;
    }
    attachments.push({ platformAttachmentId, name, contentType });
  }
  return attachments;
}

function normalize(input: unknown) {
  const activity = record(input);
  const conversation = record(activity?.conversation);
  const from = record(activity?.from);
  const platformMessageId = nonBlank(activity?.id);
  const platformConversationId = nonBlank(conversation?.id);
  const platformThreadId = optionalString(activity?.replyToId);
  const subjectId = nonBlank(from?.aadObjectId);
  const tenantId = optionalString(from?.tenantId);
  const displayName = optionalString(from?.name);
  const text = nonBlank(activity?.text);
  const attachmentRefs = parseAttachments(activity?.attachments);

  if (
    !activity ||
    !platformMessageId ||
    !platformConversationId ||
    platformThreadId === undefined ||
    !subjectId ||
    tenantId === undefined ||
    displayName === undefined ||
    !text ||
    !attachmentRefs
  ) {
    return invalidInput;
  }

  return {
    ok: true as const,
    value: {
      ref: { source: "teams", platformMessageId },
      address: {
        source: "teams",
        platformConversationId,
        platformThreadId,
      },
      user: {
        provider: "microsoft-entra",
        tenantId,
        subjectId,
        displayName,
      },
      attachmentRefs,
      text,
    },
  };
}

export const teamsAdapter: ChannelAdapter = Object.freeze({
  source: "teams",
  normalize,
});
