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
 *   TODO: resolveCallerProfileはstakeholderマスタ/recipientsテーブル未接続のため暫定固定値
 *   （下記コメント参照。ADR-0005残課題）。
 *
 * 2026-07-07 追記（ステップ#10, ADR-0006）: コーディングタスク実行系を配線。
 *   codingTasksRepo・confirm/callbackルート・GitHubリポジトリ解決（projectChannelsRepo.findByProjectId）を追加。
 */
import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { GraphClient, GitHubClient, AnthropicStructuredClient, PgCostGuard } from "@aiops/shared";
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
import { ImportLedgerRepo } from "./db/importLedgerRepo.js";
import { buildApp } from "./http/app.js";
import { startScheduler } from "./scheduler/scheduler.js";
import { createHealthcheckTask } from "./scheduler/tasks/healthcheckTask.js";
import { createJitRevocationTask } from "./scheduler/tasks/jitRevocationTask.js";
import { createSubscriptionRenewalTask } from "./scheduler/tasks/subscriptionRenewalTask.js";
import { createChannelPollingTask } from "./scheduler/tasks/channelPollingTask.js";
import { createEventsPollingTask } from "./scheduler/tasks/eventsPollingTask.js";
import { createClientCredentialsTokenProvider } from "./auth/graphTokenProvider.js";
import { TeamsConversationAgent } from "./agents/teamsConversationAgent.js";

export * from "./config.js";
export * from "./http/app.js";
export * from "./http/routes/health.js";
export * from "./http/routes/graphNotifications.js";
export * from "./http/routes/githubWebhook.js";
export * from "./http/routes/codingTasks.js";
export * from "./http/routes/xlsxImport.js";
export * from "./http/routes/webuiProxy.js";
export * from "./scheduler/scheduler.js";
export * from "./scheduler/tasks/healthcheckTask.js";
export * from "./scheduler/tasks/jitRevocationTask.js";
export * from "./scheduler/tasks/subscriptionRenewalTask.js";
export * from "./scheduler/tasks/channelPollingTask.js";
export * from "./scheduler/tasks/eventsPollingTask.js";
export * from "./lib/schedulerPolicy.js";
export * from "./lib/graphNotificationValidator.js";
export * from "./lib/channelAuthorization.js";
export * from "./lib/freeTextIntent.js";
export * from "./lib/confirmToken.js";
export * from "./db/pgAuditLog.js";
export * from "./db/eventsRepo.js";
export * from "./db/grantsRepo.js";
export * from "./db/graphSubscriptionsRepo.js";
export * from "./db/projectChannelsRepo.js";
export * from "./db/channelMessagesRepo.js";
export * from "./db/codingTasksRepo.js";
export * from "./db/importLedgerRepo.js";
export * from "./auth/graphTokenProvider.js";
export * from "./agents/teamsConversationAgent.js";

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
  const importLedgerRepo = new ImportLedgerRepo(pool);

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

  const teamsConversationAgent = new TeamsConversationAgent({
    projectChannelsRepo,
    channelMessagesRepo,
    graphClient,
    githubClient,
    auditLog,
    llmClient,
    // TODO(ADR-0005残課題): 本来はstakeholderマスタ/recipientsテーブルからauthorAadIdを突合して
    // プロファイル(PRF-01〜05)を解決すべき。未接続のため暫定的にPRF-01（照会系のみ許可）固定とする。
    resolveCallerProfile: () => "PRF-01",
    codingTasksRepo,
    confirmTokenSecret: config.CODING_TASK_CALLBACK_SECRET,
    publicBaseUrl: config.PUBLIC_BASE_URL,
  });

  let failsafeActive = false;

  const scheduler = startScheduler(
    [
      createHealthcheckTask({
        checkTargets: async () => {
          await pool.query("SELECT 1");
          return true;
        },
        activateFailsafe: async () => {
          // SPEC-EXT-042: 全プロジェクトチャネルへの「自動運用一時停止」通知は
          // teamsConversationAgent実装後に接続する（現段階では監査ログのみ）
        },
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
      createSubscriptionRenewalTask({
        graphSubscriptionsRepo,
        graphClient,
        auditLog,
        traceIdProvider: () => randomUUID(),
      }),
      createChannelPollingTask({
        graphSubscriptionsRepo,
        projectChannelsRepo,
        channelMessagesRepo,
        graphClient,
        auditLog,
        traceIdProvider: () => randomUUID(),
      }),
      createEventsPollingTask({
        eventsRepo,
        auditLog,
        dispatchInboundNotification: (payload, traceId) => teamsConversationAgent.handleNotification(payload, traceId),
        traceIdProvider: () => randomUUID(),
      }),
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
        return true;
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
    },
    xlsxImport: {
      ledger: importLedgerRepo,
      githubClient,
      auditLog,
      traceIdProvider: () => randomUUID(),
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
