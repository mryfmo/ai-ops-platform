// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / ADR-0020
export { ADAPTER_KINDS } from "./adapters/types.js";
export type { AdapterKind, AdapterOperation, AdapterDependencies, TokenProvider } from "./adapters/types.js";
export type { VersionedRef } from "./adapters/refs.js";
export type {
  WorkIqAdapter,
  McpGatewayAdapter,
  WisprAdapter,
  PlaneAdapter,
  ConfluenceAdapter,
} from "./adapters/index.js";
export { isOperationAllowed, assertOperationAllowed } from "./lib/operationBoundary.js";
