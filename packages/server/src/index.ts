/**
 * packages/server/src/index.ts
 *
 * 根拠: ADR-0005（常駐サーバのcomposition root）。
 *   config読込（fail-fast）→ DI組立 → 常駐スケジューラ起動 → HTTP待受 → SIGTERMでgraceful shutdown。
 *
 * DevOps:SPEC-INT-061: GitHub App JWT署名→installation token交換を標準とし、移行用PATを暫定許容する。
 *   いずれも未設定ならGitHub outboundを無効化し、起動時に1回監査する。
 *
 * 2026-07-07 追記（ステップ#8/#9）: 購読管理（subscriptionRenewalTask/channelPollingTask）、
 *   イベントディスパッチ（eventsPollingTask）、Teams会話取込・コマンド実行（teamsConversationAgent）を配線。
 *
 * 2026-07-07 追記（ステップ#10, ADR-0006）: コーディングタスク実行系を配線。
 *   codingTasksRepo・confirm/callbackルート・GitHubリポジトリ解決（projectChannelsRepo.findByProjectId）を追加。
 */
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { deriveCapabilityState, reportDegradation } from "./lib/degradedCapabilities.js";
import { judgeAuditLogPrivilege } from "./lib/auditLogPrivilege.js";
import {
  CALENDAR_COVERAGE_WARNING_DAYS,
  evaluateCalendarCoverage,
  type CalendarCoverage,
} from "./lib/calendarCoverage.js";
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import {
  GraphClient,
  AnthropicStructuredClient,
  createAnthropicTransport,
  PgCostGuard,
  buildHolidayCalendarFromYaml,
  type HolidayEntry,
} from "@aiops/shared";
import { SPEC_INTERNAL_TERMS_PROVIDER } from "@aiops/shared/reporting/internalTerms.js";
import {
  FileSystemPrjopsJobSnapshotSource,
  YamlPrjopsJobDataProvider,
  YamlStakeholderMasterProvider,
} from "@aiops/prjops";
import {
  classifyBuildFailure,
  classifyIncident,
  executeProdDeploy,
  monitorAndRollbackIfNeeded,
  promoteToStagingIfEligible,
  triageAndNotify,
} from "@aiops/devops";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { PgAuditLog } from "./db/pgAuditLog.js";
import { EventsRepo } from "./db/eventsRepo.js";
import { GrantsRepo } from "./db/grantsRepo.js";
import { GraphSubscriptionsRepo } from "./db/graphSubscriptionsRepo.js";
import { ProjectChannelsRepo } from "./db/projectChannelsRepo.js";
import { ChannelMessagesRepo } from "./db/channelMessagesRepo.js";
import { CodingTasksRepo } from "./db/codingTasksRepo.js";
import { PmTimeseriesRepo } from "./db/pmTimeseriesRepo.js";
import { ImportLedgerRepo } from "./db/importLedgerRepo.js";
import { SevenKeysSnapshotsRepo } from "./db/sevenKeysSnapshotsRepo.js";
import { RecipientsRepo } from "./db/recipientsRepo.js";
import { StandardReportsRepo } from "./db/standardReportsRepo.js";
import { ReportDeliveryLogRepo } from "./db/reportDeliveryLogRepo.js";
import { ReportDeliveryMetricsRepo } from "./db/reportDeliveryMetricsRepo.js";
import { ApprovalsRepo } from "./db/approvalsRepo.js";
import { DeploymentsRepo } from "./db/deploymentsRepo.js";
import { ActionReminderStateRepo } from "./db/actionReminderStateRepo.js";
import { buildApp } from "./http/app.js";
import {
  guardFailsafeTask,
  instrumentScheduledTask,
  startScheduler,
  type ScheduledTask,
} from "./scheduler/scheduler.js";
import { createHealthcheckTask } from "./scheduler/tasks/healthcheckTask.js";
import { createJitRevocationTask } from "./scheduler/tasks/jitRevocationTask.js";
import { createCodingTaskReaperTask } from "./scheduler/tasks/codingTaskReaperTask.js";
import { createSubscriptionRenewalTask } from "./scheduler/tasks/subscriptionRenewalTask.js";
import { backfillGraphSubscription, createChannelPollingTask } from "./scheduler/tasks/channelPollingTask.js";
import { createEventsPollingTask } from "./scheduler/tasks/eventsPollingTask.js";
import { createPmSnapshotReconcileTask } from "./scheduler/tasks/pmSnapshotReconcileTask.js";
import { createSevenKeysMonthlySnapshotTask } from "./scheduler/tasks/sevenKeysMonthlySnapshotTask.js";
import { createReportDeliveryTask, deliverStandardReportToRecipients } from "./scheduler/tasks/reportDeliveryTask.js";
import { createReportDeliveryMetricsTask } from "./scheduler/tasks/reportDeliveryMetricsTask.js";
import { createPrjopsWeeklyAnalyzeTask } from "./scheduler/tasks/prjopsWeeklyAnalyzeTask.js";
import { createPrjopsDailyTrackerTask } from "./scheduler/tasks/prjopsDailyTrackerTask.js";
import { createApprovedDeployTask } from "./scheduler/tasks/approvedDeployTask.js";
import { createProdMonitorTask } from "./scheduler/tasks/prodMonitorTask.js";
import { createMsalGraphTokenProvider } from "./auth/graphTokenProvider.js";
import { createGitHubClientForConfig, type GitHubAuthMode } from "./auth/githubAppTokenProvider.js";
import { TeamsConversationAgent } from "./agents/teamsConversationAgent.js";
import {
  dispatchGithubWebhookEvent,
  type DevopsAgentId,
  type DevopsEventHandlerInput,
} from "./lib/githubEventRouter.js";
import { decideStakeholderMaster } from "./lib/stakeholderYamlLoader.js";
import { handleGraphLifecycleEvent } from "./lib/graphLifecycleHandler.js";
import {
  createBuildEventHandler,
  createDeployEventHandler,
  createIncidentIssueClient,
  createIncidentEventHandler,
  createRecencySimilarIncidentsProvider,
  parseCoverageEvidence,
} from "./agents/devopsEventHandlers.js";
import { createLogger } from "./observability/logger.js";
import { MetricsRegistry } from "./observability/metrics.js";
import type { Logger } from "./observability/logger.js";
import type { TelemetryHandle } from "./observability/telemetry.js";
import { createReadinessCheck } from "./http/routes/health.js";
import { createShutdownSignalHandler, gracefulShutdown } from "./serverLifecycle.js";

export * from "./config.js";
export * from "./http/app.js";
export * from "./http/routes/health.js";
export * from "./http/routes/graphNotifications.js";
export * from "./http/routes/githubWebhook.js";
export * from "./http/routes/codingTasks.js";
export * from "./http/routes/xlsxImport.js";
export * from "./http/routes/reportIngest.js";
export * from "./http/routes/webuiProxy.js";
export * from "./http/routes/approvals.js";
export * from "./scheduler/scheduler.js";
export * from "./scheduler/tasks/healthcheckTask.js";
export * from "./scheduler/tasks/jitRevocationTask.js";
export * from "./scheduler/tasks/subscriptionRenewalTask.js";
export * from "./scheduler/tasks/channelPollingTask.js";
export * from "./scheduler/tasks/eventsPollingTask.js";
export * from "./scheduler/tasks/pmSnapshotReconcileTask.js";
export * from "./scheduler/tasks/sevenKeysMonthlySnapshotTask.js";
export * from "./scheduler/tasks/reportDeliveryTask.js";
export * from "./scheduler/tasks/prjopsWeeklyAnalyzeTask.js";
export * from "./scheduler/tasks/prjopsDailyTrackerTask.js";
export * from "./scheduler/tasks/approvedDeployTask.js";
export * from "./scheduler/tasks/prodMonitorTask.js";
export * from "./observability/logger.js";
export * from "./observability/metrics.js";
export * from "./observability/telemetry.js";
export * from "./serverLifecycle.js";
export * from "./lib/schedulerPolicy.js";
export * from "./lib/dashboardDeepLink.js";
export * from "./lib/graphNotificationValidator.js";
export * from "./lib/graphSubscriptionPolicy.js";
export * from "./lib/channelAuthorization.js";
export * from "./lib/freeTextIntent.js";
export * from "./lib/confirmToken.js";
export * from "./lib/githubEventRouter.js";
export * from "./lib/stakeholderProfileResolver.js";
export * from "./lib/stakeholderYamlLoader.js";
export * from "./lib/graphLifecycleHandler.js";
export * from "./agents/devopsEventHandlers.js";
export * from "./db/pgAuditLog.js";
export * from "./db/eventsRepo.js";
export * from "./db/grantsRepo.js";
export * from "./db/graphSubscriptionsRepo.js";
export * from "./db/projectChannelsRepo.js";
export * from "./db/channelMessagesRepo.js";
export * from "./db/codingTasksRepo.js";
export * from "./db/pmTimeseriesRepo.js";
export * from "./db/reportSnapshotsRepo.js";
export * from "./db/importLedgerRepo.js";
export * from "./db/sevenKeysSnapshotsRepo.js";
export * from "./db/recipientsRepo.js";
export * from "./db/standardReportsRepo.js";
export * from "./db/reportDeliveryLogRepo.js";
export * from "./db/approvalsRepo.js";
export * from "./db/deploymentsRepo.js";
export * from "./db/actionReminderStateRepo.js";
export * from "./auth/graphTokenProvider.js";
export * from "./auth/githubAppTokenProvider.js";
export * from "./agents/teamsConversationAgent.js";

function loadJpHolidayCalendar() {
  const yamlUrl = new URL("../../shared/src/calendar/jp_holidays.yaml", import.meta.url);
  return buildHolidayCalendarFromYaml(readFileSync(yamlUrl, "utf8"));
}

export function updateCalendarCoverageMetric(
  metrics: Pick<MetricsRegistry, "setCalendarCoverageDays">,
  entries: readonly HolidayEntry[],
  now: Date,
): CalendarCoverage {
  const coverage = evaluateCalendarCoverage(entries, now);
  // 不正日を有効日のcoverageで隠さず、空データと同じ -1 で監視をfail-closedにする。
  metrics.setCalendarCoverageDays(coverage.invalidDates.length > 0 ? null : coverage.remainingDays);
  return coverage;
}

export function githubCompositionPolicy(mode: GitHubAuthMode): {
  enabled: boolean;
  blocksWhen(failsafeActive: boolean): boolean;
} {
  const enabled = mode !== "disabled";
  return { enabled, blocksWhen: (failsafeActive) => failsafeActive || !enabled };
}

export async function main(
  bootstrap: {
    config?: ReturnType<typeof loadConfig>;
    logger?: Logger;
    telemetry?: TelemetryHandle;
  } = {},
): Promise<void> {
  const config = bootstrap.config ?? loadConfig();
  const logger = bootstrap.logger ?? createLogger(config.LOG_LEVEL);
  const metrics = new MetricsRegistry();
  const jpHolidayCalendar = loadJpHolidayCalendar();
  const calendarCoverage = updateCalendarCoverageMetric(metrics, jpHolidayCalendar.entries, new Date());
  if (calendarCoverage.shouldWarn) {
    logger.warn(
      { ...calendarCoverage, warningDays: CALENDAR_COVERAGE_WARNING_DAYS },
      "Japanese holiday calendar coverage is low",
    );
  }
  const telemetry = bootstrap.telemetry ?? { shutdown: async () => {} };
  const pool = createPool(config.DATABASE_URL, {
    max: config.DB_POOL_MAX,
    connectionTimeoutMillis: config.DB_POOL_CONNECTION_TIMEOUT_MS,
    statementTimeoutMs: config.DB_STATEMENT_TIMEOUT_MS,
    idleInTransactionSessionTimeoutMs: config.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS,
  });
  const prjopsAuditLog = new PgAuditLog(pool, "prjops_5y");
  const devopsAuditLog = new PgAuditLog(pool, "devops_1y");
  const eventsRepo = new EventsRepo(pool);
  const grantsRepo = new GrantsRepo(pool);
  const graphSubscriptionsRepo = new GraphSubscriptionsRepo(pool);
  const projectChannelsRepo = new ProjectChannelsRepo(pool);
  const channelMessagesRepo = new ChannelMessagesRepo(pool);
  const codingTasksRepo = new CodingTasksRepo(pool);
  const pmTimeseriesRepo = new PmTimeseriesRepo(pool);
  const importLedgerRepo = new ImportLedgerRepo(pool);
  const sevenKeysSnapshotsRepo = new SevenKeysSnapshotsRepo(pool);
  const recipientsRepo = new RecipientsRepo(pool);
  const standardReportsRepo = new StandardReportsRepo(pool);
  const reportDeliveryLogRepo = new ReportDeliveryLogRepo(pool);
  const reportDeliveryMetricsRepo = new ReportDeliveryMetricsRepo(pool);
  const approvalsRepo = new ApprovalsRepo(pool, async (work) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work({ db: client, auditLog: new PgAuditLog(client, "devops_1y") });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  const deploymentsRepo = new DeploymentsRepo(pool);
  const actionReminderStateRepo = new ActionReminderStateRepo(pool);
  // audit_log の追記専用は「接続ロールが UPDATE/DELETE を持たないこと」で強制される。
  // schema.sql の REVOKE は app_role が存在する場合のみ走るため、ロール不在の運用では
  // 黙って外れる。起動時に実権限を確認し、成立していなければ起動を止める
  // （所見 ADV-SEC-005 / DevOps:REQ-028）。
  // パーティション**全体**を見る。PostgreSQL のリレーション権限は親から leaf へ継承されない
  // ので、親だけを調べると「leaf にだけ UPDATE を持つロール」を追記専用と誤判定する。
  // ロールはその leaf を直接指定して書けるし、所有していればトリガも落とせる。
  // 実測: leaf 1 枚に GRANT UPDATE した状態で、親のみの判定は false、集約は true を返す。
  const privilegeRow = await pool.query(
    `SELECT bool_or(has_table_privilege(current_user, relid, 'UPDATE')) AS can_update,
            bool_or(has_table_privilege(current_user, relid, 'DELETE')) AS can_delete,
            bool_or(has_table_privilege(current_user, relid, 'TRUNCATE')) AS can_truncate
       FROM pg_partition_tree('audit_log')`,
  );
  const privilegeVerdict = judgeAuditLogPrivilege({
    canUpdate: privilegeRow.rows[0]?.["can_update"] === true,
    canDelete: privilegeRow.rows[0]?.["can_delete"] === true,
    canTruncate: privilegeRow.rows[0]?.["can_truncate"] === true,
  });
  if (!privilegeVerdict.appendOnly) {
    throw new Error(`E-AUDIT01: ${privilegeVerdict.reason ?? "audit_log is not append-only for this role"}`);
  }

  const stakeholderProvider = config.STAKEHOLDERS_DIR
    ? new YamlStakeholderMasterProvider(config.STAKEHOLDERS_DIR)
    : null;
  const prjopsJobDataProvider = config.PRJOPS_DATA_DIR
    ? new YamlPrjopsJobDataProvider(
        new FileSystemPrjopsJobSnapshotSource(config.PRJOPS_DATA_DIR, config.PRJOPS_DATA_SOURCE_COMMIT_SHA!),
        config.PRJOPS_DATA_COMMIT_SHA!,
        config.PRJOPS_DATA_CONTENT_SHA256!,
      )
    : undefined;
  const personalNamesProvider = (): Promise<readonly string[]> => {
    if (!stakeholderProvider) throw new Error("Stakeholder master is required for report delivery verification");
    return stakeholderProvider.listPersonalNames();
  };
  const stakeholderEmailsProvider = (stakeholderIds: readonly string[]): Promise<ReadonlyMap<string, string>> => {
    if (!stakeholderProvider) throw new Error("Stakeholder master is required for report delivery verification");
    return stakeholderProvider.findEmailsByStakeholderIds(stakeholderIds);
  };
  const verificationSnapshotProvider = () => {
    if (!stakeholderProvider) throw new Error("Stakeholder master is required for report delivery verification");
    return stakeholderProvider.loadDeliveryVerificationSnapshot();
  };
  const internalTermsProvider = (): readonly string[] => SPEC_INTERNAL_TERMS_PROVIDER.listInternalTerms();
  if (internalTermsProvider().length === 0) {
    logger.warn(
      { version: SPEC_INTERNAL_TERMS_PROVIDER.version },
      "report delivery internal terms list is unpopulated",
    );
  }
  const stakeholderMaster = decideStakeholderMaster(stakeholderProvider);
  if (stakeholderMaster.auditIntent) {
    await prjopsAuditLog.append({
      trace_id: randomUUID(),
      ...stakeholderMaster.auditIntent,
      at: new Date().toISOString(),
    });
  }

  const graphTokenProvider = createMsalGraphTokenProvider({
    tenantId: config.GRAPH_TENANT_ID,
    clientId: config.GRAPH_CLIENT_ID,
    clientSecret: config.GRAPH_CLIENT_SECRET,
  });
  const graphClient = new GraphClient(graphTokenProvider, undefined, undefined, undefined, undefined, {
    allowedTeamIds: config.GRAPH_ALLOWED_TEAM_IDS,
    allowedFromMailboxes: config.GRAPH_ALLOWED_FROM_MAILBOXES,
  });

  const { client: githubClient, mode: githubAuthMode } = await createGitHubClientForConfig(config, devopsAuditLog);
  const githubPolicy = githubCompositionPolicy(githubAuthMode);

  // 根拠: FinalArch:LLM-001 / ADR-0022（P2-T06）。server の inference transport は
  // LiteLLM gateway のみ。direct fallback flag の requires
  // （classification<=internal / explicit-provider-allow）は per-call の政策境界を
  // 要求するが、server の consumer（build ログ・incident・change diff・PrjOps・
  // Teams 自由文）は呼び出し単位の分類情報を持たないため、その境界が実装される
  // まで direct transport は構成しない（fail-closed。direct 全面遮断の正典タスクは
  // WBS P2-T10）。flag + key で direct の意図が示された場合は下で監査に顕在化させる。
  const llmTransport = config.LLM_GATEWAY_ENABLED
    ? createAnthropicTransport({
        mode: "gateway",
        baseURL: config.LITELLM_BASE_URL!,
        tokenProvider: { getToken: async () => config.LITELLM_VIRTUAL_KEY! },
        timeoutMs: 600_000,
      })
    : undefined;
  const llmClient = llmTransport
    ? new AnthropicStructuredClient(
        llmTransport,
        new PgCostGuard(pool, { perAgentDailyLimitUsd: { SERVER: 10 }, perAgentRequestLimitUsd: { SERVER: 1 } }),
        {
          defaultModel: config.ANTHROPIC_DEFAULT_MODEL,
          escalationModel: config.ANTHROPIC_ESCALATION_MODEL,
          pricingUsdPerMtok: config.ANTHROPIC_PRICING_USD_PER_MTOK,
          auditLog: prjopsAuditLog,
          traceIdProvider: () => randomUUID(),
        },
      )
    : undefined;
  if (llmTransport) {
    // route metadata の監査記録（FinalArch:LLM-006。トークン・キーは記録しない）
    await prjopsAuditLog.append({
      trace_id: randomUUID(),
      actor: "SERVER",
      action: "llm_transport_configured",
      basis: "FinalArch:LLM-001",
      detail: {
        mode: "gateway",
        gateway_host: new URL(config.LITELLM_BASE_URL!).host,
        default_model: config.ANTHROPIC_DEFAULT_MODEL,
        escalation_model: config.ANTHROPIC_ESCALATION_MODEL,
      },
      at: new Date().toISOString(),
    });
  } else if (config.LLM_DIRECT_FALLBACK_ENABLED && config.ANTHROPIC_API_KEY) {
    // 意図された break-glass を黙殺しない: flag は enable でも、per-call の
    // classification / explicit-provider-allow 境界が server に無いため fail-closed。
    await prjopsAuditLog.append({
      trace_id: randomUUID(),
      actor: "SERVER",
      action: "llm_direct_fallback_unavailable",
      basis: "FinalArch:LLM-001",
      detail: {
        severity: "warn",
        reason:
          "direct fallback flag is enabled but the server has no per-call classification/provider-allow boundary; direct transport stays disabled (canonical direct-egress denial is WBS P2-T10)",
        direct_fallback_flag: "inference.anthropic_direct_fallback.enabled",
        declared_prerequisites: ["classification<=internal", "explicit-provider-allow"],
      },
      at: new Date().toISOString(),
    });
  }

  const similarIncidents = createRecencySimilarIncidentsProvider(async ({ since, limit }) => {
    const result = await pool.query<{ at: Date; detail: unknown }>(
      `SELECT at, detail
         FROM audit_log
        WHERE retention_class = $1
          AND action = $2
          AND at >= $3
        ORDER BY at DESC, log_id DESC
        LIMIT $4`,
      ["devops_1y", "triage", since, limit],
    );
    return result.rows.map((row) => ({ at: row.at.toISOString(), detail: row.detail }));
  });
  const buildTriageConfigured = githubPolicy.enabled && llmClient !== undefined;
  const defaultIncidentChannel =
    config.DEFAULT_TEAMS_TEAM_ID && config.DEFAULT_TEAMS_CHANNEL_ID
      ? { teamId: config.DEFAULT_TEAMS_TEAM_ID, channelId: config.DEFAULT_TEAMS_CHANNEL_ID }
      : undefined;
  const incidentTriageConfigured = buildTriageConfigured && defaultIncidentChannel !== undefined;
  const configuredCheckoutRepository = process.env["GITHUB_REPOSITORY"]?.trim();
  const configuredCheckoutPath = process.env["GITHUB_WORKSPACE"]?.trim();
  const devopsEventHandlers: Record<DevopsAgentId, (event: DevopsEventHandlerInput, traceId: string) => Promise<void>> =
    {
      AGT_BLD: createBuildEventHandler({
        configured: buildTriageConfigured,
        disabledReason: !githubPolicy.enabled
          ? "GitHub authentication is not configured"
          : "LLM transport is not configured (LiteLLM gateway or direct fallback)",
        githubClient,
        auditLog: devopsAuditLog,
        repoCheckoutPathFor: (repositoryFullName) =>
          configuredCheckoutRepository === repositoryFullName &&
          configuredCheckoutPath &&
          isAbsolute(configuredCheckoutPath)
            ? configuredCheckoutPath
            : null,
        classify: (evidence, deps) => classifyBuildFailure(evidence, { ...deps, llmClient: llmClient! }),
        // P2-T06-007 fail-closed: 修正案生成は provider-native の Claude Agent SDK 経路
        // （ANTHROPIC_API_KEY 直・gateway alias / PgCostGuard / route 監査を迂回）のため、
        // gateway 経由の専用移行（Claude Code scoped virtual key — ADR-0022 / WBS P8）まで
        // server からは配線しない。要求が来た事実は監査へ顕在化する。
        generate: async (_classification, _repoCheckoutPath, deps) => {
          await deps.auditLog.append({
            trace_id: deps.traceId,
            actor: "AGT-BLD",
            action: "build_fix_suggestion_disabled",
            basis: "FinalArch:LLM-001 / ADR-0022",
            detail: {
              severity: "warn",
              reason:
                "fix-suggestion generation stays disabled pending its gateway migration; the provider-native Agent SDK path bypasses LiteLLM aliases, PgCostGuard and route audit",
            },
            at: new Date().toISOString(),
          });
          return null;
        },
      }),
      AGT_DEP: createDeployEventHandler({
        configured: githubPolicy.enabled && defaultIncidentChannel !== undefined,
        disabledReason: !githubPolicy.enabled
          ? "GitHub authentication is not configured"
          : "Default Teams channel is not configured",
        channel: defaultIncidentChannel,
        coverageEvidence: {
          read: async (owner, repo, runId) => {
            try {
              return parseCoverageEvidence(
                await githubClient.readWorkflowRunJsonArtifact(owner, repo, runId, {
                  artifactName: "agt-dep-th001-evidence",
                  fileName: "agt-dep-evidence.json",
                  maxArchiveBytes: 64_000,
                }),
              );
            } catch {
              return null;
            }
          },
        },
        // D-16: no runtime critical-count authority exists yet. Never infer zero.
        criticalCountEvidence: { read: async () => null },
        deploymentState: deploymentsRepo,
        auditLog: devopsAuditLog,
        promote: (input, channel, commitShaShort, traceId) =>
          promoteToStagingIfEligible(input, channel, commitShaShort, {
            githubClient,
            graphClient,
            auditLog: devopsAuditLog,
            traceId,
            cal: jpHolidayCalendar,
          }),
      }),
      AGT_INC: createIncidentEventHandler({
        configured: incidentTriageConfigured,
        disabledReason: !githubPolicy.enabled
          ? "GitHub authentication is not configured"
          : !llmClient
            ? "LLM transport is not configured (LiteLLM gateway or direct fallback)"
            : "Default Teams channel is not configured",
        channel: defaultIncidentChannel,
        metricsSnapshot: () => metrics.renderPrometheus(),
        similarIncidents,
        findExistingIssue: (owner, repo, marker) => githubClient.findIssueByBodyMarker(owner, repo, marker),
        auditLog: devopsAuditLog,
        classify: (alert, metricsSummary, similarSummary, deps) =>
          classifyIncident(alert, metricsSummary, similarSummary, {
            ...deps,
            llmClient: llmClient!,
            graphClient,
            githubClient,
          }),
        triage: (classification, owner, repo, channel, deps) =>
          triageAndNotify(classification, owner, repo, channel, {
            ...deps,
            llmClient: llmClient!,
            graphClient,
            githubClient: createIncidentIssueClient(githubClient, deps.sourceIssueMarker, deps.existingIssue),
          }),
      }),
    };

  const teamsConversationAgent = new TeamsConversationAgent({
    projectChannelsRepo,
    channelMessagesRepo,
    graphClient,
    githubClient,
    auditLog: prjopsAuditLog,
    llmClient,
    resolveCallerProfile: stakeholderMaster.resolveCallerProfile,
    codingTasksRepo,
    confirmTokenSecret: config.CODING_TASK_CONFIRM_SECRET,
    publicBaseUrl: config.PUBLIC_BASE_URL,
  });

  let failsafeActive = false;
  let shuttingDown = false;
  const guardTask = (task: ScheduledTask, auditLog: PgAuditLog): ScheduledTask =>
    guardFailsafeTask(task, {
      isFailsafeActive: () => failsafeActive,
      auditLog,
      traceIdProvider: () => randomUUID(),
    });
  const observedTask = (task: ScheduledTask): ScheduledTask => instrumentScheduledTask(task, metrics);
  // 根拠: FinalArch:FR-CP-008 / WBS P3-T10。per-workflow cutover の実行ガード。
  // 登録自体は維持し run() のみ抑止する（restart で常に旧経路へ復元可能 = soak 中の
  // old path 可用性）。抑止集合は config（resolveTemporalCutover — kill switch 反映済み）。
  const cutoverSuppressed = config.TEMPORAL_CUTOVER_SUPPRESSED;
  if (cutoverSuppressed.size > 0) {
    logger.info(`temporal cutover: legacy execution suppressed for ${[...cutoverSuppressed].sort().join(", ")}`);
  }
  const cutover = (registration: string, task: ScheduledTask): ScheduledTask =>
    cutoverSuppressed.has(registration as never) ? { ...task, run: async (): Promise<void> => {} } : task;
  const pmSnapshotClient =
    githubPolicy.enabled && config.GITHUB_PROJECT_NODE_ID
      ? {
          listCurrentSnapshots: (cursor?: string | null) =>
            githubClient.listCurrentProjectV2Snapshots({
              projectNodeId: config.GITHUB_PROJECT_NODE_ID!,
              cursor,
            }),
        }
      : {
          listCurrentSnapshots: async () => {
            await prjopsAuditLog.append({
              trace_id: randomUUID(),
              actor: "SERVER",
              action: "pm_snapshot_reconcile_disabled",
              basis: "SPEC-INT-081",
              detail: {
                reason: githubPolicy.enabled
                  ? "GITHUB_PROJECT_NODE_ID is not configured"
                  : "GitHub authentication is not configured",
              },
              at: new Date().toISOString(),
            });
            return { rateLimit: { remaining: 999 }, snapshots: [], hasMore: false };
          },
        };

  // composition root は設定・実行時状態の正規化だけを担い、機能間の依存判定は lib/ に委ねる。
  let subscriptionsPresent = false;
  const refreshSubscriptionPresence = async (): Promise<void> => {
    const notification = await graphSubscriptionsRepo.listByMode("notification");
    const polling = await graphSubscriptionsRepo.listByMode("polling");
    subscriptionsPresent = notification.length + polling.length > 0;
  };
  const capabilityState = () =>
    deriveCapabilityState({
      reportDeliveryEnabled: config.REPORT_DELIVERY_ENABLED,
      fromMailboxConfigured: Boolean(config.FROM_MAILBOX),
      reportIngestConfigured: Boolean(config.REPORT_INGEST_SECRET),
      xlsxImportConfigured: Boolean(config.XLSX_IMPORT_SECRET),
      teamsPersonaConfigured: Boolean(config.STAKEHOLDERS_DIR),
      llmFreeTextConfigured: llmClient !== undefined,
      githubConfigured: githubPolicy.enabled,
      githubProjectConfigured: Boolean(config.GITHUB_PROJECT_NODE_ID),
      sevenKeysSnapshotConfigured: false,
      heartbeatConfigured: Boolean(config.HEARTBEAT_URL),
      metricsEndpointConfigured: Boolean(config.METRICS_TOKEN),
      defaultTeamsTeamConfigured: Boolean(config.DEFAULT_TEAMS_TEAM_ID),
      defaultTeamsChannelConfigured: Boolean(config.DEFAULT_TEAMS_CHANNEL_ID),
      telemetryConfigured: Boolean(config.OTEL_EXPORTER_OTLP_ENDPOINT ?? config.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT),
      graphSubscriptionsPresent: subscriptionsPresent,
      approvalsConfigured: Boolean(config.WEB_BFF_IDENTITY_SECRET),
      prjopsDataConfigured: Boolean(config.PRJOPS_DATA_DIR),
      pmoNotifyMailboxConfigured: Boolean(config.PMO_NOTIFY_MAILBOX),
      // D-16 and D-04 remain loud until their authoritative runtime sources exist.
      stagingPromotionConfigured: false,
      prodDeployConfigured: false,
      prodMonitorConfigured: false,
    });
  const publishCapabilities = (): string[] => {
    const state = capabilityState();
    metrics.setCapabilities(state);
    return reportDegradation(state).disabled;
  };
  await refreshSubscriptionPresence();
  publishCapabilities();

  // 根拠: FinalArch:FR-CP-008。resolveMigrationFlags は legacy scheduler を正本 default=true で
  // 解決する。cutover（temporal primary + legacy false）ではこの in-process scheduler を起動しない。
  // P3-T10-001: exactly-one-writer 判定（kill switch の primary rollback 復元込み）
  // は config 側 resolveLegacySchedulerEffective に集約。
  const legacySchedulerEnabled = config.LEGACY_SCHEDULER_EFFECTIVE;
  const scheduler = !legacySchedulerEnabled
    ? null
    : startScheduler(
        [
          observedTask(
            cutover(
              "createHealthcheckTask",
              createHealthcheckTask({
                checkTargets: async () => {
                  await pool.query("SELECT 1");
                  metrics.setDbPool({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount });
                  return true;
                },
                activateFailsafe: async () => {},
                isFailsafeActive: () => failsafeActive,
                setFailsafeActive: (v) => {
                  failsafeActive = v;
                },
                auditLog: devopsAuditLog,
                traceIdProvider: () => randomUUID(),
              }),
            ),
          ),
          observedTask(
            cutover("inline:capability-metrics-refresh-30s", {
              name: "capability-metrics-refresh-30s",
              intervalMs: 30_000,
              async run(now): Promise<void> {
                // /metrics は同期描画のまま保ち、DBを毎scrapeせず、既存スケジューラで購読状態を更新する。
                // coverage残日数は壁時計で減るため、長期稼働中も同じ30秒taskで閾値 crossing を反映する。
                updateCalendarCoverageMetric(metrics, jpHolidayCalendar.entries, now);
                await refreshSubscriptionPresence();
                publishCapabilities();
              },
            }),
          ),
          // Read-only monitoring must continue during failsafe, so this task is intentionally not guardFailsafeTask-wrapped.
          observedTask(
            cutover(
              "createReportDeliveryMetricsTask",
              createReportDeliveryMetricsTask({ provider: reportDeliveryMetricsRepo, metrics }),
            ),
          ),
          observedTask(
            cutover(
              "createApprovedDeployTask",
              guardTask(
                createApprovedDeployTask({
                  approvalsRepo,
                  deploymentsRepo,
                  workflowExists: (owner, repo) =>
                    githubPolicy.enabled
                      ? githubClient.workflowExists(owner, repo, "deploy-prod.yml")
                      : Promise.resolve(false),
                  execute: (owner, repo, commitSha, traceId) =>
                    executeProdDeploy("approved", owner, repo, commitSha, {
                      githubClient,
                      graphClient,
                      auditLog: devopsAuditLog,
                      traceId,
                      cal: jpHolidayCalendar,
                    }),
                  auditLog: devopsAuditLog,
                  traceIdProvider: () => randomUUID(),
                }),
                devopsAuditLog,
              ),
            ),
          ),
          observedTask(
            cutover(
              "createProdMonitorTask",
              guardTask(
                createProdMonitorTask({
                  deploymentsRepo,
                  // A048 exposes rolling aggregates but not the complete TH-003 windows/baseline contract yet (D-04).
                  metricsProvider: { read: async () => null },
                  stableVersionsProvider: { read: async () => null },
                  workflowExists: (owner, repo) =>
                    githubPolicy.enabled
                      ? githubClient.workflowExists(owner, repo, "deploy-prod.yml")
                      : Promise.resolve(false),
                  evaluate: (input, stableVersions, target, channel, traceId) =>
                    monitorAndRollbackIfNeeded(
                      input,
                      stableVersions,
                      target.owner,
                      target.repo,
                      target.projectId,
                      channel,
                      {
                        githubClient,
                        graphClient,
                        auditLog: devopsAuditLog,
                        traceId,
                        cal: jpHolidayCalendar,
                      },
                    ),
                  auditLog: devopsAuditLog,
                  traceIdProvider: () => randomUUID(),
                }),
                devopsAuditLog,
              ),
            ),
          ),
          ...(githubPolicy.enabled
            ? [
                observedTask(
                  cutover(
                    "createJitRevocationTask",
                    createJitRevocationTask({
                      grantsRepo,
                      secDeps: { githubClient, auditLog: devopsAuditLog },
                      traceIdProvider: () => randomUUID(),
                    }),
                  ),
                ),
              ]
            : []),
          // callback が届かず running のまま残った coding_tasks を終端させる。
          // 実行状態を観測してから判断するため GitHub クライアントを渡す。認証が無効なときは
          // タスク自身が「観測不能」として回収を見送り、理由を監査に残す。
          observedTask(
            cutover(
              "createCodingTaskReaperTask",
              createCodingTaskReaperTask({
                codingTasksRepo,
                auditLog: devopsAuditLog,
                traceIdProvider: () => randomUUID(),
                githubClient: githubPolicy.enabled ? githubClient : undefined,
              }),
            ),
          ),
          observedTask(
            cutover(
              "createSubscriptionRenewalTask",
              createSubscriptionRenewalTask({
                graphSubscriptionsRepo,
                graphClient,
                auditLog: devopsAuditLog,
                traceIdProvider: () => randomUUID(),
                backfillSubscription: async (sub, now) => {
                  await backfillGraphSubscription(
                    sub,
                    {
                      graphSubscriptionsRepo,
                      projectChannelsRepo,
                      channelMessagesRepo,
                      graphClient,
                      auditLog: prjopsAuditLog,
                      traceIdProvider: () => randomUUID(),
                    },
                    now,
                  );
                },
              }),
            ),
          ),
          observedTask(
            cutover(
              "createChannelPollingTask",
              createChannelPollingTask({
                graphSubscriptionsRepo,
                projectChannelsRepo,
                channelMessagesRepo,
                graphClient,
                auditLog: prjopsAuditLog,
                traceIdProvider: () => randomUUID(),
                recovery: {
                  notificationUrl: new URL("/webhooks/graph", config.PUBLIC_BASE_URL).toString(),
                  clientState: config.GRAPH_CLIENT_STATE,
                },
              }),
            ),
          ),
          observedTask(
            cutover(
              "createEventsPollingTask",
              guardTask(
                createEventsPollingTask({
                  eventsRepo,
                  auditLog: devopsAuditLog,
                  dispatchInboundNotification: (payload, traceId) =>
                    teamsConversationAgent.handleNotification(payload, traceId),
                  dispatchGithubEvent: (payload, traceId) =>
                    dispatchGithubWebhookEvent(payload, traceId, {
                      auditLog: devopsAuditLog,
                      handlers: devopsEventHandlers,
                      pmRepo: pmTimeseriesRepo,
                    }),
                  dispatchMonitorEvent: async (payload, traceId) => {
                    await devopsAuditLog.append({
                      trace_id: traceId,
                      actor: "AGT-DEP",
                      action: "monitor_event_received",
                      basis: "DevOps:SPEC-INT-020",
                      detail: { hasPayload: payload !== null && payload !== undefined },
                      at: new Date().toISOString(),
                    });
                  },
                  traceIdProvider: () => randomUUID(),
                  logger,
                  metrics,
                }),
                devopsAuditLog,
              ),
            ),
          ),
          observedTask(
            cutover(
              "createPmSnapshotReconcileTask",
              guardTask(
                createPmSnapshotReconcileTask({
                  repo: pmTimeseriesRepo,
                  client: pmSnapshotClient,
                  auditLog: prjopsAuditLog,
                  traceIdProvider: () => randomUUID(),
                }),
                prjopsAuditLog,
              ),
            ),
          ),
          observedTask(
            cutover(
              "createSevenKeysMonthlySnapshotTask",
              guardTask(
                createSevenKeysMonthlySnapshotTask({
                  repo: sevenKeysSnapshotsRepo,
                  disabledReason: "PrjOps report data provider is not configured",
                  auditLog: prjopsAuditLog,
                  calendar: jpHolidayCalendar,
                  traceIdProvider: () => randomUUID(),
                }),
                prjopsAuditLog,
              ),
            ),
          ),
          observedTask(
            cutover(
              "createPrjopsWeeklyAnalyzeTask",
              guardTask(
                createPrjopsWeeklyAnalyzeTask({
                  provider: prjopsJobDataProvider,
                  auditLog: prjopsAuditLog,
                  traceIdProvider: () => randomUUID(),
                  graphClient,
                  pmoNotifyMailbox: config.PMO_NOTIFY_MAILBOX,
                  fromMailbox: config.FROM_MAILBOX,
                }),
                prjopsAuditLog,
              ),
            ),
          ),
          observedTask(
            cutover(
              "createPrjopsDailyTrackerTask",
              guardTask(
                createPrjopsDailyTrackerTask({
                  provider: prjopsJobDataProvider,
                  stateRepo: actionReminderStateRepo,
                  graphClient,
                  fromMailbox: config.FROM_MAILBOX,
                  pmoNotifyMailbox: config.PMO_NOTIFY_MAILBOX,
                  calendar: jpHolidayCalendar,
                  auditLog: prjopsAuditLog,
                  traceIdProvider: () => randomUUID(),
                }),
                prjopsAuditLog,
              ),
            ),
          ),
          observedTask(
            cutover(
              "createReportDeliveryTask",
              guardTask(
                createReportDeliveryTask({
                  enabled: config.REPORT_DELIVERY_ENABLED,
                  fromMailbox: config.FROM_MAILBOX,
                  defaultTeamsTeamId: config.DEFAULT_TEAMS_TEAM_ID,
                  defaultTeamsChannelId: config.DEFAULT_TEAMS_CHANNEL_ID,
                  publicBaseUrl: config.PUBLIC_BASE_URL,
                  calendar: jpHolidayCalendar,
                  recipientsRepo,
                  standardReportsRepo,
                  graphClient,
                  deliveryLogStore: reportDeliveryLogRepo,
                  auditLog: prjopsAuditLog,
                  personalNamesProvider,
                  stakeholderEmailsProvider,
                  verificationSnapshotProvider,
                  internalTermsProvider,
                  traceIdProvider: () => randomUUID(),
                  heartbeatUrl: config.HEARTBEAT_URL,
                  logger,
                  metrics,
                }),
                prjopsAuditLog,
              ),
            ),
          ),
        ],
        (taskName, err) => {
          // 1タスクの失敗を隔離し、秘密情報を含まない形でstderrへ
          logger.error({ taskName, err: err instanceof Error ? err.message : String(err) }, "scheduler task failed");
        },
      );

  const app = buildApp({
    auditLog: devopsAuditLog,
    readiness: createReadinessCheck({
      checkDependencies: async () => {
        await pool.query("SELECT 1");
        await refreshSubscriptionPresence();
      },
      isFailsafeActive: () => failsafeActive,
      isShuttingDown: () => shuttingDown,
      degradedCapabilities: publishCapabilities,
    }),
    metrics,
    metricsToken: config.METRICS_TOKEN,
    graph: {
      clientState: config.GRAPH_CLIENT_STATE,
      auditLog: devopsAuditLog,
      enqueueInboundEvent: (payload, traceId, options) => eventsRepo.enqueue("inbound", payload, traceId, options),
      handleLifecycleEvent: (event, traceId) =>
        handleGraphLifecycleEvent(event, traceId, {
          graphSubscriptionsRepo,
          graphClient,
          backfillSubscription: async (sub, now) => {
            await backfillGraphSubscription(
              sub,
              {
                graphSubscriptionsRepo,
                projectChannelsRepo,
                channelMessagesRepo,
                graphClient,
                auditLog: prjopsAuditLog,
                traceIdProvider: () => randomUUID(),
              },
              now,
            );
          },
          auditLog: devopsAuditLog,
          traceIdProvider: () => randomUUID(),
        }),
      traceIdProvider: () => randomUUID(),
    },
    github: {
      webhookSecret: config.GITHUB_WEBHOOK_SECRET,
      auditLog: devopsAuditLog,
      enqueueGithubEvent: (eventName, payload, traceId, options) =>
        eventsRepo.enqueue("github", { eventName, payload }, traceId, options),
      traceIdProvider: () => randomUUID(),
    },
    codingTasks: {
      codingTasksRepo,
      githubClient,
      auditLog: devopsAuditLog,
      // 確認トークンの鍵と callback の Bearer は別物。前者は Actions へ渡らない
      // （所見 ADV-SEC-002 / ADV-INT-003）。
      confirmTokenSecret: config.CODING_TASK_CONFIRM_SECRET,
      callbackSecret: config.CODING_TASK_CALLBACK_SECRET,
      resolveRepoForProject: async (projectId) => {
        const channel = await projectChannelsRepo.findByProjectId(projectId);
        if (!channel?.githubOwner || !channel.githubRepo) return null;
        return { githubOwner: channel.githubOwner, githubRepo: channel.githubRepo };
      },
      traceIdProvider: () => randomUUID(),
      isFailsafeActive: () => githubPolicy.blocksWhen(failsafeActive),
    },
    xlsxImport: {
      ledger: importLedgerRepo,
      githubClient,
      auditLog: prjopsAuditLog,
      traceIdProvider: () => randomUUID(),
      importSecret: githubPolicy.enabled ? config.XLSX_IMPORT_SECRET : undefined,
      allowedRepos: config.XLSX_IMPORT_ALLOWED_REPOS,
      isFailsafeActive: () => failsafeActive,
    },
    reports: {
      ingestSecret: config.REPORT_INGEST_SECRET,
      reportsRepo: standardReportsRepo,
      auditLog: prjopsAuditLog,
      traceIdProvider: () => randomUUID(),
      isFailsafeActive: () => failsafeActive,
      deliverReport: async (report, traceId) => {
        if (!config.REPORT_DELIVERY_ENABLED || !config.FROM_MAILBOX) {
          await prjopsAuditLog.append({
            trace_id: traceId,
            actor: "AGT-05",
            action: "report_delivery_disabled",
            basis: "ADR-0014",
            detail: {
              reason: !config.REPORT_DELIVERY_ENABLED
                ? "REPORT_DELIVERY_ENABLED is not true"
                : "FROM_MAILBOX is not configured",
            },
            at: new Date().toISOString(),
          });
          return;
        }
        const result = await deliverStandardReportToRecipients(
          report,
          {
            fromMailbox: config.FROM_MAILBOX,
            defaultTeamsTeamId: config.DEFAULT_TEAMS_TEAM_ID,
            defaultTeamsChannelId: config.DEFAULT_TEAMS_CHANNEL_ID,
            publicBaseUrl: config.PUBLIC_BASE_URL,
            recipientsRepo,
            graphClient,
            deliveryLogStore: reportDeliveryLogRepo,
            auditLog: prjopsAuditLog,
            personalNamesProvider,
            stakeholderEmailsProvider,
            verificationSnapshotProvider,
            internalTermsProvider,
            traceIdProvider: () => randomUUID(),
            logger,
            metrics,
          },
          traceId,
        );
        await prjopsAuditLog.append({
          trace_id: traceId,
          actor: "AGT-05",
          action: result.failed === 0 ? "report_delivery_cycle_completed" : "report_delivery_cycle_failed",
          basis: "PrjOps:REQ-042 SPEC-INT-069 PrjOps:AC-042-1",
          detail: { sent: result.sent, skipped: result.skipped, failed: result.failed },
          at: new Date().toISOString(),
        });
      },
    },
    approvals: {
      approvalsRepo,
      recipientsRepo,
      auditLog: devopsAuditLog,
      identitySecret: config.WEB_BFF_IDENTITY_SECRET,
      traceIdProvider: () => randomUUID(),
    },
    webui: { targetBaseUrl: `http://127.0.0.1:${config.WEBUI_INTERNAL_PORT}` },
  });

  const server = serve({ fetch: app.fetch, port: config.PORT });
  logger.info({ port: config.PORT }, "server listening");

  const runShutdown = createShutdownSignalHandler({
    isShuttingDown: () => shuttingDown,
    logger,
    shutdown: () =>
      gracefulShutdown({
        server,
        scheduler,
        pool,
        telemetry,
        setShuttingDown: (value) => {
          shuttingDown = value;
        },
        logger,
      }),
    exit: (code) => process.exit(code),
  });
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    await runShutdown();
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}
