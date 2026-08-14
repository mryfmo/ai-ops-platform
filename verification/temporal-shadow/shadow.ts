// 根拠: FinalArch:FR-CP-008 / TMP-003 / ADR-0021 / DELTA-01
import { createHash } from "node:crypto";
import ts from "typescript";

import { buildGraphSubscriptionSchedules } from "../../packages/control-plane/src/lib/graphSubscriptionSchedules.js";
import { GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS } from "../../packages/control-plane/src/lib/graphSubscriptionState.js";
import { buildJitHealthSchedules } from "../../packages/control-plane/src/lib/jitHealthSchedules.js";
import {
  buildHolidayCalendar,
  dayOfWeek,
  isBusinessDay,
  isNthBusinessDayOfMonth,
  nowJstHHmm,
  todayJstDateString,
} from "../../packages/shared/src/calendar/businessCalendar.js";

export const FIXED_SHADOW_CLOCK_MS = Date.parse("2026-05-31T14:59:00.000Z");

export const EXPECTED_SCHEDULER_REGISTRATIONS = [
  "createHealthcheckTask",
  "inline:capability-metrics-refresh-30s",
  "createReportDeliveryMetricsTask",
  "createApprovedDeployTask",
  "createProdMonitorTask",
  "createJitRevocationTask",
  "createCodingTaskReaperTask",
  "createSubscriptionRenewalTask",
  "createChannelPollingTask",
  "createEventsPollingTask",
  "createPmSnapshotReconcileTask",
  "createSevenKeysMonthlySnapshotTask",
  "createPrjopsWeeklyAnalyzeTask",
  "createPrjopsDailyTrackerTask",
  "createReportDeliveryTask",
] as const;

type SchedulerRegistration = (typeof EXPECTED_SCHEDULER_REGISTRATIONS)[number];

export interface ShadowLegacyConditions {
  readonly githubPolicyEnabled: boolean;
}

export const SHADOW_LEGACY_CONDITIONS: ShadowLegacyConditions = { githubPolicyEnabled: true };

interface SchedulerMetadata {
  readonly name: string;
  readonly intervalMs: number;
  readonly runOnStart?: boolean;
}

interface TemporalMapping {
  readonly registration: (typeof EXPECTED_SCHEDULER_REGISTRATIONS)[number];
  readonly task: string;
  readonly action: string;
  readonly firstDelayMs: number;
  readonly everyMs: number;
  readonly temporalTarget: string;
  readonly temporalSource: string;
  readonly reason?: string;
  readonly reasonedLegacy?: { readonly firstDelayMs: number; readonly everyMs: number };
}

const LEGACY_ACTIONS: Readonly<Record<SchedulerRegistration, string>> = {
  createHealthcheckTask: "health.evaluate",
  "inline:capability-metrics-refresh-30s": "capabilities.refresh",
  createReportDeliveryMetricsTask: "report-delivery.metrics.refresh",
  createApprovedDeployTask: "deploy.approved.dispatch",
  createProdMonitorTask: "deploy.prod.monitor",
  createJitRevocationTask: "jit.expired.revoke",
  createCodingTaskReaperTask: "coding-task.reap",
  createSubscriptionRenewalTask: "graph.subscription.renew",
  createChannelPollingTask: "graph.channel.delta",
  createEventsPollingTask: "events.poll",
  createPmSnapshotReconcileTask: "project-snapshot.reconcile",
  createSevenKeysMonthlySnapshotTask: "seven-keys.snapshot",
  createPrjopsWeeklyAnalyzeTask: "prjops.weekly.analyze",
  createPrjopsDailyTrackerTask: "prjops.daily.track",
  createReportDeliveryTask: "report.deliver",
};

const LEGACY_ACTION_CALLS: Readonly<Record<SchedulerRegistration, readonly string[]>> = {
  createHealthcheckTask: ["deps.checkTargets"],
  "inline:capability-metrics-refresh-30s": ["refreshSubscriptionPresence", "publishCapabilities"],
  createReportDeliveryMetricsTask: ["deps.provider.failureRatios"],
  createApprovedDeployTask: ["deps.execute"],
  createProdMonitorTask: ["deps.evaluate"],
  createJitRevocationTask: ["deps.grantsRepo.markRevoked"],
  createCodingTaskReaperTask: ["deps.codingTasksRepo.markDispatchFailed"],
  createSubscriptionRenewalTask: ["deps.graphClient.renewSubscription"],
  createChannelPollingTask: ["recoverGraphSubscription"],
  createEventsPollingTask: ["deps.eventsRepo.claimNextQueued"],
  createPmSnapshotReconcileTask: ["deps.repo.recordSnapshot"],
  createSevenKeysMonthlySnapshotTask: ["isNthBusinessDayOfMonth", "deps.repo.insert"],
  createPrjopsWeeklyAnalyzeTask: ["isWeeklyAnalysisDue", "analyze"],
  createPrjopsDailyTrackerTask: ["isDailyTrackingDue", "deps.stateRepo.recordOutcome"],
  createReportDeliveryTask: ["isFirstBusinessDayOfWeek", "deliverStandardReportToRecipients"],
};

const LEGACY_GUARD_SOURCE_HASHES = {
  isWeeklyAnalysisDue: "8b22ade645a7bb65771b07b5fd5c62ce3413cdc9920f417b4c9e6c09ed2e8d10",
  isDailyTrackingDue: "433f6d7066c4efc625b3b37d2a4ddd1f8a4131384fa5e43ee1c778e512df0110",
  isFirstBusinessDayOfWeek: "9d9faac703993ab04fdf6e0c583bf8c6bad015c1b794a3350e6a2b9eff82331a",
} as const;

const REPORT_DELIVERY_WORKFLOW_CALL_COUNTS: Readonly<Record<string, number>> = {
  assertReportDeliveryRequest: 1,
  buildIdempotencyKey: 1,
  buildReportDeliveryWorkflowId: 1,
  contractFailure: 11,
  "deliveries.push": 3,
  executeChild: 1,
  "externalWrites.deliverReport": 1,
  finish: 3,
  "idempotentWrites.generateReport": 1,
  parseReportDeliveryLedgerStatus: 2,
  parseReportDeliveryReceipt: 1,
  parseReportGenerationReceipt: 1,
  parseReportProfileReceipt: 1,
  parseReportValidationReceipt: 1,
  "reads.findReportDelivery": 2,
  "reads.resolveReportProfile": 1,
  "reads.validateReport": 1,
  runExternalSideEffect: 1,
  unresolvedFailure: 2,
};

const PLANE_SYNC_WORKFLOW_CALL_COUNTS: Readonly<Record<string, number>> = {
  assertPlaneSyncRequest: 1,
  buildPlaneSyncWorkflowId: 1,
  contractFailure: 2,
  executeChild: 1,
  "outcomes.push": 1,
};

const LEGACY_CALL_COUNTS: Readonly<Record<SchedulerRegistration, Readonly<Record<string, number>>>> = {
  createHealthcheckTask: {
    "deps.activateFailsafe": 1,
    "deps.auditLog.append": 2,
    "deps.checkTargets": 1,
    "deps.isFailsafeActive": 2,
    "deps.setFailsafeActive": 2,
    "deps.traceIdProvider": 2,
    evaluateFailsafe: 1,
    "now.toISOString": 3,
  },
  "inline:capability-metrics-refresh-30s": {
    publishCapabilities: 1,
    refreshSubscriptionPresence: 1,
    updateCalendarCoverageMetric: 1,
  },
  createReportDeliveryMetricsTask: {
    "deps.metrics.setReportDeliveryFailureRatios": 2,
    "deps.provider.failureRatios": 1,
  },
  createApprovedDeployTask: {
    Boolean: 3,
    String: 2,
    "deps.approvalsRepo.claimNextApprovedChange": 1,
    "deps.auditLog.append": 4,
    "deps.deploymentsRepo.findNextApprovedDispatch": 1,
    "deps.deploymentsRepo.markDispatchFailed": 3,
    "deps.deploymentsRepo.markDispatching": 1,
    "deps.execute": 1,
    "deps.traceIdProvider": 1,
    "deps.workflowExists": 1,
    "now.toISOString": 4,
    sanitizeSecrets: 2,
    targetFromClaim: 1,
    validTarget: 1,
  },
  createProdMonitorTask: {
    "deps.auditLog.append": 4,
    "deps.deploymentsRepo.listMonitoringTargets": 1,
    "deps.deploymentsRepo.markRolledBack": 1,
    "deps.deploymentsRepo.markRollingBack": 1,
    "deps.evaluate": 1,
    "deps.metricsProvider.read": 1,
    "deps.stableVersionsProvider.read": 1,
    "deps.traceIdProvider": 1,
    "deps.workflowExists": 1,
    evaluateTh003Rollback: 1,
    "now.toISOString": 4,
    selectRollbackTarget: 1,
  },
  createJitRevocationTask: {
    "deps.grantsRepo.loadActiveGrants": 1,
    "deps.grantsRepo.markRevoked": 1,
    "deps.traceIdProvider": 1,
    revokeExpiredGrants: 1,
  },
  createCodingTaskReaperTask: {
    String: 1,
    audit: 5,
    classifyStaleRun: 1,
    "deps.auditLog.append": 1,
    "deps.codingTasksRepo.findStaleRunning": 1,
    "deps.codingTasksRepo.markDispatchFailed": 1,
    "deps.traceIdProvider": 1,
    "githubClient.listWorkflowRuns": 1,
    runLookbackSince: 1,
    sanitizeSecrets: 1,
  },
  createSubscriptionRenewalTask: {
    computeGraphSubscriptionExpiration: 1,
    "deps.auditLog.append": 2,
    "deps.backfillSubscription": 1,
    "deps.graphClient.renewSubscription": 1,
    "deps.graphSubscriptionsRepo.listByMode": 1,
    "deps.graphSubscriptionsRepo.switchMode": 1,
    "deps.graphSubscriptionsRepo.updateExpiresAt": 1,
    "deps.traceIdProvider": 2,
    graphSubscriptionErrorDetail: 2,
    isGraphSubscriptionRenewalDue: 1,
    "notifying.filter": 1,
    "now.toISOString": 2,
  },
  createChannelPollingTask: {
    auditRecovery: 1,
    "deps.graphSubscriptionsRepo.listByMode": 1,
    recoverGraphSubscription: 1,
  },
  createEventsPollingTask: {
    "deps.eventsRepo.claimNextQueued": 1,
    "deps.eventsRepo.getQueueMetrics": 1,
    "metrics.setEventQueue": 1,
    processEvent: 1,
  },
  createPmSnapshotReconcileTask: {
    "deps.auditLog.append": 2,
    "deps.client.listCurrentSnapshots": 1,
    "deps.repo.recordSnapshot": 1,
    "deps.traceIdProvider": 1,
    "now.toISOString": 3,
  },
  createSevenKeysMonthlySnapshotTask: {
    buildSevenKeysMonthlySnapshot: 1,
    "deps.auditLog.append": 2,
    "deps.provider.listExecutiveProjects": 1,
    "deps.repo.findByProjectMonth": 1,
    "deps.repo.findLatestBefore": 1,
    "deps.repo.insert": 1,
    "deps.traceIdProvider": 1,
    isNthBusinessDayOfMonth: 1,
    nextActions: 1,
    "now.toISOString": 1,
    toExecutiveSevenKeys: 1,
    "today.slice": 1,
    todayJstDateString: 1,
  },
  createPrjopsWeeklyAnalyzeTask: {
    String: 3,
    analyze: 1,
    "deps.auditLog.append": 8,
    "deps.graphClient.sendMail": 1,
    "deps.provider.listActiveProjects": 1,
    "deps.traceIdProvider": 2,
    failureSchedule: 1,
    isWeeklyAnalysisDue: 1,
    "now.getTime": 4,
    "now.toISOString": 8,
    "projects.map": 1,
    sanitizeSecrets: 3,
    sendPmoEscalation: 2,
    todayJstDateString: 1,
  },
  createPrjopsDailyTrackerTask: {
    "Math.max": 1,
    String: 3,
    "deps.auditLog.append": 8,
    "deps.graphClient.sendAdaptiveCard": 1,
    "deps.graphClient.sendMail": 2,
    "deps.provider.listOpenActions": 1,
    "deps.stateRepo.findMany": 1,
    "deps.stateRepo.recordOutcome": 1,
    "deps.traceIdProvider": 2,
    emptyState: 1,
    failureSchedule: 1,
    isDailyTrackingDue: 1,
    isSameJstDate: 1,
    "notifiedActionIds.add": 3,
    "notifiedActionIds.clear": 1,
    "notifiedActionIds.has": 1,
    "now.getTime": 4,
    "now.toISOString": 9,
    process: 1,
    sanitizeSecrets: 3,
    sendPmoEscalation: 2,
    "sourceActions.map": 1,
    "states.get": 1,
    todayJstDateString: 1,
  },
  createReportDeliveryTask: {
    "AbortSignal.timeout": 1,
    "Date.parse": 1,
    deliverStandardReportToRecipients: 1,
    "deps.auditLog.append": 2,
    "deps.standardReportsRepo.listRecent": 1,
    "deps.traceIdProvider": 1,
    isFirstBusinessDayOfWeek: 1,
    jstDateAtStart: 1,
    jstDayOfWeek: 1,
    "now.getTime": 1,
    "now.toISOString": 1,
    verificationProvidersFromSnapshot: 1,
  },
};

export const LEGACY_TASK_SOURCE_PATHS: Readonly<
  Record<Exclude<SchedulerRegistration, "inline:capability-metrics-refresh-30s">, string>
> = {
  createHealthcheckTask: "packages/server/src/scheduler/tasks/healthcheckTask.ts",
  createReportDeliveryMetricsTask: "packages/server/src/scheduler/tasks/reportDeliveryMetricsTask.ts",
  createApprovedDeployTask: "packages/server/src/scheduler/tasks/approvedDeployTask.ts",
  createProdMonitorTask: "packages/server/src/scheduler/tasks/prodMonitorTask.ts",
  createJitRevocationTask: "packages/server/src/scheduler/tasks/jitRevocationTask.ts",
  createCodingTaskReaperTask: "packages/server/src/scheduler/tasks/codingTaskReaperTask.ts",
  createSubscriptionRenewalTask: "packages/server/src/scheduler/tasks/subscriptionRenewalTask.ts",
  createChannelPollingTask: "packages/server/src/scheduler/tasks/channelPollingTask.ts",
  createEventsPollingTask: "packages/server/src/scheduler/tasks/eventsPollingTask.ts",
  createPmSnapshotReconcileTask: "packages/server/src/scheduler/tasks/pmSnapshotReconcileTask.ts",
  createSevenKeysMonthlySnapshotTask: "packages/server/src/scheduler/tasks/sevenKeysMonthlySnapshotTask.ts",
  createPrjopsWeeklyAnalyzeTask: "packages/server/src/scheduler/tasks/prjopsWeeklyAnalyzeTask.ts",
  createPrjopsDailyTrackerTask: "packages/server/src/scheduler/tasks/prjopsDailyTrackerTask.ts",
  createReportDeliveryTask: "packages/server/src/scheduler/tasks/reportDeliveryTask.ts",
};

const TEMPORAL_MAPPINGS: readonly TemporalMapping[] = [
  {
    registration: "createHealthcheckTask",
    task: "healthcheck",
    action: "health.evaluate",
    firstDelayMs: 30_000,
    everyMs: 30_000,
    temporalTarget: "healthEvaluationWorkflow",
    temporalSource: "P3-T06 schedule",
  },
  {
    registration: "inline:capability-metrics-refresh-30s",
    task: "capability-metrics-refresh-30s",
    action: "capabilities.refresh",
    firstDelayMs: 30_000,
    everyMs: 30_000,
    temporalTarget: "mapping:capabilityMetricsRefreshWorkflow",
    temporalSource: "mapping table (not implemented)",
  },
  {
    registration: "createReportDeliveryMetricsTask",
    task: "report-delivery-metrics",
    action: "report-delivery.metrics.refresh",
    firstDelayMs: 60_000,
    everyMs: 60_000,
    temporalTarget: "mapping:reportDeliveryMetricsWorkflow",
    temporalSource: "mapping table (not implemented)",
  },
  {
    registration: "createApprovedDeployTask",
    task: "approved-deploy",
    action: "deploy.approved.dispatch",
    firstDelayMs: 0,
    everyMs: 30_000,
    temporalTarget: "mapping:approvedDeployWorkflow",
    temporalSource: "mapping table (not implemented)",
    reason:
      "legacy dispatch runs immediately, then anchors recurrence to startup completion; the mapping has a fixed observedAt phase",
    reasonedLegacy: { firstDelayMs: 0, everyMs: 30_000 },
  },
  {
    registration: "createProdMonitorTask",
    task: "prod-monitor",
    action: "deploy.prod.monitor",
    firstDelayMs: 60_000,
    everyMs: 60_000,
    temporalTarget: "mapping:prodMonitorWorkflow",
    temporalSource: "mapping table (not implemented)",
  },
  {
    registration: "createJitRevocationTask",
    task: "jit-revocation",
    action: "jit.expired.revoke",
    firstDelayMs: 60_000,
    everyMs: 60_000,
    temporalTarget: "jitExpiryWorkflow",
    temporalSource: "P3-T06 schedule",
  },
  {
    registration: "createCodingTaskReaperTask",
    task: "coding-task-reaper",
    action: "coding-task.reap",
    firstDelayMs: 300_000,
    everyMs: 300_000,
    temporalTarget: "mapping:codingTaskReaperWorkflow",
    temporalSource: "mapping table (not implemented)",
  },
  {
    registration: "createSubscriptionRenewalTask",
    task: "subscription-renewal",
    action: "graph.subscription.renew",
    firstDelayMs: 237_300_000,
    everyMs: 237_300_000,
    temporalTarget: "graphSubscriptionWorkflow:renewal",
    temporalSource: "P3-T05 schedule",
    reason: "legacy scans immediately/every 30m; Temporal targets expiry-minus-6h and removes polling drift",
    reasonedLegacy: { firstDelayMs: 0, everyMs: 1_800_000 },
  },
  {
    registration: "createChannelPollingTask",
    task: "channel-polling",
    action: "graph.channel.delta",
    firstDelayMs: 300_000,
    everyMs: 300_000,
    temporalTarget: "graphSubscriptionWorkflow:delta",
    temporalSource: "P3-T05 schedule",
    reason:
      "legacy performs startup recovery immediately and anchors recurrence to its completion; Temporal begins at a fixed observedAt+5m phase",
    reasonedLegacy: { firstDelayMs: 0, everyMs: 300_000 },
  },
  {
    registration: "createEventsPollingTask",
    task: "events-polling",
    action: "events.poll",
    firstDelayMs: 5_000,
    everyMs: 5_000,
    temporalTarget: "mapping:eventsPollingWorkflow",
    temporalSource: "mapping table (not implemented)",
  },
  {
    registration: "createPmSnapshotReconcileTask",
    task: "pm-snapshot-reconcile",
    action: "project-snapshot.reconcile",
    firstDelayMs: 6 * 60 * 60 * 1000,
    everyMs: 6 * 60 * 60 * 1000,
    temporalTarget: "mapping:pmSnapshotReconcileWorkflow",
    temporalSource: "mapping table (P3-T08 planeSyncWorkflow is not a semantic counterpart)",
  },
  {
    registration: "createSevenKeysMonthlySnapshotTask",
    task: "seven-keys-monthly-snapshot",
    action: "seven-keys.snapshot",
    firstDelayMs: 24 * 60 * 60 * 1000,
    everyMs: 24 * 60 * 60 * 1000,
    temporalTarget: "mapping:sevenKeysMonthlySnapshotWorkflow",
    temporalSource: "mapping table (not implemented)",
  },
  {
    registration: "createPrjopsWeeklyAnalyzeTask",
    task: "prjops-weekly-analyze",
    action: "prjops.weekly.analyze",
    firstDelayMs: 6 * 60 * 60_000 + 60_000,
    everyMs: 60_000,
    temporalTarget: "mapping:prjopsWeeklyAnalyzeWorkflow",
    temporalSource: "mapping table (not implemented)",
  },
  {
    registration: "createPrjopsDailyTrackerTask",
    task: "prjops-daily-tracker",
    action: "prjops.daily.track",
    firstDelayMs: 9 * 60 * 60_000 + 60_000,
    everyMs: 60_000,
    temporalTarget: "mapping:prjopsDailyTrackerWorkflow",
    temporalSource: "mapping table (not implemented)",
  },
  {
    registration: "createReportDeliveryTask",
    task: "report-delivery",
    action: "report.deliver",
    firstDelayMs: 24 * 60 * 60 * 1000,
    everyMs: 24 * 60 * 60 * 1000,
    temporalTarget: "reportDeliveryWorkflow",
    temporalSource: "P3-T07 workflow + mapping table (schedule not implemented)",
  },
];

function propertyName(node: ts.PropertyName): string | null {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
}

export function extractSchedulerRegistrations(source: string, conditions: ShadowLegacyConditions): string[] {
  const file = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const schedulerTaskArrays: ts.ArrayLiteralExpression[] = [];
  const findScheduler = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "startScheduler" &&
      ts.isArrayLiteralExpression(node.arguments[0])
    ) {
      schedulerTaskArrays.push(node.arguments[0]);
    }
    ts.forEachChild(node, findScheduler);
  };
  findScheduler(file);
  if (schedulerTaskArrays.length !== 1) {
    throw new Error(
      `index.ts must contain exactly one startScheduler task array; found=${String(schedulerTaskArrays.length)}`,
    );
  }
  const schedulerTasks = schedulerTaskArrays[0];

  const classify = (element: ts.Expression): { position: number; key: string } => {
    const found: Array<{ position: number; key: string }> = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        /^create[A-Z][A-Za-z0-9]*Task$/u.test(node.expression.text)
      ) {
        found.push({ position: node.getStart(file), key: node.expression.text });
      } else if (ts.isObjectLiteralExpression(node)) {
        const name = node.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) && propertyName(property.name) === "name",
        );
        const interval = node.properties.some(
          (property) => ts.isPropertyAssignment(property) && propertyName(property.name) === "intervalMs",
        );
        if (name && interval && ts.isStringLiteral(name.initializer)) {
          found.push({ position: node.getStart(file), key: `inline:${name.initializer.text}` });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(element);
    if (found.length !== 1) {
      throw new Error(`scheduler entry must contain exactly one recognized task; found=${String(found.length)}`);
    }
    return found[0];
  };
  const effectiveElements = schedulerTasks.elements.flatMap((element): readonly ts.Expression[] => {
    if (!ts.isSpreadElement(element)) return [element];
    const conditional = ts.isParenthesizedExpression(element.expression)
      ? element.expression.expression
      : element.expression;
    if (!ts.isConditionalExpression(conditional) || conditional.condition.getText(file) !== "githubPolicy.enabled") {
      throw new Error(`scheduler spread condition is not modeled: ${conditional.getText(file)}`);
    }
    const branch = conditions.githubPolicyEnabled ? conditional.whenTrue : conditional.whenFalse;
    if (!ts.isArrayLiteralExpression(branch)) {
      throw new Error("scheduler conditional branch must be an array literal");
    }
    return branch.elements;
  });
  // P3-T10-002: 各 element は exactly one の cutover(<literal>, task) wrapper を持ち、
  // literal は内側で分類された registration と一致しなければならない。wrapper の
  // 欠落・二重・鍵不一致・鍵重複は抑止対象を静かに狂わせるため fail-closed で拒否。
  const cutoverKeyOf = (element: ts.Expression): string => {
    const wrappers: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cutover") {
        const first = node.arguments[0];
        if (first === undefined || !ts.isStringLiteral(first)) {
          throw new Error("cutover wrapper must take a string literal registration key");
        }
        wrappers.push(first.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(element);
    if (wrappers.length !== 1) {
      throw new Error(`scheduler entry must contain exactly one cutover wrapper; found=${String(wrappers.length)}`);
    }
    return wrappers[0];
  };
  const found = effectiveElements.map((element) => {
    const classified = classify(element);
    const wrapperKey = cutoverKeyOf(element);
    if (wrapperKey !== classified.key) {
      throw new Error(
        `cutover wrapper key ${JSON.stringify(wrapperKey)} does not match the registered task ${JSON.stringify(
          classified.key,
        )}`,
      );
    }
    return classified;
  });
  const ordered = found.sort((left, right) => left.position - right.position).map(({ key }) => key);
  const duplicate = ordered.find((key, index) => ordered.indexOf(key) !== index);
  if (duplicate !== undefined) {
    throw new Error(`duplicate cutover registration key: ${JSON.stringify(duplicate)}`);
  }
  return ordered;
}

function evaluateNumber(expression: ts.Expression, bindings: ReadonlyMap<string, number>): number | undefined {
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (ts.isIdentifier(expression)) return bindings.get(expression.text);
  if (ts.isParenthesizedExpression(expression)) return evaluateNumber(expression.expression, bindings);
  if (!ts.isBinaryExpression(expression)) return undefined;
  if (expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    return evaluateNumber(expression.left, bindings) ?? evaluateNumber(expression.right, bindings);
  }
  const left = evaluateNumber(expression.left, bindings);
  const right = evaluateNumber(expression.right, bindings);
  if (left === undefined || right === undefined) return undefined;
  switch (expression.operatorToken.kind) {
    case ts.SyntaxKind.PlusToken:
      return left + right;
    case ts.SyntaxKind.MinusToken:
      return left - right;
    case ts.SyntaxKind.AsteriskToken:
      return left * right;
    case ts.SyntaxKind.SlashToken:
      return left / right;
    default:
      return undefined;
  }
}

function objectProperty(object: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find((property) => "name" in property && propertyName(property.name) === name);
}

function propertyExpression(property: ts.ObjectLiteralElementLike | undefined): ts.Expression | undefined {
  if (property && ts.isPropertyAssignment(property)) return property.initializer;
  if (property && ts.isShorthandPropertyAssignment(property)) return property.name;
  return undefined;
}

function callPath(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isNonNullExpression(expression) || ts.isParenthesizedExpression(expression)) {
    return callPath(expression.expression);
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = callPath(expression.expression);
    return owner ? `${owner}.${expression.name.text}` : null;
  }
  return null;
}

function callCounts(node: ts.Node): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (current: ts.Node): void => {
    if (ts.isCallExpression(current)) {
      const path = callPath(current.expression);
      if (path) counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return counts;
}

function extractInlineTask(source: string, expectedName: string): SchedulerMetadata {
  const file = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let result: SchedulerMetadata | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const name = propertyExpression(objectProperty(node, "name"));
      const interval = propertyExpression(objectProperty(node, "intervalMs"));
      const runOnStart = propertyExpression(objectProperty(node, "runOnStart"));
      if (name && ts.isStringLiteral(name) && name.text === expectedName) {
        const intervalMs = interval ? evaluateNumber(interval, new Map()) : undefined;
        if (intervalMs === undefined) throw new Error(`${expectedName} intervalMs must be numeric`);
        if (runOnStart && runOnStart.kind !== ts.SyntaxKind.TrueKeyword) {
          throw new Error(`${expectedName} runOnStart must be true when present`);
        }
        result = { name: name.text, intervalMs, runOnStart: Boolean(runOnStart) };
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!result) throw new Error(`${expectedName} inline scheduler task not found`);
  return result;
}

function extractFactoryTask(source: string, registration: string): SchedulerMetadata {
  const file = ts.createSourceFile(`${registration}.ts`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let factory: ts.FunctionDeclaration | undefined;
  ts.forEachChild(file, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === registration) factory = node;
  });
  if (!factory?.body) throw new Error(`${registration} factory not found`);

  const bindings = new Map<string, number>();
  let returned: ts.ObjectLiteralExpression | undefined;
  for (const statement of factory.body.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          const value = evaluateNumber(declaration.initializer, bindings);
          if (value !== undefined) bindings.set(declaration.name.text, value);
        }
      }
    } else if (
      ts.isReturnStatement(statement) &&
      statement.expression &&
      ts.isObjectLiteralExpression(statement.expression)
    ) {
      returned = statement.expression;
    }
  }
  if (!returned) throw new Error(`${registration} returned scheduler task not found`);
  const name = propertyExpression(objectProperty(returned, "name"));
  const interval = propertyExpression(objectProperty(returned, "intervalMs"));
  const runOnStart = propertyExpression(objectProperty(returned, "runOnStart"));
  const intervalMs = interval ? evaluateNumber(interval, bindings) : undefined;
  if (!name || !ts.isStringLiteral(name) || intervalMs === undefined) {
    throw new Error(`${registration} scheduler metadata is not statically readable`);
  }
  if (runOnStart && runOnStart.kind !== ts.SyntaxKind.TrueKeyword) {
    throw new Error(`${registration} runOnStart must be true when present`);
  }
  return { name: name.text, intervalMs, runOnStart: Boolean(runOnStart) };
}

function compositionIntervalOverride(source: string, registration: string): number | undefined {
  const file = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let result: number | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === registration &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const interval = propertyExpression(objectProperty(node.arguments[0], "intervalMs"));
      if (interval) {
        result = evaluateNumber(interval, new Map());
        if (result === undefined) throw new Error(`${registration} intervalMs override must be deterministic`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return result;
}

export type LegacyTaskSources = Readonly<
  Record<Exclude<SchedulerRegistration, "inline:capability-metrics-refresh-30s">, string>
>;

function legacyTaskMetadata(
  registration: SchedulerRegistration,
  schedulerSource: string,
  taskSources: LegacyTaskSources,
): SchedulerMetadata {
  const task =
    registration === "inline:capability-metrics-refresh-30s"
      ? extractInlineTask(schedulerSource, "capability-metrics-refresh-30s")
      : extractFactoryTask(taskSources[registration], registration);
  const override = compositionIntervalOverride(schedulerSource, registration);
  const composed = override === undefined ? task : { ...task, intervalMs: override };
  if (!Number.isSafeInteger(composed.intervalMs) || composed.intervalMs <= 0) {
    throw new Error(`legacy scheduler metadata is missing or invalid for ${registration}`);
  }
  return composed;
}

function legacyAction(
  registration: SchedulerRegistration,
  schedulerSource: string,
  taskSources: LegacyTaskSources,
): string {
  const fileSource =
    registration === "inline:capability-metrics-refresh-30s" ? schedulerSource : taskSources[registration];
  const file = ts.createSourceFile(`${registration}.ts`, fileSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let taskNode: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (registration === "inline:capability-metrics-refresh-30s" && ts.isObjectLiteralExpression(node)) {
      const name = propertyExpression(objectProperty(node, "name"));
      if (name && ts.isStringLiteral(name) && name.text === "capability-metrics-refresh-30s") {
        taskNode = node;
      }
    } else if (ts.isFunctionDeclaration(node) && node.name?.text === registration) {
      taskNode = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!taskNode) throw new Error(`legacy action source not found for ${registration}`);
  const counts = callCounts(taskNode);
  const invalid = LEGACY_ACTION_CALLS[registration].filter((call) => counts.get(call) !== 1);
  if (invalid.length > 0) throw new Error(`legacy action call mismatch for ${registration}: ${invalid.join(",")}`);
  const expectedCalls = LEGACY_CALL_COUNTS[registration];
  const callMismatch = [...new Set([...Object.keys(expectedCalls), ...counts.keys()])].filter(
    (call) => counts.get(call) !== expectedCalls[call],
  );
  if (callMismatch.length > 0) {
    throw new Error(`legacy call inventory mismatch for ${registration}: ${callMismatch.join(",")}`);
  }
  return LEGACY_ACTIONS[registration];
}

export function compareSchedulerInventory(actual: readonly string[], expected: readonly string[]): void {
  const duplicate = actual.find((key, index) => actual.indexOf(key) !== index);
  const missing = expected.filter((key) => !actual.includes(key));
  const unexpected = actual.filter((key) => !expected.includes(key));
  if (duplicate || missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `scheduler inventory mismatch: missing=${missing.join(",") || "none"}; ` +
        `unexpected=${unexpected.join(",") || "none"}; duplicate=${duplicate ?? "none"}`,
    );
  }
  if (actual.some((key, index) => key !== expected[index])) {
    throw new Error("scheduler inventory order differs from index.ts registration order");
  }
}

function assertWorkflowStructure(
  source: string,
  fileName: string,
  functionName: string,
  expectedCalls: Readonly<Record<string, number>>,
  expectedIdentifiers: readonly string[] = [],
): void {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let workflow: ts.FunctionDeclaration | undefined;
  ts.forEachChild(file, (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === functionName &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      workflow = node;
    }
  });
  if (!workflow) throw new Error(`${fileName} must export ${functionName}`);
  const calls = callCounts(workflow);
  const invalidCalls = [...new Set([...Object.keys(expectedCalls), ...calls.keys()])].filter(
    (call) => calls.get(call) !== expectedCalls[call],
  );
  const identifiers = new Map<string, number>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) identifiers.set(node.text, (identifiers.get(node.text) ?? 0) + 1);
    ts.forEachChild(node, visit);
  };
  visit(workflow);
  const invalidIdentifiers = expectedIdentifiers.filter((identifier) => identifiers.get(identifier) !== 1);
  if (invalidCalls.length > 0 || invalidIdentifiers.length > 0) {
    throw new Error(
      `${fileName} workflow structure mismatch: calls=${invalidCalls.join(",") || "none"}; ` +
        `identifiers=${invalidIdentifiers.join(",") || "none"}`,
    );
  }
}

function assertFunctionSourceHash(source: string, fileName: string, functionName: string, expectedHash: string): void {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let target: ts.FunctionDeclaration | undefined;
  ts.forEachChild(file, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) target = node;
  });
  const actualHash = target ? createHash("sha256").update(target.getText(file)).digest("hex") : "missing";
  if (actualHash !== expectedHash) throw new Error(`${fileName} guard predicate changed: ${functionName}`);
}

interface TemporalScheduleLike {
  readonly scheduleId: string;
  readonly spec?: {
    readonly startAt?: Date | string;
    readonly intervals?: readonly { readonly every?: unknown; readonly offset?: unknown }[];
  };
  readonly action?: {
    readonly type?: unknown;
    readonly workflowType?: unknown;
    readonly args?: readonly unknown[];
  };
}

interface TemporalPlan {
  readonly action: string;
  readonly target: string;
  readonly plannedAtMs: number;
  readonly everyMs: number;
}

const SCHEDULE_ACTIONS: Readonly<Record<string, string>> = {
  health: "health.evaluate",
  "jit-expiry": "jit.expired.revoke",
  renewal: "graph.subscription.renew",
  delta: "graph.channel.delta",
  reconcile: "graph.subscription.reconcile",
};

function schedulePlan(schedule: TemporalScheduleLike): TemporalPlan {
  const startAt = schedule.spec?.startAt;
  const plannedAtMs =
    startAt instanceof Date ? startAt.getTime() : typeof startAt === "string" ? Date.parse(startAt) : NaN;
  const everyMs = schedule.spec?.intervals?.[0]?.every;
  const offsetMs = schedule.spec?.intervals?.[0]?.offset;
  const action = schedule.action;
  const input = action?.args?.[0];
  const payload = typeof input === "object" && input !== null && "payload" in input ? input.payload : undefined;
  const operation =
    typeof payload === "object" && payload !== null && "operation" in payload ? payload.operation : undefined;
  if (
    !Number.isSafeInteger(plannedAtMs) ||
    typeof everyMs !== "number" ||
    !Number.isSafeInteger(everyMs) ||
    everyMs <= 0 ||
    typeof offsetMs !== "number" ||
    !Number.isSafeInteger(offsetMs) ||
    offsetMs < 0 ||
    offsetMs >= everyMs ||
    action?.type !== "startWorkflow" ||
    typeof action.workflowType !== "string" ||
    typeof operation !== "string" ||
    !SCHEDULE_ACTIONS[operation]
  ) {
    throw new Error(`Temporal schedule ${schedule.scheduleId} plan is missing or invalid`);
  }
  const phaseDelta = (((plannedAtMs - offsetMs) % everyMs) + everyMs) % everyMs;
  return {
    action: SCHEDULE_ACTIONS[operation],
    target:
      action.workflowType === "graphSubscriptionWorkflow" ? `${action.workflowType}:${operation}` : action.workflowType,
    plannedAtMs: phaseDelta === 0 ? plannedAtMs : plannedAtMs + everyMs - phaseDelta,
    everyMs,
  };
}

function findSchedule<T extends TemporalScheduleLike>(schedules: readonly T[], marker: string): T {
  const schedule = schedules.find(({ scheduleId }) => scheduleId.includes(marker));
  if (!schedule) throw new Error(`Temporal schedule ${marker} not found`);
  return schedule;
}

export function assertPlanOnlySource(source: string, additionalAllowedImports: readonly string[] = []): void {
  const file = ts.createSourceFile("shadow.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const allowedImports = new Set([
    "typescript",
    "node:crypto",
    "../../packages/control-plane/src/lib/graphSubscriptionSchedules.js",
    "../../packages/control-plane/src/lib/graphSubscriptionState.js",
    "../../packages/control-plane/src/lib/jitHealthSchedules.js",
    "../../packages/shared/src/calendar/businessCalendar.js",
    ...additionalAllowedImports,
  ]);
  let violation: string | null = null;
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.importClause?.isTypeOnly && !allowedImports.has(node.moduleSpecifier.text)) {
        violation = `import ${node.moduleSpecifier.text}`;
      }
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) violation = "dynamic import";
      if (ts.isIdentifier(node.expression) && ["eval", "fetch"].includes(node.expression.text)) {
        violation = `call ${node.expression.text}`;
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "process" &&
        node.expression.name.text === "getBuiltinModule"
      ) {
        violation = "call process.getBuiltinModule";
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["Function", "WebSocket", "EventSource"].includes(node.expression.text)
    ) {
      violation = `new ${node.expression.text}`;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (violation) throw new Error(`shadow harness exposes a side-effect capability: ${violation}`);
}

export function assertPlanOnlyBundle(source: string): void {
  const networkModule =
    /(?:require|__require)\(["'](?:node:)?(?:dgram|dns|http|http2|https|net|quic|tls)(?:\/[^"']+)?["']\)/u.exec(
      source,
    )?.[0];
  if (networkModule) throw new Error(`shadow bundle exposes a network capability: ${networkModule}`);
}

export function assertReadOnlyProcess(): void {
  if (
    !process.permission ||
    process.permission.has("fs.write") ||
    process.permission.has("child") ||
    process.permission.has("worker") ||
    process.permission.has("addon")
  ) {
    throw new Error("shadow runner requires Node --permission with no write, child, worker, or addon capability");
  }
}

export interface TemporalShadowInput {
  readonly observedAtMs: number;
  readonly schedulerSource: string;
  readonly legacyTaskSources: LegacyTaskSources;
  readonly prjopsJobPolicySource: string;
  readonly reportDeliveryWorkflowSource: string;
  readonly planeSyncWorkflowSource: string;
}

const SHADOW_CALENDAR = buildHolidayCalendar([]);

function isFirstBusinessDayOfWeek(now: Date): boolean {
  const today = todayJstDateString(now);
  if (!isBusinessDay(SHADOW_CALENDAR, today)) return false;
  const daysSinceMonday = (dayOfWeek(today) + 6) % 7;
  for (let daysAgo = 1; daysAgo <= daysSinceMonday; daysAgo += 1) {
    const previous = new Date(Date.parse(`${today}T00:00:00.000Z`) - daysAgo * 24 * 60 * 60_000)
      .toISOString()
      .slice(0, 10);
    if (isBusinessDay(SHADOW_CALENDAR, previous)) return false;
  }
  return true;
}

function nextLegacyActionAt(registration: SchedulerRegistration, firstTickAtMs: number, everyMs: number): number {
  const due = (atMs: number): boolean => {
    const now = new Date(atMs);
    switch (registration) {
      case "createSevenKeysMonthlySnapshotTask":
        return isNthBusinessDayOfMonth(SHADOW_CALENDAR, todayJstDateString(now), 1);
      case "createPrjopsWeeklyAnalyzeTask":
        return dayOfWeek(todayJstDateString(now)) === 1 && nowJstHHmm(now) === "06:00";
      case "createPrjopsDailyTrackerTask":
        return isBusinessDay(SHADOW_CALENDAR, todayJstDateString(now)) && nowJstHHmm(now) === "09:00";
      case "createReportDeliveryTask":
        return isFirstBusinessDayOfWeek(now);
      default:
        return true;
    }
  };
  const limit = firstTickAtMs + 370 * 24 * 60 * 60_000;
  for (let atMs = firstTickAtMs; atMs <= limit; atMs += everyMs) {
    if (due(atMs)) return atMs;
  }
  throw new Error(`no guarded legacy action is due within the deterministic horizon for ${registration}`);
}

export function runTemporalShadowComparison(input: TemporalShadowInput) {
  if (!Number.isSafeInteger(input.observedAtMs) || input.observedAtMs < 0) {
    throw new RangeError("observedAtMs must be a non-negative safe integer");
  }
  assertFunctionSourceHash(
    input.prjopsJobPolicySource,
    "prjopsJobPolicy.ts",
    "isWeeklyAnalysisDue",
    LEGACY_GUARD_SOURCE_HASHES.isWeeklyAnalysisDue,
  );
  assertFunctionSourceHash(
    input.prjopsJobPolicySource,
    "prjopsJobPolicy.ts",
    "isDailyTrackingDue",
    LEGACY_GUARD_SOURCE_HASHES.isDailyTrackingDue,
  );
  assertFunctionSourceHash(
    input.legacyTaskSources.createReportDeliveryTask,
    "reportDeliveryTask.ts",
    "isFirstBusinessDayOfWeek",
    LEGACY_GUARD_SOURCE_HASHES.isFirstBusinessDayOfWeek,
  );
  const registrations = extractSchedulerRegistrations(input.schedulerSource, SHADOW_LEGACY_CONDITIONS);
  compareSchedulerInventory(registrations, EXPECTED_SCHEDULER_REGISTRATIONS);
  compareSchedulerInventory(
    TEMPORAL_MAPPINGS.map(({ registration }) => registration),
    EXPECTED_SCHEDULER_REGISTRATIONS,
  );

  const jitHealth = buildJitHealthSchedules({
    executionMode: "shadow",
    sequence: 1,
    observedAtMs: input.observedAtMs,
    taskQueue: "temporal-shadow",
  });
  const graph = buildGraphSubscriptionSchedules({
    subscriptionId: "temporal-shadow",
    executionMode: "shadow",
    sequence: 1,
    observedAtMs: input.observedAtMs,
    expiresAtMs: input.observedAtMs + GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS,
    taskQueue: "temporal-shadow",
  });
  const temporalSchedulePlans = new Map<string, TemporalPlan>([
    ["healthcheck", schedulePlan(findSchedule(jitHealth, "/health:"))],
    ["jit-revocation", schedulePlan(findSchedule(jitHealth, "/jit-expiry:"))],
    ["subscription-renewal", schedulePlan(findSchedule(graph, "/renewal:"))],
    ["channel-polling", schedulePlan(findSchedule(graph, "/delta:"))],
  ]);
  const graphReconcile = schedulePlan(findSchedule(graph, "/reconcile:"));

  const comparisons = TEMPORAL_MAPPINGS.map((definition) => {
    const legacyTask = legacyTaskMetadata(definition.registration, input.schedulerSource, input.legacyTaskSources);
    const legacyRecurrenceAnchor = legacyTask.runOnStart ? "startup-completion" : "fixed-observed-at";
    const firstLegacyTickAtMs = input.observedAtMs + (legacyTask.runOnStart ? 0 : legacyTask.intervalMs);
    const legacyAtMs = nextLegacyActionAt(definition.registration, firstLegacyTickAtMs, legacyTask.intervalMs);
    const legacyActionName = legacyAction(definition.registration, input.schedulerSource, input.legacyTaskSources);
    const expectedTemporal = {
      action: definition.action,
      target: definition.temporalTarget,
      plannedAtMs: input.observedAtMs + definition.firstDelayMs,
      everyMs: definition.everyMs,
    };
    const temporal = temporalSchedulePlans.get(definition.task) ?? expectedTemporal;
    const temporalDefinitionMatches =
      temporal.action === expectedTemporal.action &&
      temporal.target === expectedTemporal.target &&
      temporal.plannedAtMs === expectedTemporal.plannedAtMs &&
      temporal.everyMs === expectedTemporal.everyMs;
    const plansMatch =
      legacyActionName === temporal.action &&
      legacyAtMs === temporal.plannedAtMs &&
      legacyTask.intervalMs === temporal.everyMs &&
      legacyRecurrenceAnchor === "fixed-observed-at";
    const reasonedLegacy = definition.reasonedLegacy;
    const exactReasonedDifference =
      Boolean(definition.reason) &&
      reasonedLegacy !== undefined &&
      temporalDefinitionMatches &&
      legacyActionName === temporal.action &&
      legacyAtMs === input.observedAtMs + reasonedLegacy.firstDelayMs &&
      legacyTask.intervalMs === reasonedLegacy.everyMs;
    const status =
      plansMatch && temporalDefinitionMatches
        ? "match"
        : exactReasonedDifference
          ? "reasoned-difference"
          : "unreasoned-difference";
    return {
      task: definition.task,
      registration: definition.registration,
      legacy: {
        action: legacyActionName,
        runtimeName: legacyTask.name,
        plannedAt: new Date(legacyAtMs).toISOString(),
        everyMs: legacyTask.intervalMs,
        recurrenceAnchor: legacyRecurrenceAnchor,
      },
      temporal: {
        action: temporal.action,
        target: temporal.target,
        source: definition.temporalSource,
        plannedAt: new Date(temporal.plannedAtMs).toISOString(),
        everyMs: temporal.everyMs,
        recurrenceAnchor: "fixed-observed-at" as const,
        executionMode: "shadow" as const,
      },
      status,
      ...(definition.reason ? { reason: definition.reason } : {}),
    };
  });
  const matches = comparisons.filter(({ status }) => status === "match").length;
  const reasonedDifferences = comparisons.filter(({ status }) => status === "reasoned-difference").length;
  const unreasonedDifferences = comparisons.length - matches - reasonedDifferences;
  if (unreasonedDifferences > 0) throw new Error("shadow comparison contains an unreasoned plan difference");

  assertWorkflowStructure(
    input.reportDeliveryWorkflowSource,
    "reportDelivery.ts",
    "reportDeliveryWorkflow",
    REPORT_DELIVERY_WORKFLOW_CALL_COUNTS,
  );
  assertWorkflowStructure(
    input.planeSyncWorkflowSource,
    "planeSync.ts",
    "planeSyncWorkflow",
    PLANE_SYNC_WORKFLOW_CALL_COUNTS,
    ["planeProjectionWorkflow", "planeEventWorkflow", "planePromotionWorkflow"],
  );

  const temporalOnlyPlans = [
    {
      action: graphReconcile.action,
      target: graphReconcile.target,
      source: "P3-T05 schedule",
      plannedAt: new Date(graphReconcile.plannedAtMs).toISOString(),
      everyMs: graphReconcile.everyMs,
      executionMode: "shadow" as const,
      reason: "P3-T05 adds an authoritative reconcile schedule with no separate legacy scheduler registration",
    },
  ];

  return {
    schemaVersion: 1 as const,
    observedAt: new Date(input.observedAtMs).toISOString(),
    guardedActionBasis: {
      holidayCalendar: "empty-deterministic",
      sevenKeysMonthlySnapshotAt: comparisons.find(({ task }) => task === "seven-keys-monthly-snapshot")!.legacy
        .plannedAt,
      prjopsWeeklyAnalyzeAt: comparisons.find(({ task }) => task === "prjops-weekly-analyze")!.legacy.plannedAt,
      prjopsDailyTrackerAt: comparisons.find(({ task }) => task === "prjops-daily-tracker")!.legacy.plannedAt,
      reportDeliveryAt: comparisons.find(({ task }) => task === "report-delivery")!.legacy.plannedAt,
    },
    sideEffectMode: "structural-plan-only" as const,
    externalWrites: 0 as const,
    inventory: {
      expected: TEMPORAL_MAPPINGS.length,
      observed: registrations.length,
      complete: true as const,
      conditions: SHADOW_LEGACY_CONDITIONS,
    },
    temporalDefinitions: {
      p3t05GraphSubscriptionSchedules: true,
      p3t06JitHealthSchedules: true,
      p3t07ReportDeliveryWorkflow: true,
      p3t08PlaneSyncWorkflow: true,
      p3t08HasLegacySchedulerCounterpart: false,
    },
    comparisons,
    temporalOnlyPlans,
    summary: { matches, reasonedDifferences, unreasonedDifferences, temporalOnlyPlans: temporalOnlyPlans.length },
  };
}
