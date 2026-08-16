// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-006 / ADR-0025

export { teamsAdapter } from "./adapters/teams.js";
export {
  buildAgUiRunRequest,
  makeDedupeKey,
  type AgUiClient,
  type AgUiEvent,
  type AgUiRunRequest,
  type AuthoritativeConversationMapping,
  type ChannelAdapter,
  type ChannelAddress,
  type ChannelAttachmentRef,
  type ChannelInboundMessage,
  type ChannelMessageRef,
  type ChannelResult,
  type ChannelUserIdentity,
  type ConversationMappingAuthority,
  type RecoverableChannelError,
  type RecoverableChannelErrorCode,
} from "./lib/channel.js";
