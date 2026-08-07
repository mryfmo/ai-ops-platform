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
import { reportDegradation, type Capability } from "./lib/degradedCapabilities.js";
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { GraphClient, AnthropicStructuredClient, PgCostGuard, buildHolidayCalendarFromYaml } from "@aiops/shared";
import { YamlStakeholderMasterProvider } from "@aiops/prjops";
import Anthropic from "@anthropic-ai/sdk";
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
export * from "./scheduler/scheduler.js";
export * from "./scheduler/tasks/healthcheckTask.js";
export * from "./scheduler/tasks/jitRevocationTask.js";
export * from "./scheduler/tasks/subscriptionRenewalTask.js";
export * from "./scheduler/tasks/channelPollingTask.js";
export * from "./scheduler/tasks/eventsPollingTask.js";
export * from "./scheduler/tasks/pmSnapshotReconcileTask.js";
export * from "./scheduler/tasks/sevenKeysMonthlySnapshotTask.js";
export * from "./scheduler/tasks/reportDeliveryTask.js";
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
export * from "./auth/graphTokenProvider.js";
export * from "./auth/githubAppTokenProvider.js";
export * from "./agents/teamsConversationAgent.js";

function loadJpHolidayCalendar() {
  const yamlUrl = new URL("../../shared/src/calendar/jp_holidays.yaml", import.meta.url);
  return buildHolidayCalendarFromYaml(readFileSync(yamlUrl, "utf8"));
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
  const stakeholderProvider = config.STAKEHOLDERS_DIR
    ? new YamlStakeholderMasterProvider(config.STAKEHOLDERS_DIR)
    : null;
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

  // ANTHROPIC_API_KEY未設定時はTeams自由文フォールバックを無効化する（config.tsのコメント通り）
  const llmClient = config.ANTHROPIC_API_KEY
    ? new AnthropicStructuredClient(
        new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: 600_000, maxRetries: 2 }),
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

  const devopsEventHandlers: Record<DevopsAgentId, (event: DevopsEventHandlerInput, traceId: string) => Promise<void>> =
    {
      AGT_BLD: async (event, traceId) => {
        await devopsAuditLog.append({
          trace_id: traceId,
          actor: "AGT-BLD",
          action: "github_event_received",
          basis: "SPEC-INT-011",
          detail: { eventName: event.eventName },
          at: new Date().toISOString(),
        });
      },
      AGT_DEP: async (event, traceId) => {
        await devopsAuditLog.append({
          trace_id: traceId,
          actor: "AGT-DEP",
          action: "github_event_received",
          basis: "DevOps:SPEC-INT-020",
          detail: { eventName: event.eventName },
          at: new Date().toISOString(),
        });
      },
      AGT_INC: async (event, traceId) => {
        await devopsAuditLog.append({
          trace_id: traceId,
          actor: "AGT-INC",
          action: "github_event_received",
          basis: "DevOps:SPEC-INT-030",
          detail: { eventName: event.eventName },
          at: new Date().toISOString(),
        });
      },
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
    confirmTokenSecret: config.CODING_TASK_CALLBACK_SECRET,
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

  const scheduler = startScheduler(
    [
      observedTask(
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
      ...(githubPolicy.enabled
        ? [
            observedTask(
              createJitRevocationTask({
                grantsRepo,
                secDeps: { githubClient, auditLog: devopsAuditLog },
                traceIdProvider: () => randomUUID(),
              }),
            ),
          ]
        : []),
      // callback が届かず running のまま残った coding_tasks を終端させる。
      // 実行状態を観測してから判断するため GitHub クライアントを渡す。認証が無効なときは
      // タスク自身が「観測不能」として回収を見送り、理由を監査に残す。
      observedTask(
        createCodingTaskReaperTask({
          codingTasksRepo,
          auditLog: devopsAuditLog,
          traceIdProvider: () => randomUUID(),
          githubClient: githubPolicy.enabled ? githubClient : undefined,
        }),
      ),
      observedTask(
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
      observedTask(
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
      observedTask(
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
      observedTask(
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
      observedTask(
        guardTask(
          createSevenKeysMonthlySnapshotTask({
            repo: sevenKeysSnapshotsRepo,
            disabledReason: "PrjOps report data provider is not configured",
            auditLog: prjopsAuditLog,
            calendar: loadJpHolidayCalendar(),
            traceIdProvider: () => randomUUID(),
          }),
          prjopsAuditLog,
        ),
      ),
      observedTask(
        guardTask(
          createReportDeliveryTask({
            enabled: config.REPORT_DELIVERY_ENABLED,
            fromMailbox: config.FROM_MAILBOX,
            defaultTeamsTeamId: config.DEFAULT_TEAMS_TEAM_ID,
            defaultTeamsChannelId: config.DEFAULT_TEAMS_CHANNEL_ID,
            publicBaseUrl: config.PUBLIC_BASE_URL,
            calendar: loadJpHolidayCalendar(),
            recipientsRepo,
            standardReportsRepo,
            graphClient,
            deliveryLogStore: reportDeliveryLogRepo,
            auditLog: prjopsAuditLog,
            traceIdProvider: () => randomUUID(),
            heartbeatUrl: config.HEARTBEAT_URL,
            logger,
            metrics,
          }),
          prjopsAuditLog,
        ),
      ),
    ],
    (taskName, err) => {
      // 1タスクの失敗を隔離し、秘密情報を含まない形でstderrへ
      logger.error({ taskName, err: err instanceof Error ? err.message : String(err) }, "scheduler task failed");
    },
  );

  // 縮退の一覧を一箇所で組み立てる。個々の無効化は監査に残るが、積み重なった状態は
  // どこからも見えなかった（所見 ADV-INT-052 / ADV-INT-007 / ADV-INT-050）。
  // 購読ゼロもここに含める——台帳行が消えるとTeams収集が止まるのに、監査すら残らなかった。
  let subscriptionsPresent = false;
  const refreshSubscriptionPresence = async (): Promise<void> => {
    const notification = await graphSubscriptionsRepo.listByMode("notification");
    const polling = await graphSubscriptionsRepo.listByMode("polling");
    subscriptionsPresent = notification.length + polling.length > 0;
  };
  await refreshSubscriptionPresence();

  const capabilityState = (): Record<Capability, boolean> => ({
    report_delivery: config.REPORT_DELIVERY_ENABLED && Boolean(config.FROM_MAILBOX),
    report_ingest: Boolean(config.REPORT_INGEST_SECRET),
    xlsx_import: githubPolicy.enabled && Boolean(config.XLSX_IMPORT_SECRET),
    teams_persona: Boolean(config.STAKEHOLDERS_DIR),
    llm_free_text: Boolean(config.ANTHROPIC_API_KEY),
    github_outbound: githubPolicy.enabled,
    pm_snapshot_reconcile: githubPolicy.enabled && Boolean(config.GITHUB_PROJECT_NODE_ID),
    seven_keys_snapshot: false,
    heartbeat: Boolean(config.HEARTBEAT_URL),
    metrics_endpoint: Boolean(config.METRICS_TOKEN),
    teams_default_channel: Boolean(config.DEFAULT_TEAMS_TEAM_ID && config.DEFAULT_TEAMS_CHANNEL_ID),
    telemetry: Boolean(config.OTEL_EXPORTER_OTLP_ENDPOINT ?? config.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT),
    graph_subscriptions: subscriptionsPresent,
  });

  const publishCapabilities = (): string[] => {
    const state = capabilityState();
    metrics.setCapabilities(state);
    return reportDegradation(state).disabled;
  };
  publishCapabilities();

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
      confirmTokenSecret: config.CODING_TASK_CALLBACK_SECRET,
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
        await deliverStandardReportToRecipients(
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
            traceIdProvider: () => randomUUID(),
            logger,
            metrics,
          },
          traceId,
        );
      },
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
