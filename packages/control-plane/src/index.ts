// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
export { WORKFLOW_KINDS } from "./contracts/index.js";
export type { WorkflowKind, VersionedPayload, OperationClass } from "./contracts/index.js";
export { buildWorkflowId, parseWorkflowId } from "./lib/workflowId.js";
export { defineWorkflow } from "./workflows/index.js";
export type { WorkflowDefinition } from "./workflows/index.js";
export type { ActivityDefinition } from "./activities/types.js";
