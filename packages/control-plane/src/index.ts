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
export { assertApprovalRequest, evaluateDecisionSignal } from "./lib/approvalDecision.js";
export type {
  ApprovalDecision,
  ApprovalDecisionSignalPayload,
  ApprovalWaitState,
  SignalEvaluation,
  SignalRejectReason,
} from "./lib/approvalDecision.js";
export { approvalDecisionSignal, approvalStateQuery, approvalWorkflow } from "./workflows/approval.js";
export type { ApprovalOutcome, ApprovalRequest } from "./workflows/approval.js";
export {
  assertCodingTaskRequest,
  evaluateCallbackSignal,
  evaluateReviewDecision,
  evaluateReviewSignal,
  phaseAfterCallback,
  CODING_TASK_PHASES,
} from "./lib/codingTaskState.js";
export type {
  AcceptedCallback,
  CallbackEvaluation,
  CallbackOutcome,
  CallbackRejectReason,
  CodingTaskCallbackPayload,
  CodingTaskPhase,
  CodingTaskReviewPayload,
  ReviewDecisionEvaluation,
  ReviewEvaluation,
  ReviewRejectReason,
} from "./lib/codingTaskState.js";
export {
  codingTaskCallbackSignal,
  codingTaskPhaseQuery,
  codingTaskReviewSignal,
  codingTaskWorkflow,
} from "./workflows/codingTask.js";
export type { CodingTaskActivities, CodingTaskRequest, CodingTaskResult } from "./workflows/codingTask.js";
export {
  GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RECONCILE_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS,
  GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS,
  assertGraphSubscriptionRequest,
  graphSubscriptionScheduleDelayMs,
  parseGraphSubscriptionReceipt,
} from "./lib/graphSubscriptionState.js";
export { buildGraphSubscriptionSchedules } from "./lib/graphSubscriptionSchedules.js";
export type { GraphSubscriptionScheduleRegistration } from "./lib/graphSubscriptionSchedules.js";
export { registerGraphSubscriptionSchedules } from "./workflows/graphSubscriptionScheduleRegistration.js";
export type {
  GraphSubscriptionOperation,
  GraphSubscriptionReceipt,
  GraphSubscriptionRequest,
  GraphSubscriptionRenewalActivityInput,
  GraphSubscriptionRenewalRequest,
  GraphSubscriptionScheduledRequest,
} from "./lib/graphSubscriptionState.js";
export { buildGraphSubscriptionWorkflowId, graphSubscriptionWorkflow } from "./workflows/graphSubscription.js";
export type { GraphSubscriptionActivities, GraphSubscriptionResult } from "./workflows/graphSubscription.js";
export {
  HEALTH_EVALUATION_INTERVAL_MS,
  JIT_EXPIRY_INTERVAL_MS,
  assertJitHealthRequest,
  buildHealthEvaluationWorkflowId,
  buildJitExpiryWorkflowId,
  jitHealthScheduleDelayMs,
  parseHealthApplicationReceipt,
  parseHealthEvaluationReceipt,
  parseJitRevocationCandidates,
  parseJitRevocationReceipt,
} from "./lib/jitHealthState.js";
export type {
  HealthDecision,
  HealthEvaluationActivityInput,
  HealthEvaluationReceipt,
  HealthEvaluationRequest,
  JitCandidateQuery,
  JitExpiryRequest,
  JitHealthRequest,
  JitRevocationActivityInput,
  JitRevocationCandidate,
  JitRevocationReceipt,
} from "./lib/jitHealthState.js";
export { buildJitHealthSchedules } from "./lib/jitHealthSchedules.js";
export type { JitHealthScheduleRegistration } from "./lib/jitHealthSchedules.js";
export { registerJitHealthSchedules } from "./workflows/jitHealthScheduleRegistration.js";
export { healthEvaluationWorkflow, jitExpiryWorkflow } from "./workflows/jitHealth.js";
export type { HealthEvaluationResult, JitExpiryResult, JitHealthActivities } from "./workflows/jitHealth.js";
export { defineWorkflow } from "./workflows/index.js";
export type { WorkflowDefinition } from "./workflows/index.js";
export type { ActivityDefinition } from "./activities/types.js";
export { routeM365Output } from "./activities/m365Egress.js";
export type { M365EgressDependencies, M365EgressResult, M365LlmInput } from "./activities/m365Egress.js";
export type {
  M365EgressErrorCode,
  M365EgressRequest,
  M365ExternalProvider,
  PreparedM365Egress,
} from "./lib/m365Egress.js";
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
export {
  assertReportDeliveryRequest,
  parseReportDeliveryLedgerStatus,
  parseReportDeliveryReceipt,
  parseReportGenerationReceipt,
  parseReportProfileReceipt,
  parseReportValidationReceipt,
  profileRequiresApproval,
  REPORT_PROFILES,
} from "./lib/reportDeliveryState.js";
export type {
  ReportApprovalParameters,
  ReportDeliveryLedgerStatus,
  ReportDeliveryReceipt,
  ReportDeliveryRequest,
  ReportGenerationReceipt,
  ReportProfile,
  ReportProfileReceipt,
  ReportRecipient,
  ReportValidationReceipt,
} from "./lib/reportDeliveryState.js";
export { buildReportDeliveryWorkflowId, reportDeliveryWorkflow } from "./workflows/reportDelivery.js";
export type { ReportDeliveryActivities, ReportDeliveryResult } from "./workflows/reportDelivery.js";
export {
  assertPlaneSyncRequest,
  parsePlanePromotionDraftReceipt,
  parsePlanePromotionEligibility,
  parsePlaneRevisionReceipt,
  parsePlaneSyncLedgerStatus,
  parsePlaneSyncWriteReceipt,
} from "./lib/planeSyncState.js";
export type { PlaneChildOutcome, PlaneSyncActivities, PlaneSyncResult } from "./workflows/planeSync.js";
export type {
  PlanePromotionDraftReceipt,
  PlanePromotionEligibility,
  PlaneSyncIdentity,
  PlaneSyncLedgerStatus,
  PlaneSyncOperation,
  PlaneSyncRequest,
  PlaneSyncWriteReceipt,
} from "./lib/planeSyncState.js";
export {
  buildPlaneSyncWorkflowId,
  planeEventWorkflow,
  planeProjectionWorkflow,
  planePromotionWorkflow,
  planeSyncWorkflow,
} from "./workflows/planeSync.js";
