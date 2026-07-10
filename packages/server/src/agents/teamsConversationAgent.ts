/**
 * packages/server/src/agents/teamsConversationAgent.ts
 *
 * 根拠: ADR-0005（Teams会話取込パイプライン全体のオーケストレーション層）/ SPEC-INT-001
 *   （fetch-on-notify: 通知はresourceパスのみを含むため本文取得はGraph APIを別途呼ぶ）/
 *   SPEC-INT-033（定型コマンド正規表現判定→不一致時のみLLM意図解釈フォールバック）/
 *   REQ-030（DB保存前sanitizeSecrets必須、LLM入力前sanitizeForLlmInput必須）/
 *   ADR-0006（code_task: コーディングタスク実行系。確認リンク発行までを担当し、
 *   workflow_dispatch自体は呼ばない。「誤発火防止のため人間の明示クリック必須」の起点）。
 *
 * 処理フロー（eventsPollingTaskからgraph_channel_message_notification 1件ごとに呼ばれる）:
 *   1. 通知の resource 文字列から teamId/channelId/messageId(/replyOfMessageId) を抽出
 *   2. project_channels + channelAuthorization で取込可否判定。拒否は破棄+監査ログのみ
 *   3. graphClient.getChannelMessage() で本文取得 → sanitizeSecrets() → channelMessagesRepo.upsert()
 *   4. 本文が "/" で始まる場合のみ定型コマンドとして解釈（commandParser.parseCommand）。
 *      一致すれば checkCommandPermission → 許可されたコマンドを実行。
 *      "/" で始まらない場合は freeTextIntent で意図解釈を試み、intentが"unknown"でなければ実行、
 *      "unknown"なら何もしない（会話として保存するのみ）。
 *   5. 全ての実行判断を auditLog.append() に記録する。
 *
 * lib/agents分離（CLAUDE.md原則1）: 本ファイルはlib純粋関数（parseChannelMessageResource,
 *   channelAuthorization, commandParser, freeTextIntentのパース部、confirmToken）と外部クライアント
 *   （graphClient, githubClient, llmClient, codingTasksRepo）を結線する薄いオーケストレーション層に徹する。
 */
import { randomUUID } from "node:crypto";
import { sanitizeSecrets, type AuditLogWriter, type AnthropicStructuredClient } from "@aiops/shared";
import { parseCommand, checkCommandPermission, type ParsedCommand, type Profile } from "@aiops/prjops";
import { parseChannelMessageResource, type GraphResourceIds } from "../lib/graphNotificationValidator.js";
import { decideChannelIngestion } from "../lib/channelAuthorization.js";
import { interpretFreeTextIntent, type FreeTextIntent } from "../lib/freeTextIntent.js";
import { generateConfirmToken, hashConfirmToken } from "../lib/confirmToken.js";
import { buildDashboardDeepLink } from "../lib/dashboardDeepLink.js";
import type { ProjectChannelsRepo } from "../db/projectChannelsRepo.js";
import type { ChannelMessagesRepo } from "../db/channelMessagesRepo.js";
import type { InboundNotificationPayload } from "../scheduler/tasks/eventsPollingTask.js";

export interface TeamsConversationGraphMessage {
  content: string;
  contentType: "html" | "text";
  authorAadId: string | null;
  authorDisplayName: string | null;
  createdDateTime: string;
  lastModifiedDateTime: string | null;
  deletedDateTime: string | null;
}

export interface TeamsConversationGraphClient {
  getChannelMessage(
    ref: { teamId: string; channelId: string },
    messageId: string,
    replyOfMessageId?: string,
  ): Promise<TeamsConversationGraphMessage>;
  replyToMessage(
    ref: { teamId: string; channelId: string },
    parentMessageId: string,
    body: { contentType: "html" | "text"; content: string },
    card?: {
      body: unknown[];
      actions: Array<{ title: string; id: string }>;
      openUrlActions?: Array<{ title: string; url: string }>;
    },
  ): Promise<{ messageId: string }>;
}

export interface TeamsConversationGithubClient {
  listPullRequests(
    owner: string,
    repo: string,
    opts?: { state?: "open" | "closed" | "all"; perPage?: number },
  ): Promise<Array<{ number: number; title: string; url: string; state: "open" | "closed" }>>;
  listIssues(
    owner: string,
    repo: string,
    opts?: { state?: "open" | "closed" | "all"; labels?: string[]; perPage?: number },
  ): Promise<Array<{ number: number; title: string; url: string; state: "open" | "closed" }>>;
  createIssue(input: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    labels: string[];
  }): Promise<{ number: number; htmlUrl: string }>;
}

/** teamsConversationAgentが必要とする最小限のcoding_tasks台帳インターフェース（ADR-0006） */
export interface TeamsConversationCodingTasksRepo {
  insert(input: {
    taskId: string;
    projectId: string;
    requestedBy: string;
    source: "teams";
    instruction: string;
    agent: "claude-code" | "droid";
    traceId: string;
    confirmTokenHash: string;
  }): Promise<{ taskId: string }>;
}

export interface TeamsConversationAgentDeps {
  projectChannelsRepo: ProjectChannelsRepo;
  channelMessagesRepo: ChannelMessagesRepo;
  graphClient: TeamsConversationGraphClient;
  githubClient: TeamsConversationGithubClient;
  auditLog: AuditLogWriter;
  /** 自由文意図解釈用。ANTHROPIC_API_KEY未設定時などはundefinedを渡すとフォールバックを無効化する */
  llmClient?: AnthropicStructuredClient;
  /**
   * コマンド実行者のプロファイル解決。関係者マスタのteams_user_idとproject assignmentから解決する。
   * 未解決時はnullを返し、本エージェントが拒否返信+監査ログを行う。
   */
  resolveCallerProfile(authorAadId: string | null, projectId: string): Profile | null | Promise<Profile | null>;
  /** ADR-0006: code_task用のcoding_tasks台帳。insertのみでdispatchWorkflowは呼ばない（確認クリック後にHTTPルート側が呼ぶ） */
  codingTasksRepo: TeamsConversationCodingTasksRepo;
  /** ADR-0006: confirmToken.tsのHMAC-SHA256鍵。config.tsのCODING_TASK_CALLBACK_SECRETを注入する */
  confirmTokenSecret: string;
  /** ADR-0006: 確認リンクの生成に使う公開FQDN（config.tsのPUBLIC_BASE_URL） */
  publicBaseUrl: string;
  /** code_task実行エージェント（既定claude-code）。Teamsコマンドにagent指定が無いため固定値を注入する */
  codeTaskAgent?: "claude-code" | "droid";
}

const RESULT_LIMIT = 5;

function formatList(items: Array<{ number: number; title: string; url: string }>, emptyMessage: string): string {
  if (items.length === 0) return emptyMessage;
  const shown = items.slice(0, RESULT_LIMIT);
  const lines = shown.map((it) => `#${it.number} ${it.title} (${it.url})`);
  if (items.length > RESULT_LIMIT) {
    lines.push(`...他${items.length - RESULT_LIMIT}件`);
  }
  return lines.join("\n");
}

/** commandParser.ParsedCommand / freeTextIntentの結果いずれからも共通形へ正規化する */
type ExecutableIntent =
  | { kind: "gh_pr_list"; projectId: string }
  | { kind: "gh_issue_list"; projectId: string }
  | { kind: "gh_issue_create"; projectId: string; title: string; body: string }
  | { kind: "code_task"; projectId: string; instruction: string };

function fromParsedCommand(command: ParsedCommand): ExecutableIntent | null {
  switch (command.kind) {
    case "gh_pr_list":
      return { kind: "gh_pr_list", projectId: command.projectId };
    case "gh_issue_list":
      return { kind: "gh_issue_list", projectId: command.projectId };
    case "gh_issue_create":
      return { kind: "gh_issue_create", projectId: command.projectId, title: command.title, body: command.body };
    case "code_task":
      return { kind: "code_task", projectId: command.projectId, instruction: command.instruction };
    default:
      return null; // action_add/action_done/issue_close/status_override はTeamsConversationAgentの担当外
  }
}

function fromFreeTextIntent(intent: FreeTextIntent): ExecutableIntent | null {
  if (!intent.projectId) return null;
  switch (intent.intent) {
    case "gh_pr_list":
      return { kind: "gh_pr_list", projectId: intent.projectId };
    case "gh_issue_list":
      return { kind: "gh_issue_list", projectId: intent.projectId };
    case "gh_issue_create":
      if (!intent.title || !intent.body) return null;
      return { kind: "gh_issue_create", projectId: intent.projectId, title: intent.title, body: intent.body };
    case "code_task":
      if (!intent.instruction) return null;
      return { kind: "code_task", projectId: intent.projectId, instruction: intent.instruction };
    default:
      return null; // "unknown"
  }
}

export class TeamsConversationAgent {
  constructor(private readonly deps: TeamsConversationAgentDeps) {}

  /** eventsPollingTaskから呼ばれるエントリポイント */
  async handleNotification(payload: InboundNotificationPayload, traceId: string): Promise<void> {
    const ids = this.resolveResourceIds(payload);
    if (!ids) {
      await this.deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "teams_notification_unresolvable",
        basis: "SPEC-INT-001",
        detail: { resource: payload.resource },
        at: new Date().toISOString(),
      });
      return;
    }

    // 2. 取込可否判定（project_channels + channelAuthorization、二重防御。ADR-0005）
    const channel = await this.deps.projectChannelsRepo.findByChannel(ids.teamId, ids.channelId);
    const decision = decideChannelIngestion(channel);
    if (!decision.accepted || !channel) {
      await this.deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "teams_message_rejected",
        basis: "ADR-0005",
        detail: { teamId: ids.teamId, channelId: ids.channelId, reason: decision.reason },
        at: new Date().toISOString(),
      });
      return;
    }

    // 3. 本文取得（fetch-on-notify）→ サニタイズ → 保存
    const raw = await this.deps.graphClient.getChannelMessage(
      { teamId: ids.teamId, channelId: ids.channelId },
      ids.messageId,
      ids.replyOfMessageId,
    );
    const { sanitized } = sanitizeSecrets(raw.content);
    await this.deps.channelMessagesRepo.upsert({
      teamId: ids.teamId,
      channelId: ids.channelId,
      messageId: ids.messageId,
      replyToId: ids.replyOfMessageId ?? null,
      authorAadId: raw.authorAadId,
      authorName: raw.authorDisplayName,
      contentType: raw.contentType,
      content: sanitized,
      createdAt: raw.createdDateTime,
      lastModifiedAt: raw.lastModifiedDateTime,
      deletedAt: raw.deletedDateTime,
    });

    if (raw.deletedDateTime) {
      // 削除通知は会話保存のみで終了（コマンド実行対象にしない）
      return;
    }

    // 4. コマンド判定（定型 → 自由文フォールバックの順）
    const trimmed = sanitized.trim();
    const callerProfile = await this.deps.resolveCallerProfile(raw.authorAadId, channel.projectId);
    if (!callerProfile) {
      await this.deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "teams_caller_profile_unresolved",
        basis: "ADR-0005",
        detail: { projectId: channel.projectId, hasAuthorAadId: raw.authorAadId !== null },
        at: new Date().toISOString(),
      });
      await this.reply(ids, "このユーザーは関係者マスタで確認できないため、コマンドを実行できません");
      return;
    }

    if (trimmed.startsWith("/")) {
      await this.handleSlashCommand(trimmed, channel, ids, callerProfile, traceId);
      return;
    }

    await this.handleFreeText(trimmed, channel, ids, callerProfile, traceId);
  }

  private resolveResourceIds(payload: InboundNotificationPayload): GraphResourceIds | null {
    if (payload.ids && typeof payload.ids === "object") {
      const ids = payload.ids as Partial<GraphResourceIds>;
      if (ids.teamId && ids.channelId && ids.messageId) {
        return {
          teamId: ids.teamId,
          channelId: ids.channelId,
          messageId: ids.messageId,
          replyOfMessageId: ids.replyOfMessageId,
        };
      }
    }
    return payload.resource ? parseChannelMessageResource(payload.resource) : null;
  }

  private async handleSlashCommand(
    text: string,
    channel: { projectId: string; githubOwner: string | null; githubRepo: string | null },
    ids: GraphResourceIds,
    callerProfile: Profile,
    traceId: string,
  ): Promise<void> {
    if (text === "/dashboard" || text.startsWith("/dashboard ")) {
      await this.replyDashboard(ids, channel.projectId, callerProfile, traceId);
      return;
    }

    const parsed = parseCommand(text);
    if (!parsed.ok || !parsed.command) {
      if (parsed.usageHint) {
        await this.reply(ids, `コマンドの書式が正しくありません。書式例: ${parsed.usageHint}`);
      }
      return; // usageHintも無い(=定型コマンド系統に一致しない)場合はteamsConversationAgentでは扱わない
    }

    const permission = checkCommandPermission(parsed.command.kind, callerProfile);
    await this.deps.auditLog.append({
      trace_id: traceId,
      actor: `USER:${callerProfile}`,
      action: "teams_command_parsed",
      basis: "SPEC-INT-033",
      detail: { kind: parsed.command.kind, allowed: permission.allowed },
      at: new Date().toISOString(),
    });

    if (!permission.allowed) {
      await this.reply(ids, permission.deniedMessage ?? "この操作は許可されていません");
      return;
    }

    const executable = fromParsedCommand(parsed.command);
    if (!executable) {
      // action_add等、本エージェントの担当外コマンド（AGT-01等の既存経路が別途処理する想定）
      return;
    }
    await this.executeIntent(executable, channel, ids, traceId, "command", callerProfile);
  }

  private async handleFreeText(
    text: string,
    channel: { projectId: string; githubOwner: string | null; githubRepo: string | null },
    ids: GraphResourceIds,
    callerProfile: Profile,
    traceId: string,
  ): Promise<void> {
    if (!this.deps.llmClient) {
      return; // LLMフォールバック無効（ANTHROPIC_API_KEY未設定）。会話保存のみで終了
    }

    const intentResult = await interpretFreeTextIntent(this.deps.llmClient, text);
    await this.deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "teams_free_text_intent",
      basis: "SPEC-INT-033",
      detail: { intent: intentResult.intent, projectId: intentResult.projectId },
      at: new Date().toISOString(),
    });

    if (intentResult.intent === "unknown") {
      return; // ただの会話として保存のみ（既に3.で保存済み）
    }

    const executable = fromFreeTextIntent(intentResult);
    if (!executable) return;

    const kindForPermission: ParsedCommand["kind"] =
      executable.kind === "gh_pr_list"
        ? "gh_pr_list"
        : executable.kind === "gh_issue_list"
          ? "gh_issue_list"
          : executable.kind === "gh_issue_create"
            ? "gh_issue_create"
            : "code_task";
    const permission = checkCommandPermission(kindForPermission, callerProfile);
    if (!permission.allowed) {
      await this.reply(ids, permission.deniedMessage ?? "この操作は許可されていません");
      return;
    }

    await this.executeIntent(executable, channel, ids, traceId, "free_text", callerProfile);
  }

  private async executeIntent(
    intent: ExecutableIntent,
    channel: { githubOwner: string | null; githubRepo: string | null },
    ids: GraphResourceIds,
    traceId: string,
    origin: "command" | "free_text",
    callerProfile: Profile,
  ): Promise<void> {
    if (intent.kind === "code_task") {
      await this.executeCodeTask(intent, ids, traceId, origin, callerProfile);
      return;
    }

    if (!channel.githubOwner || !channel.githubRepo) {
      await this.reply(ids, "このプロジェクトにはGitHubリポジトリが未登録です");
      return;
    }

    if (intent.kind === "gh_pr_list") {
      const prs = await this.deps.githubClient.listPullRequests(channel.githubOwner, channel.githubRepo, {
        state: "open",
      });
      await this.reply(ids, formatList(prs, "オープン中のPRはありません"));
      await this.logExecution(traceId, "gh_pr_list", intent.projectId, origin);
      return;
    }

    if (intent.kind === "gh_issue_list") {
      const issues = await this.deps.githubClient.listIssues(channel.githubOwner, channel.githubRepo, {
        state: "open",
      });
      await this.reply(ids, formatList(issues, "オープン中のIssueはありません"));
      await this.logExecution(traceId, "gh_issue_list", intent.projectId, origin);
      return;
    }

    // gh_issue_create: 外部(GitHub)への出力前サニタイズ（CLAUDE.md多層防御(c)。title/bodyは
    // 定型コマンドの正規表現抽出、または自由文経路ならLLM出力に由来し、いずれも未検証の外部由来文字列のため）
    const created = await this.deps.githubClient.createIssue({
      owner: channel.githubOwner,
      repo: channel.githubRepo,
      title: sanitizeSecrets(intent.title).sanitized,
      body: sanitizeSecrets(intent.body).sanitized,
      labels: [],
    });
    await this.reply(ids, `Issueを作成しました: #${created.number} ${created.htmlUrl}`);
    await this.logExecution(traceId, "gh_issue_create", intent.projectId, origin);
  }

  /**
   * ADR-0006 code_task: coding_tasks台帳へstatus='queued'でINSERTし、確認リンクを返信するのみ。
   * ここでは絶対にgithubClient.dispatchWorkflowを呼ばない
   * （呼ぶのはhttp/routes/codingTasks.tsのPOST /coding-tasks/:taskId/confirmが
   * 人間の明示クリックを受理した後のみ。ADR-0006「誤発火防止」の核心）。
   */
  private async executeCodeTask(
    intent: Extract<ExecutableIntent, { kind: "code_task" }>,
    ids: GraphResourceIds,
    traceId: string,
    origin: "command" | "free_text",
    callerProfile: Profile,
  ): Promise<void> {
    const taskId = randomUUID();
    const confirmToken = generateConfirmToken(taskId, this.deps.confirmTokenSecret);
    const confirmTokenHash = hashConfirmToken(confirmToken);

    await this.deps.codingTasksRepo.insert({
      taskId,
      projectId: intent.projectId,
      requestedBy: `USER:${callerProfile}`,
      source: "teams",
      instruction: sanitizeSecrets(intent.instruction).sanitized,
      agent: this.deps.codeTaskAgent ?? "claude-code",
      traceId,
      confirmTokenHash,
    });

    const confirmUrl = `${this.deps.publicBaseUrl}/coding-tasks/${taskId}/confirm?token=${confirmToken}`;
    await this.reply(ids, `コーディングタスクを受け付けました。実行するには確認してください: ${confirmUrl}`);

    await this.deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "teams_code_task_queued",
      basis: "ADR-0006",
      detail: { taskId, projectId: intent.projectId, origin },
      at: new Date().toISOString(),
    });
  }

  private async logExecution(
    traceId: string,
    action: string,
    projectId: string,
    origin: "command" | "free_text",
  ): Promise<void> {
    await this.deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: `teams_${action}_executed`,
      basis: "ADR-0005",
      detail: { projectId, origin },
      at: new Date().toISOString(),
    });
  }

  private async replyDashboard(
    ids: GraphResourceIds,
    projectId: string,
    callerProfile: Profile,
    traceId: string,
  ): Promise<void> {
    const url = buildDashboardDeepLink({
      publicBaseUrl: this.deps.publicBaseUrl,
      persona: callerProfile,
      periodLabel: "current",
    });
    await this.reply(ids, "ダッシュボードを開けます", {
      body: [
        { type: "TextBlock", text: "AI Ops Dashboard", weight: "Bolder", wrap: true },
        { type: "TextBlock", text: projectId, isSubtle: true, wrap: true },
      ],
      actions: [],
      openUrlActions: [{ title: "Dashboard", url }],
    });
    await this.deps.auditLog.append({
      trace_id: traceId,
      actor: `USER:${callerProfile}`,
      action: "teams_dashboard_link_sent",
      basis: "REQ-042 SPEC-INT-069 AC-042-1",
      detail: { projectId, persona: callerProfile },
      at: new Date().toISOString(),
    });
  }

  private async reply(
    ids: GraphResourceIds,
    content: string,
    card?: {
      body: unknown[];
      actions: Array<{ title: string; id: string }>;
      openUrlActions?: Array<{ title: string; url: string }>;
    },
  ): Promise<void> {
    // security-reviewer指摘(低): gh_pr_list/gh_issue_listはGitHub側のtitle等をそのまま整形して
    // 返信しており送信元での適用漏れがあり得るため、ここで一律sanitizeSecrets()を通す
    // （CLAUDE.md多層防御(c): ログ・PRコメント・Teams返信への出力前サニタイズの最終防波堤）。
    const { sanitized } = sanitizeSecrets(content);
    await this.deps.graphClient.replyToMessage(
      { teamId: ids.teamId, channelId: ids.channelId },
      ids.replyOfMessageId ?? ids.messageId,
      { contentType: "text", content: sanitized },
      card,
    );
  }
}
