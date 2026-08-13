// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
export { WORKFLOW_KINDS } from "./contracts/index.js";
export type { WorkflowKind, VersionedPayload, OperationClass } from "./contracts/index.js";
export { buildWorkflowId, parseWorkflowId } from "./lib/workflowId.js";
export { retryPolicyFor, toTemporalRetryPolicy } from "./lib/retryPolicies.js";
export type { FixedRetryPolicy } from "./lib/retryPolicies.js";
export { buildIdempotencyKey, parseIdempotencyKey } from "./lib/idempotency.js";
export { runExternalSideEffect, ExternalSideEffectUnresolvedError } from "./workflows/sideEffect.js";
export type { ExternalSideEffectPorts, ExternalSideEffectOutcome } from "./workflows/sideEffect.js";
export { isPatchActive, retirePatch } from "./workflows/versioning.js";
export { guardSideEffectDispatch, runCleanup } from "./workflows/cancellation.js";
export { defineWorkflow } from "./workflows/index.js";
export type { WorkflowDefinition } from "./workflows/index.js";
export type { ActivityDefinition } from "./activities/types.js";
export {
  TEMPORAL_ENVIRONMENTS,
  WORKER_CN_PREFIX,
  CA_CN_PREFIX,
  isTemporalEnvironment,
  namespaceFor,
  taskQueueFor,
  allTaskQueues,
  buildConnectionProfile,
  parseWorkerCertificateIdentity,
  assertCertificateMatchesProfile,
} from "./lib/temporalProfile.js";
export type {
  TemporalEnvironment,
  TemporalConnectionProfile,
  WorkerCertificateIdentity,
} from "./lib/temporalProfile.js";
export { createTemporalConnection } from "./temporal/connection.js";
export type { TemporalMtlsCredentials, TemporalConnectFn } from "./temporal/connection.js";
export { decodeAuthorizationToken, assertTokenMatchesProfile } from "./lib/temporalProfile.js";
export type { AuthorizationTokenPayload } from "./lib/temporalProfile.js";
export { validateTokenProvider } from "./temporal/connection.js";
export { createScopedWorker, refreshWorkerAuthorization } from "./temporal/worker.js";
export type { ScopedWorker, ScopedWorkerOptions, NativeConnectFn, WorkerCreateFn } from "./temporal/worker.js";
