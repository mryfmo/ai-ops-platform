/**
 * packages/shared/src/clients/graphClient.ts
 *
 * 根拠:
 *   - DevOps:REQ-026 Teams/Outlook連携: 通知・承認はTeams（アダプティブカード）、定期報告・棚卸しは
 *     Outlook（Microsoft Graph API）で行う。AC-026a: 承認カードのボタン操作が監査ログに操作者IDと
 *     共に記録される（呼び出し側のagents層がAADユーザーIDをauditLogへ記録する）。
 *   - PrjOps:SPEC-INT-001: Microsoft連携はMicrosoft Graph API（アプリケーション権限）。
 *     Teams: チャネルメッセージ送受信・Adaptive Card。Outlook: sendMail・受信はメールボックスの
 *     サブスクリプション（change notification）＋5分間隔のポーリングをフォールバックとする。
 *   - DevOps:SPEC-INT-062: Teamsアダプティブカード送信・アクション受信（カード操作者のAADユーザーIDを
 *     監査ログに記録）、sendMailによるHTMLメール配信。
 *   - DevOps:SPEC-INT-080: GitHub/Graph APIレート制限（429）は指数バックオフ（初期30秒、最大15分）。
 *
 * 実装上の重要な制約（公式ドキュメントに基づく設計判断）:
 *   - Microsoft Graph v1.0 Teams chatMessage change notification（resource-specific contract、
 *     2026-07-11確認）は最大4,320分で、1時間超にはlifecycleNotificationUrlが必須である。
 *     更新に失敗すると通知が silent に失われるため、本クライアントは
 *     renewSubscription() の呼び出し失敗を例外として上位（スケジューラ）に伝播し、
 *     フォールバックのポーリング（5分間隔、PrjOps:SPEC-INT-001）へ切り替えられるようにする。
 *   - 429応答時は Retry-After ヘッダを尊重しつつ指数バックオフ＋ジッタを行う
 *     （出典: Microsoft Learn "Teams webhooks and connectors" throttling guidance）。
 *
 * 認証: 本モジュールは GraphTokenProvider インターフェースにトークン取得を委譲する。
 *   実運用では @azure/msal-node の ConfidentialClientApplication.acquireTokenByClientCredential
 *   （アプリケーション権限、client credentials flow）を実装として注入する。
 */

import { fetchWithBackoff, withTimeout, type FetchLike, type RetryOptions } from "./fetchPolicy.js";

export { fetchWithBackoff } from "./fetchPolicy.js";
export type { FetchLike, RetryOptions, RetryPolicy } from "./fetchPolicy.js";

declare const graphAppOnlyTokenBrand: unique symbol;

export type GraphAppOnlyToken = string & {
  readonly [graphAppOnlyTokenBrand]: "GraphAppOnlyToken";
};

export interface GraphTokenProvider {
  getAccessToken(): Promise<GraphAppOnlyToken>;
}

/** Graph送信・Teams取得のアプリ内最終allowlist（ADR-0005）。 */
export interface GraphAccessPolicy {
  allowedTeamIds: readonly string[];
  allowedFromMailboxes: readonly string[];
}

export interface AdaptiveCardAction {
  title: string;
  id: string; // legacy入力の識別子。Graph送信ではnonempty actionsを拒否する
}

export interface AdaptiveCardPayload {
  schemaVersion?: string;
  body: unknown[]; // Adaptive Card body elements（TextBlock, FactSet等）
  actions: AdaptiveCardAction[];
  openUrlActions?: Array<{ title: string; url: string }>;
}

export interface SendTeamsMessageInput {
  target: ChannelRef;
  card: AdaptiveCardPayload;
}

export interface SendMailInput {
  toEmail: string;
  subject: string;
  htmlBody: string;
  fromMailbox: string; // システム用Outlookメールボックス（OPS-04）
}

/** チーム/チャネルの参照（ADR-0005: project_channels台帳のキーと一致） */
export interface ChannelRef {
  teamId: string;
  channelId: string;
}

/** Graph chatMessage の本基盤向け正規化表現（ADR-0005） */
export interface ChannelMessage {
  id: string;
  replyToId: string | null;
  authorAadId: string | null; // from.user.id（アプリ投稿・システムイベントはnull）
  authorDisplayName: string | null;
  contentType: "html" | "text";
  content: string;
  createdDateTime: string; // ISO 8601
  lastModifiedDateTime: string | null;
  deletedDateTime: string | null;
  webUrl: string | null;
}

export interface GetChannelMessagesDeltaOptions {
  /** 前回のdeltaLink。未指定なら初回全量取得（graph_subscriptions.delta_linkに永続化して次回渡す） */
  deltaLink?: string;
  /** 1ページあたりの取得件数（$top） */
  top?: number;
}

export interface CreateSubscriptionOptions {
  clientState: string;
  changeType: "created,updated,deleted";
  lifecycleNotificationUrl: string;
}

export type GraphSubscriptionErrorCode = "E-SUB01" | "E-SUB02" | "E-SUB03";

export class GraphSubscriptionError extends Error {
  constructor(
    public readonly code: GraphSubscriptionErrorCode,
    public readonly status: number | null,
    message = "Graph subscription operation failed",
  ) {
    super(`${code}: ${message}`);
    this.name = "GraphSubscriptionError";
  }
}

export function graphSubscriptionErrorDetail(error: unknown): { code: string; status: number | null } {
  return error instanceof GraphSubscriptionError
    ? { code: error.code, status: error.status }
    : { code: "E-SUB-UNKNOWN", status: null };
}

export const GRAPH_CHAT_MESSAGE_MAX_LIFETIME_MINUTES = 4_320;

const GRAPH_DATE_TIME_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,7})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export function assertGraphSubscriptionExpiration(expiration: string, now: Date): void {
  const match = GRAPH_DATE_TIME_OFFSET.exec(expiration);
  const nowMs = now.getTime();
  if (!match || !Number.isFinite(nowMs)) throw new Error("subscription expiration must be an RFC3339 DateTimeOffset");
  const [, year, month, day, hour, minute, second] = match;
  const calendar = new Date(Date.UTC(+year!, +month! - 1, +day!, +hour!, +minute!, +second!));
  if (
    calendar.getUTCFullYear() !== +year! ||
    calendar.getUTCMonth() !== +month! - 1 ||
    calendar.getUTCDate() !== +day!
  ) {
    throw new Error("subscription expiration must be an RFC3339 DateTimeOffset");
  }
  const expirationMs = Date.parse(expiration);
  if (!Number.isFinite(expirationMs) || expirationMs <= nowMs)
    throw new Error("subscription expiration must be in the future");
  if (expirationMs - nowMs > GRAPH_CHAT_MESSAGE_MAX_LIFETIME_MINUTES * 60_000)
    throw new Error("subscription expiration exceeds the 4,320-minute maximum");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toChannelMessage(raw: any): ChannelMessage {
  return {
    id: String(raw.id),
    replyToId: raw.replyToId ?? null,
    authorAadId: raw.from?.user?.id ?? null,
    authorDisplayName: raw.from?.user?.displayName ?? null,
    contentType: raw.body?.contentType === "text" ? "text" : "html",
    content: String(raw.body?.content ?? ""),
    createdDateTime: String(raw.createdDateTime ?? ""),
    lastModifiedDateTime: raw.lastModifiedDateTime ?? null,
    deletedDateTime: raw.deletedDateTime ?? null,
    webUrl: raw.webUrl ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface GraphRequestMetadata {
  clientRequestId: string;
  requestId: string | null;
  date: string | null;
  status: number;
}

export type GraphRequestObserver = (metadata: GraphRequestMetadata) => void | Promise<void>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HTTP_DATE_PATTERN =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

const ADAPTIVE_CARD_ATTACHMENT_ID = "1";

export function isAbsoluteHttpsUrl(value: string | undefined | null): boolean {
  const normalized = value?.trim();
  if (!normalized || !/^https:\/\//i.test(normalized)) return false;
  try {
    return new URL(normalized).protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

function buildAdaptiveCardAttachment(card: AdaptiveCardPayload) {
  if (card.actions.length > 0) throw new Error("Graph Adaptive Cards do not support legacy actions");
  const openUrlActions = (card.openUrlActions ?? []).map((action) => {
    const title = action.title?.trim();
    const url = action.url?.trim();
    if (!title) throw new Error("Graph Adaptive Card OpenUrl requires a nonblank title");
    if (!isAbsoluteHttpsUrl(url)) throw new Error("Graph Adaptive Card OpenUrl requires an absolute HTTPS URL");
    return { type: "Action.OpenUrl", title, url };
  });
  return {
    reference: `<attachment id="${ADAPTIVE_CARD_ATTACHMENT_ID}"></attachment>`,
    attachment: {
      id: ADAPTIVE_CARD_ATTACHMENT_ID,
      contentType: "application/vnd.microsoft.card.adaptive",
      content: JSON.stringify({
        type: "AdaptiveCard",
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        version: card.schemaVersion ?? "1.5",
        body: card.body,
        actions: openUrlActions,
      }),
    },
  };
}

export class GraphClient {
  readonly authenticationMode = "app-only" as const;
  private readonly fetchImpl: FetchLike;
  private readonly allowedTeamIds: ReadonlySet<string>;
  private readonly allowedFromMailboxes: ReadonlySet<string>;
  private requestSequence = 0;

  constructor(
    private readonly tokenProvider: GraphTokenProvider,
    fetchImpl: FetchLike = fetch,
    private readonly baseUrl: string = "https://graph.microsoft.com/v1.0",
    private readonly retryOptions: RetryOptions = {},
    private readonly nowProvider: () => Date = () => new Date(),
    accessPolicy?: GraphAccessPolicy,
    private readonly observer?: GraphRequestObserver,
    private readonly requestIdProvider?: () => string,
    timeoutMs = 30_000,
  ) {
    this.fetchImpl = withTimeout(fetchImpl, timeoutMs);
    this.allowedTeamIds = new Set(
      (accessPolicy?.allowedTeamIds ?? []).map((teamId) => teamId.trim()).filter((teamId) => teamId && teamId !== "*"),
    );
    this.allowedFromMailboxes = new Set(
      (accessPolicy?.allowedFromMailboxes ?? [])
        .map((mailbox) => mailbox.trim().toLowerCase())
        .filter((mailbox) => mailbox && mailbox !== "*"),
    );
  }

  private assertAllowedTeam(teamId: string | null | undefined): string {
    const normalized = teamId?.trim() ?? "";
    if (!normalized || !this.allowedTeamIds.has(normalized)) throw new Error("E-GRA01: teamId: team is not allowed");
    return normalized;
  }

  private assertAllowedFromMailbox(fromMailbox: string | undefined): string {
    const normalized = fromMailbox?.trim().toLowerCase() ?? "";
    if (!normalized || !this.allowedFromMailboxes.has(normalized)) throw new Error("E-GRA02: mailbox is not allowed");
    return normalized;
  }

  private assertGraphContinuationUrl(value: unknown, expectedPath: string): string {
    if (typeof value !== "string" || value !== value.trim())
      throw new Error("E-CHM05: continuation URL is not allowed");
    try {
      const base = new URL(this.baseUrl);
      const url = new URL(value);
      const rawUrlWithoutQuery = value.split(/[?#]/, 1)[0];
      if (
        url.origin !== base.origin ||
        url.username ||
        url.password ||
        value.includes("#") ||
        url.pathname !== expectedPath ||
        rawUrlWithoutQuery !== `${base.origin}${expectedPath}`
      ) {
        throw new Error();
      }
      return url.href;
    } catch {
      throw new Error("E-CHM05: continuation URL is not allowed");
    }
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenProvider.getAccessToken();
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  private async fetchGraph(input: string, init?: RequestInit): Promise<Response> {
    const clientRequestId = this.nextClientRequestId();
    const headers = new Headers(init?.headers);
    headers.set("client-request-id", clientRequestId);
    const response = await this.fetchImpl(input, { ...init, headers });
    try {
      void Promise.resolve(
        this.observer?.({
          clientRequestId,
          requestId: this.safeUuid(response.headers.get("request-id")),
          date: this.safeHttpDate(response.headers.get("date")),
          status: response.status,
        }),
      ).catch(() => {});
    } catch {
      // Observability must not change Graph delivery semantics.
    }
    return response;
  }

  private nextClientRequestId(): string {
    const base = this.safeUuid(this.requestIdProvider?.()) ?? crypto.randomUUID();
    const suffix = this.requestSequence.toString(16).padStart(12, "0");
    // ponytail: constant-space 48-bit sequence; rotate the client if one instance can exceed 2^48 attempts.
    this.requestSequence = (this.requestSequence + 1) % 0x1_0000_0000_0000;
    return `${base.slice(0, -12)}${suffix}`;
  }

  private safeUuid(value: string | null | undefined): string | null {
    const normalized = value?.trim().toLowerCase() ?? "";
    return UUID_PATTERN.test(normalized) ? normalized : null;
  }

  private safeHttpDate(value: string | null): string | null {
    if (!value || !HTTP_DATE_PATTERN.test(value)) return null;
    const date = new Date(value);
    return date.toUTCString() === value ? value : null;
  }

  /** TeamsチャネルへAdaptive Cardを送信する（DevOps:SPEC-EXT-010〜012, 024） */
  async sendAdaptiveCard(input: SendTeamsMessageInput): Promise<{ messageId: string }> {
    const teamId = this.assertAllowedTeam(input.target?.teamId);
    const channelId = input.target?.channelId?.trim();
    if (!teamId) throw new Error("E-DLV02: Teams card send requires teamId");
    if (!channelId) throw new Error("E-DLV02: Teams card send requires channelId");
    const card = buildAdaptiveCardAttachment(input.card);
    const headers = await this.authHeaders();
    const body = {
      body: { contentType: "html", content: card.reference },
      attachments: [card.attachment],
    };
    const res = await fetchWithBackoff(
      this.fetchGraph.bind(this),
      `${this.baseUrl}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
      { method: "POST", headers, body: JSON.stringify(body) },
      this.retryOptions,
      "non-idempotent",
    );
    if (res.status !== 201) throw new Error(`E-DLV02: Teams card send failed with status ${res.status}`);
    const json = (await res.json()) as { id: string };
    return { messageId: json.id };
  }

  /** Outlook sendMail（PrjOps:REQ-018, DevOps:SPEC-INT-062, 2000通/2時間 PrjOps:REQ-018 AC-018-1の呼び出し元） */
  async sendMail(input: SendMailInput): Promise<void> {
    const fromMailbox = this.assertAllowedFromMailbox(input.fromMailbox);
    const headers = await this.authHeaders();
    const body = {
      message: {
        subject: input.subject,
        body: { contentType: "HTML", content: input.htmlBody },
        toRecipients: [{ emailAddress: { address: input.toEmail } }],
      },
    };
    const res = await fetchWithBackoff(
      this.fetchGraph.bind(this),
      `${this.baseUrl}/users/${encodeURIComponent(fromMailbox)}/sendMail`,
      { method: "POST", headers, body: JSON.stringify(body) },
      this.retryOptions,
      "non-idempotent",
    );
    if (res.status !== 202) throw new Error(`E-DLV01: sendMail failed with status ${res.status}`);
  }

  /** Teams channel chatMessage change notificationをresource-specific v1.0契約で作成する。 */
  async createSubscription(
    resource: string,
    notificationUrl: string,
    expirationDateTimeIso: string,
    opts: CreateSubscriptionOptions,
  ): Promise<{ id: string; expirationDateTime: string }> {
    const match = resource.match(/^\/teams\/([^/]+)\/channels\/([^/]+)\/messages$/);
    let canonicalResource: string | undefined;
    let resourceTeamId: string | undefined;
    try {
      if (match) {
        const teamId = decodeURIComponent(match[1]!);
        const channelId = decodeURIComponent(match[2]!);
        if (
          teamId &&
          channelId &&
          teamId === teamId.trim() &&
          channelId === channelId.trim() &&
          !/[\\/%\s\p{Z}\p{C}]/u.test(teamId) &&
          !/[\\/%\s\p{Z}\p{C}]/u.test(channelId)
        ) {
          resourceTeamId = teamId;
          canonicalResource = `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`;
        }
      }
    } catch {
      canonicalResource = undefined;
    }
    if (resource !== canonicalResource)
      throw new GraphSubscriptionError("E-SUB01", null, "resource must be a canonical Teams channel messages path");
    this.assertAllowedTeam(resourceTeamId);
    const normalizedNotificationUrl = notificationUrl?.trim();
    const normalizedLifecycleUrl = opts?.lifecycleNotificationUrl?.trim();
    const clientState = opts?.clientState?.trim();
    if (!isAbsoluteHttpsUrl(normalizedNotificationUrl))
      throw new GraphSubscriptionError("E-SUB01", null, "notificationUrl must be an absolute HTTPS URL");
    if (!isAbsoluteHttpsUrl(normalizedLifecycleUrl))
      throw new GraphSubscriptionError("E-SUB01", null, "lifecycleNotificationUrl must be an absolute HTTPS URL");
    if (!clientState) throw new GraphSubscriptionError("E-SUB01", null, "clientState must be nonblank");
    if (opts.changeType !== "created,updated,deleted")
      throw new GraphSubscriptionError("E-SUB01", null, 'changeType must be exactly "created,updated,deleted"');
    const now = this.nowProvider();
    try {
      assertGraphSubscriptionExpiration(expirationDateTimeIso, now);
    } catch (error) {
      throw new GraphSubscriptionError(
        "E-SUB01",
        null,
        error instanceof Error ? error.message : "invalid subscription expiration",
      );
    }

    const headers = await this.authHeaders();
    const res = await fetchWithBackoff(
      this.fetchGraph.bind(this),
      `${this.baseUrl}/subscriptions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          changeType: opts.changeType,
          notificationUrl: normalizedNotificationUrl,
          lifecycleNotificationUrl: normalizedLifecycleUrl,
          resource,
          expirationDateTime: expirationDateTimeIso,
          clientState,
        }),
      },
      this.retryOptions,
      "non-idempotent",
    );
    if (res.status !== 201) throw new GraphSubscriptionError("E-SUB01", res.status, "subscription create failed");
    const result = (await res.json()) as { id?: unknown; expirationDateTime?: unknown };
    if (typeof result.id !== "string" || !result.id.trim() || typeof result.expirationDateTime !== "string") {
      throw new GraphSubscriptionError("E-SUB01", res.status, "invalid subscription response");
    }
    try {
      assertGraphSubscriptionExpiration(result.expirationDateTime, now);
    } catch {
      throw new GraphSubscriptionError("E-SUB01", res.status, "invalid subscription response expirationDateTime");
    }
    return { id: result.id, expirationDateTime: result.expirationDateTime };
  }

  async renewSubscription(subscriptionId: string, newExpirationIso: string, teamId: string | null): Promise<void> {
    this.assertAllowedTeam(teamId);
    const headers = await this.authHeaders();
    const res = await fetchWithBackoff(
      this.fetchGraph.bind(this),
      `${this.baseUrl}/subscriptions/${subscriptionId}`,
      { method: "PATCH", headers, body: JSON.stringify({ expirationDateTime: newExpirationIso }) },
      this.retryOptions,
    );
    if (res.status !== 200) {
      throw new GraphSubscriptionError("E-SUB02", res.status, "subscription renewal failed");
    }
  }

  /** Failed replacement cleanup. DELETE is bounded by the client's retry policy. */
  async deleteSubscription(subscriptionId: string, teamId: string | null): Promise<void> {
    this.assertAllowedTeam(teamId);
    const headers = await this.authHeaders();
    const res = await fetchWithBackoff(
      this.fetchGraph.bind(this),
      `${this.baseUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: "DELETE", headers },
      this.retryOptions,
    );
    if (res.status !== 204 && res.status !== 404)
      throw new GraphSubscriptionError("E-SUB03", res.status, "subscription cleanup failed");
  }

  /**
   * 単一チャネルメッセージの取得（ADR-0005: change notification受信後のfetch-on-notify用。
   * 通知ペイロードは本文を含まないため、resourceパスから抽出したIDで本文を取りに行く）。
   * replyOfMessageId を指定するとスレッド返信メッセージを取得する。
   */
  async getChannelMessage(ref: ChannelRef, messageId: string, replyOfMessageId?: string): Promise<ChannelMessage> {
    const teamId = this.assertAllowedTeam(ref?.teamId);
    const headers = await this.authHeaders();
    const base = `${this.baseUrl}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(ref.channelId)}/messages`;
    const url = replyOfMessageId
      ? `${base}/${encodeURIComponent(replyOfMessageId)}/replies/${encodeURIComponent(messageId)}`
      : `${base}/${encodeURIComponent(messageId)}`;
    const res = await fetchWithBackoff(this.fetchGraph.bind(this), url, { method: "GET", headers }, this.retryOptions);
    if (res.status !== 200) throw new Error(`E-CHM01: getChannelMessage failed with status ${res.status}`);
    return toChannelMessage(await res.json());
  }

  /**
   * チャネルメッセージのdelta取得（ADR-0005: pollingフォールバック PrjOps:SPEC-INT-001 とバックフィル用）。
   * @odata.nextLink が尽きるまでページングし、最後の @odata.deltaLink を返す。
   * 戻りのdeltaLinkは graph_subscriptions.delta_link に永続化し、次回呼び出しで渡すこと。
   * 注: deltaはルートメッセージ中心に返る。返信の完全な補完が必要な場合は listMessageReplies を併用する。
   */
  async getChannelMessagesDelta(
    ref: ChannelRef,
    opts: GetChannelMessagesDeltaOptions = {},
  ): Promise<{ messages: ChannelMessage[]; deltaLink: string }> {
    const teamId = this.assertAllowedTeam(ref?.teamId);
    const base = new URL(this.baseUrl);
    const deltaPath =
      `${base.pathname.replace(/\/$/, "")}/teams/${encodeURIComponent(teamId)}` +
      `/channels/${encodeURIComponent(ref.channelId)}/messages/delta`;
    const initialUrl = this.assertGraphContinuationUrl(
      opts.deltaLink ?? `${base.origin}${deltaPath}${opts.top ? `?$top=${opts.top}` : ""}`,
      deltaPath,
    );
    const headers = await this.authHeaders();

    const messages: ChannelMessage[] = [];
    let url: string | null = initialUrl;
    let deltaLink = "";
    while (url) {
      const res: Response = await fetchWithBackoff(
        this.fetchGraph.bind(this),
        url,
        { method: "GET", headers },
        this.retryOptions,
      );
      if (res.status !== 200) throw new Error(`E-CHM02: getChannelMessagesDelta failed with status ${res.status}`);
      const json = (await res.json()) as {
        value?: unknown[];
        "@odata.nextLink"?: string;
        "@odata.deltaLink"?: string;
      };
      for (const raw of json.value ?? []) messages.push(toChannelMessage(raw));
      if (json["@odata.deltaLink"]) {
        deltaLink = this.assertGraphContinuationUrl(json["@odata.deltaLink"], deltaPath);
        url = null;
      } else {
        url = json["@odata.nextLink"] ? this.assertGraphContinuationUrl(json["@odata.nextLink"], deltaPath) : null;
      }
    }
    if (!deltaLink) throw new Error("E-CHM02: delta response did not include @odata.deltaLink");
    return { messages, deltaLink };
  }

  /** ルートメッセージへのスレッド返信一覧（ADR-0005: deltaがルート中心の場合の補完取得） */
  async listMessageReplies(ref: ChannelRef, rootMessageId: string): Promise<ChannelMessage[]> {
    const teamId = this.assertAllowedTeam(ref?.teamId);
    const base = new URL(this.baseUrl);
    const repliesPath =
      `${base.pathname.replace(/\/$/, "")}/teams/${encodeURIComponent(teamId)}` +
      `/channels/${encodeURIComponent(ref.channelId)}/messages/${encodeURIComponent(rootMessageId)}/replies`;
    const headers = await this.authHeaders();
    let url: string | null = this.assertGraphContinuationUrl(`${base.origin}${repliesPath}`, repliesPath);
    const replies: ChannelMessage[] = [];
    while (url) {
      const res: Response = await fetchWithBackoff(
        this.fetchGraph.bind(this),
        url,
        { method: "GET", headers },
        this.retryOptions,
      );
      if (res.status !== 200) throw new Error(`E-CHM03: listMessageReplies failed with status ${res.status}`);
      const json = (await res.json()) as { value?: unknown[]; "@odata.nextLink"?: string };
      for (const raw of json.value ?? []) replies.push(toChannelMessage(raw));
      url = json["@odata.nextLink"] ? this.assertGraphContinuationUrl(json["@odata.nextLink"], repliesPath) : null;
    }
    return replies;
  }

  /**
   * スレッド返信の投稿（ADR-0005: Teamsコマンド/照会への応答用）。
   * cardを渡すとAdaptive Cardを添付する。カードのボタンはOpenUrl（WebUIへのディープリンク）のみ許容する。
   * 権限: RSC ChannelMessage.Send.Group（Teamsアプリとしてインストール済みのチームに限る）。
   */
  async replyToMessage(
    ref: ChannelRef,
    parentMessageId: string,
    body: { contentType: "html" | "text"; content: string },
    card?: AdaptiveCardPayload,
  ): Promise<{ messageId: string }> {
    const teamId = this.assertAllowedTeam(ref?.teamId);
    const channelId = ref?.channelId?.trim();
    const parentId = parentMessageId?.trim();
    if (!channelId) throw new Error("E-CHM04: replyToMessage requires channelId");
    if (!parentId) throw new Error("E-CHM04: replyToMessage requires parentMessageId");
    const cardAttachment = card ? buildAdaptiveCardAttachment(card) : null;
    const headers = await this.authHeaders();
    const content = cardAttachment
      ? `${body.contentType === "text" ? escapeHtml(body.content) : body.content}${cardAttachment.reference}`
      : body.content;
    const payload: Record<string, unknown> = {
      body: {
        contentType: cardAttachment ? "html" : body.contentType,
        content,
      },
    };
    if (cardAttachment) payload.attachments = [cardAttachment.attachment];
    const res = await fetchWithBackoff(
      this.fetchGraph.bind(this),
      `${this.baseUrl}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}` +
        `/messages/${encodeURIComponent(parentId)}/replies`,
      { method: "POST", headers, body: JSON.stringify(payload) },
      this.retryOptions,
      "non-idempotent",
    );
    if (res.status !== 201) throw new Error(`E-CHM04: replyToMessage failed with status ${res.status}`);
    const json = (await res.json()) as { id: string };
    return { messageId: json.id };
  }
}
