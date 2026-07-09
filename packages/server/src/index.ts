/**
 * packages/server/src/index.ts
 *
 * 根拠: ADR-0005（常駐サーバのcomposition root）。
 *   config読込（fail-fast）→ DI組立 → 常駐スケジューラ起動 → HTTP待受 → SIGTERMでgraceful shutdown。
 *
 * 残課題（ADR-0005に記載）: GitHubトークンはGitHub AppのJWT署名→installation token交換が本来の方式
 *   （SPEC-INT-061）。本composition rootでは暫定的に環境変数GITHUB_TOKENを許容し、
 *   App認証への置換をインフラ導入時のタスクとする。
 *
 * 2026-07-07 追記（ステップ#8/#9）: 購読管理（subscriptionRenewalTask/channelPollingTask）、
 *   イベントディスパッチ（eventsPollingTask）、Teams会話取込・コマンド実行（teamsConversationAgent）を配線。
 *
 * 2026-07-07 追記（ステップ#10, ADR-0006）: コーディングタスク実行系を配線。
 *   codingTasksRepo・confirm/callbackルート・GitHubリポジトリ解決（projectChannelsRepo.findByProjectId）を追加。
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import {
  GraphClient,
  GitHubClient,
  AnthropicStructuredClient,
  PgCostGuard,
  buildHolidayCalendarFromYaml,
} from "@aiops/shared";
import type { StakeholderInput } from "@aiops/prjops";
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
import { guardFailsafeTask, startScheduler, type ScheduledTask } from "./scheduler/scheduler.js";
import { createHealthcheckTask } from "./scheduler/tasks/healthcheckTask.js";
import { createJitRevocationTask } from "./scheduler/tasks/jitRevocationTask.js";
import { createSubscriptionRenewalTask } from "./scheduler/tasks/subscriptionRenewalTask.js";
import { createChannelPollingTask } from "./scheduler/tasks/channelPollingTask.js";
import { createEventsPollingTask } from "./scheduler/tasks/eventsPollingTask.js";
import { createPmSnapshotReconcileTask } from "./scheduler/tasks/pmSnapshotReconcileTask.js";
import { createSevenKeysMonthlySnapshotTask } from "./scheduler/tasks/sevenKeysMonthlySnapshotTask.js";
import { createReportDeliveryTask, deliverStandardReportToRecipients } from "./scheduler/tasks/reportDeliveryTask.js";
import { createClientCredentialsTokenProvider } from "./auth/graphTokenProvider.js";
import { TeamsConversationAgent } from "./agents/teamsConversationAgent.js";
import {
  dispatchGithubWebhookEvent,
  type DevopsAgentId,
  type DevopsEventHandlerInput,
} from "./lib/githubEventRouter.js";
import { resolveCallerProfileFromStakeholders } from "./lib/stakeholderProfileResolver.js";

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
export * from "./lib/schedulerPolicy.js";
export * from "./lib/dashboardDeepLink.js";
export * from "./lib/graphNotificationValidator.js";
export * from "./lib/channelAuthorization.js";
export * from "./lib/freeTextIntent.js";
export * from "./lib/confirmToken.js";
export * from "./lib/githubEventRouter.js";
export * from "./lib/stakeholderProfileResolver.js";
export * from "./db/pgAuditLog.js";
export * from "./db/eventsRepo.js";
export * from "./db/grantsRepo.js";
export * from "./db/graphSubscriptionsRepo.js";
export * from "./db/projectChannelsRepo.js";
export * from "./db/channelMessagesRepo.js";
export * from "./db/codingTasksRepo.js";
export * from "./db/pmTimeseriesRepo.js";
export * from "./db/importLedgerRepo.js";
export * from "./db/sevenKeysSnapshotsRepo.js";
export * from "./db/recipientsRepo.js";
export * from "./db/standardReportsRepo.js";
export * from "./db/reportDeliveryLogRepo.js";
export * from "./auth/graphTokenProvider.js";
export * from "./agents/teamsConversationAgent.js";

const SAMPLE_STAKEHOLDERS: StakeholderInput[] = [
  {
    id: "ST-010",
    name: "山田太郎",
    organization_id: "ORG-001",
    assignments: [
      { project_id: "PJ-001", profile: "PRF-02" },
      { project_id: "PJ-002", profile: "PRF-01" },
    ],
    email: "yamada@example.com",
    teams_user_id: "29:1a2b3c-example-teams-id",
    preferred_language: "ja",
    timezone: "Asia/Tokyo",
  },
];

function loadJpHolidayCalendar() {
  const yamlUrl = new URL("../../shared/src/calendar/jp_holidays.yaml", import.meta.url);
  return buildHolidayCalendarFromYaml(readFileSync(yamlUrl, "utf8"));
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  const auditLog = new PgAuditLog(pool);
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

  const graphTokenProvider = createClientCredentialsTokenProvider({
    tenantId: config.GRAPH_TENANT_ID,
    clientId: config.GRAPH_CLIENT_ID,
    clientSecret: config.GRAPH_CLIENT_SECRET,
  });
  const graphClient = new GraphClient(graphTokenProvider);

  const githubClient = new GitHubClient({
    // 暫定: 環境変数トークン（本来はGitHub App installation token。ヘッダコメント参照）
    getInstallationToken: async () => process.env.GITHUB_TOKEN ?? "",
  });

  // ANTHROPIC_API_KEY未設定時はTeams自由文フォールバックを無効化する（config.tsのコメント通り）
  const llmClient = config.ANTHROPIC_API_KEY
    ? new AnthropicStructuredClient(
        new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }),
        new PgCostGuard(pool, { perAgentDailyLimitUsd: { SERVER: 10 } }),
      )
    : undefined;

  const devopsEventHandlers: Record<DevopsAgentId, (event: DevopsEventHandlerInput, traceId: string) => Promise<void>> =
    {
      AGT_BLD: async (event, traceId) => {
        await auditLog.append({
          trace_id: traceId,
          actor: "AGT-BLD",
          action: "github_event_received",
          basis: "SPEC-INT-011",
          detail: { eventName: event.eventName },
          at: new Date().toISOString(),
        });
      },
      AGT_DEP: async (event, traceId) => {
        await auditLog.append({
          trace_id: traceId,
          actor: "AGT-DEP",
          action: "github_event_received",
          basis: "SPEC-INT-020",
          detail: { eventName: event.eventName },
          at: new Date().toISOString(),
        });
      },
      AGT_INC: async (event, traceId) => {
        await auditLog.append({
          trace_id: traceId,
          actor: "AGT-INC",
          action: "github_event_received",
          basis: "SPEC-INT-030",
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
    auditLog,
    llmClient,
    resolveCallerProfile: (authorAadId, projectId) =>
      resolveCallerProfileFromStakeholders(SAMPLE_STAKEHOLDERS, authorAadId, projectId).profile,
    codingTasksRepo,
    confirmTokenSecret: config.CODING_TASK_CALLBACK_SECRET,
    publicBaseUrl: config.PUBLIC_BASE_URL,
  });

  let failsafeActive = false;
  const guardTask = (task: ScheduledTask): ScheduledTask =>
    guardFailsafeTask(task, {
      isFailsafeActive: () => failsafeActive,
      auditLog,
      traceIdProvider: () => randomUUID(),
    });

  const scheduler = startScheduler(
    [
      createHealthcheckTask({
        checkTargets: async () => {
          await pool.query("SELECT 1");
          return true;
        },
        activateFailsafe: async () => {},
        isFailsafeActive: () => failsafeActive,
        setFailsafeActive: (v) => {
          failsafeActive = v;
        },
        auditLog,
        traceIdProvider: () => randomUUID(),
      }),
      createJitRevocationTask({
        grantsRepo,
        secDeps: { githubClient, auditLog },
        traceIdProvider: () => randomUUID(),
      }),
      guardTask(
        createSubscriptionRenewalTask({
          graphSubscriptionsRepo,
          graphClient,
          auditLog,
          traceIdProvider: () => randomUUID(),
        }),
      ),
      guardTask(
        createChannelPollingTask({
          graphSubscriptionsRepo,
          projectChannelsRepo,
          channelMessagesRepo,
          graphClient,
          auditLog,
          traceIdProvider: () => randomUUID(),
        }),
      ),
      guardTask(
        createEventsPollingTask({
          eventsRepo,
          auditLog,
          dispatchInboundNotification: (payload, traceId) =>
            teamsConversationAgent.handleNotification(payload, traceId),
          dispatchGithubEvent: (payload, traceId) =>
            dispatchGithubWebhookEvent(payload, traceId, {
              auditLog,
              handlers: devopsEventHandlers,
              pmRepo: pmTimeseriesRepo,
            }),
          dispatchMonitorEvent: async (payload, traceId) => {
            await auditLog.append({
              trace_id: traceId,
              actor: "AGT-DEP",
              action: "monitor_event_received",
              basis: "SPEC-INT-020",
              detail: { hasPayload: payload !== null && payload !== undefined },
              at: new Date().toISOString(),
            });
          },
          traceIdProvider: () => randomUUID(),
        }),
      ),
      guardTask(
        createPmSnapshotReconcileTask({
          repo: pmTimeseriesRepo,
          client: config.GITHUB_PROJECT_NODE_ID
            ? {
                listCurrentSnapshots: (cursor) =>
                  githubClient.listCurrentProjectV2Snapshots({
                    projectNodeId: config.GITHUB_PROJECT_NODE_ID!,
                    cursor,
                  }),
              }
            : {
                listCurrentSnapshots: async () => {
                  await auditLog.append({
                    trace_id: randomUUID(),
                    actor: "SERVER",
                    action: "pm_snapshot_reconcile_disabled",
                    basis: "SPEC-INT-081",
                    detail: { reason: "GITHUB_PROJECT_NODE_ID is not configured" },
                    at: new Date().toISOString(),
                  });
                  return { rateLimit: { remaining: 999 }, snapshots: [], hasMore: false };
                },
              },
          auditLog,
          traceIdProvider: () => randomUUID(),
        }),
      ),
      guardTask(
        createSevenKeysMonthlySnapshotTask({
          repo: sevenKeysSnapshotsRepo,
          disabledReason: "PrjOps report data provider is not configured",
          auditLog,
          calendar: loadJpHolidayCalendar(),
          traceIdProvider: () => randomUUID(),
        }),
      ),
      guardTask(
        createReportDeliveryTask({
          enabled: config.REPORT_DELIVERY_ENABLED,
          fromMailbox: config.FROM_MAILBOX,
          defaultTeamsChannelId: config.DEFAULT_TEAMS_CHANNEL_ID,
          publicBaseUrl: config.PUBLIC_BASE_URL,
          calendar: loadJpHolidayCalendar(),
          recipientsRepo,
          standardReportsRepo,
          graphClient,
          deliveryLogStore: reportDeliveryLogRepo,
          auditLog,
          traceIdProvider: () => randomUUID(),
        }),
      ),
    ],
    (taskName, err) => {
      // 1タスクの失敗を隔離し、秘密情報を含まない形でstderrへ
      console.error(`[scheduler] task ${taskName} failed:`, err instanceof Error ? err.message : String(err));
    },
  );

  const app = buildApp({
    auditLog,
    readiness: {
      isReady: async () => {
        await pool.query("SELECT 1");
        return !failsafeActive;
      },
    },
    graph: {
      clientState: config.GRAPH_CLIENT_STATE,
      auditLog,
      enqueueInboundEvent: (payload, traceId) => eventsRepo.enqueue("inbound", payload, traceId),
      traceIdProvider: () => randomUUID(),
    },
    github: {
      webhookSecret: config.GITHUB_WEBHOOK_SECRET,
      auditLog,
      enqueueGithubEvent: (eventName, payload, traceId) =>
        eventsRepo.enqueue("github", { eventName, payload }, traceId),
      traceIdProvider: () => randomUUID(),
    },
    codingTasks: {
      codingTasksRepo,
      githubClient,
      auditLog,
      confirmTokenSecret: config.CODING_TASK_CALLBACK_SECRET,
      callbackSecret: config.CODING_TASK_CALLBACK_SECRET,
      resolveRepoForProject: async (projectId) => {
        const channel = await projectChannelsRepo.findByProjectId(projectId);
        if (!channel?.githubOwner || !channel.githubRepo) return null;
        return { githubOwner: channel.githubOwner, githubRepo: channel.githubRepo };
      },
      traceIdProvider: () => randomUUID(),
      isFailsafeActive: () => failsafeActive,
    },
    xlsxImport: {
      ledger: importLedgerRepo,
      githubClient,
      auditLog,
      traceIdProvider: () => randomUUID(),
      importSecret: config.XLSX_IMPORT_SECRET,
      allowedRepos: config.XLSX_IMPORT_ALLOWED_REPOS,
    },
    reports: {
      ingestSecret: config.REPORT_INGEST_SECRET,
      reportsRepo: standardReportsRepo,
      auditLog,
      traceIdProvider: () => randomUUID(),
      isFailsafeActive: () => failsafeActive,
      deliverReport: async (report, traceId) => {
        if (!config.REPORT_DELIVERY_ENABLED || !config.FROM_MAILBOX) {
          await auditLog.append({
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
            defaultTeamsChannelId: config.DEFAULT_TEAMS_CHANNEL_ID,
            publicBaseUrl: config.PUBLIC_BASE_URL,
            recipientsRepo,
            graphClient,
            deliveryLogStore: reportDeliveryLogRepo,
            auditLog,
            traceIdProvider: () => randomUUID(),
          },
          traceId,
        );
      },
    },
    webui: { targetBaseUrl: `http://127.0.0.1:${config.WEBUI_INTERNAL_PORT}` },
  });

  const server = serve({ fetch: app.fetch, port: config.PORT });
  console.log(`[server] listening on :${config.PORT} (ADR-0005)`);

  const shutdown = async (): Promise<void> => {
    console.log("[server] SIGTERM received, shutting down gracefully");
    await scheduler.stop();
    server.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

// Composition rootは直接実行時のみ起動（テスト・ライブラリimport時は起動しない）
const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("dist/index.js") ?? false;
if (isDirectRun) {
  main().catch((err) => {
    console.error("[server] fatal startup error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
