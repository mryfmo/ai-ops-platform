// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / ADR-0020
export { ADAPTER_KINDS } from "./adapters/types.js";
export type { AdapterKind, AdapterOperation, AdapterDependencies, TokenProvider } from "./adapters/types.js";
export type { VersionedRef } from "./adapters/refs.js";
export { WORKIQ_SURFACE_OPERATIONS } from "./adapters/index.js";
export type {
  WorkIqAdapter,
  McpGatewayAdapter,
  WisprAdapter,
  PlaneAdapter,
  ConfluenceAdapter,
} from "./adapters/index.js";
export { isOperationAllowed, assertOperationAllowed } from "./lib/operationBoundary.js";
export {
  WORKIQ_DELEGATED_SCOPE,
  WORKIQ_RESOURCE_AUDIENCE,
  validateWorkIqDelegatedClaims,
} from "./workiq/tokenClaims.js";
export type { ValidatedWorkIqDelegatedClaims } from "./workiq/tokenClaims.js";
export { buildMcpPolicyInput, assertGovernedMcpToolCallRequest } from "./lib/mcpPolicy.js";
export {
  BOUNDED_INVOCATION_PROFILES,
  deriveInvocationContext,
  invocationLimitError,
  jsonResultByteLength,
  resolveInvocationProfile,
} from "./lib/invocationProfile.js";
export type { BoundedInvocationProfile, InvocationLimitErrorCode } from "./lib/invocationProfile.js";
export type {
  GovernedMcpToolCallRequest,
  GovernedRegistryEntry,
  GovernedInvocationContext,
  McpPolicyInput,
  McpRegistryCaller,
  McpToolRisk,
} from "./lib/mcpPolicy.js";
export { GovernedMcpToolCaller } from "./mcp/governedToolCall.js";
export type {
  GovernedMcpToolCallDependencies,
  ToolInvocationReceipt,
  ToolPolicyDecision,
  ToolPolicyDecisionValue,
} from "./mcp/governedToolCall.js";
