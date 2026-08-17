// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-006 / ADR-0025

export { teamsAdapter } from "./adapters/teams.js";
export {
  buildAgUiRunRequest,
  decideChannelFlow,
  makeDedupeKey,
  type AgUiClient,
  type AgUiEvent,
  type AgUiRunRequest,
  type AuthoritativeConversationMapping,
  type ChannelAdapter,
  type ChannelAddress,
  type ChannelAttachmentRef,
  type ChannelBotIdentity,
  type ChannelFlowDecision,
  type ChannelInboundMessage,
  type ChannelMessageRef,
  type ChannelResult,
  type ChannelUserIdentity,
  type ChannelSenderIdentity,
  type ConversationMappingRegistrationRequest,
  type ConversationMappingAuthority,
  type RecoverableChannelError,
  type RecoverableChannelErrorCode,
} from "./lib/channel.js";
