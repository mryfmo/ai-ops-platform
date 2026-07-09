/**
 * packages/shared/src/clients/graphClient.ts
 *
 * 根拠:
 *   - DevOps REQ-026 Teams/Outlook連携: 通知・承認はTeams（アダプティブカード）、定期報告・棚卸しは
 *     Outlook（Microsoft Graph API）で行う。AC-026a: 承認カードのボタン操作が監査ログに操作者IDと
 *     共に記録される（呼び出し側のagents層がAADユーザーIDをauditLogへ記録する）。
 *   - PrjOps SPEC-INT-001: Microsoft連携はMicrosoft Graph API（アプリケーション権限）。
 *     Teams: チャネルメッセージ送受信・Adaptive Card。Outlook: sendMail・受信はメールボックスの
 *     サブスクリプション（change notification）＋5分間隔のポーリングをフォールバックとする。
 *   - DevOps SPEC-INT-062: Teamsアダプティブカード送信・アクション受信（カード操作者のAADユーザーIDを
 *     監査ログに記録）、sendMailによるHTMLメール配信。
 *   - DevOps SPEC-INT-080: GitHub/Graph APIレート制限（429）は指数バックオフ（初期30秒、最大15分）。
 *
 * 実装上の重要な制約（公式ドキュメントに基づく設計判断）:
 *   - Microsoft Graphのchange notificationサブスクリプションは、チャネルメッセージ等リソースの場合
 *     最大有効期限が60分程度と短く、継続的な更新（PATCH /subscriptions/{id}）が必須である。
 *     更新に失敗すると通知が silent に失われるため、本クライアントは
 *     renewSubscription() の呼び出し失敗を例外として上位（スケジューラ）に伝播し、
 *     フォールバックのポーリング（5分間隔、SPEC-INT-001）へ切り替えられるようにする。
 *   - 429応答時は Retry-After ヘッダを尊重しつつ指数バックオフ＋ジッタを行う
 *     （出典: Microsoft Learn "Teams webhooks and connectors" throttling guidance）。
 *
 * 認証: 本モジュールは GraphTokenProvider インターフェースにトークン取得を委譲する。
 *   実運用では @azure/msal-node の ConfidentialClientApplication.acquireTokenByClientCredential
 *   （アプリケーション権限、client credentials flow）を実装として注入する。
 */

export interface GraphTokenProvider {
  getAccessToken(): Promise<string>;
}

export interface AdaptiveCardAction {
  title: string;
  id: string; // ボタン識別子。承認カードのwebhook受信時にこのIDで操作を判別する
}

export interface AdaptiveCardPayload {
  schemaVersion?: string;
  body: unknown[]; // Adaptive Card body elements（TextBlock, FactSet等）
  actions: AdaptiveCardAction[];
}

export interface SendTeamsMessageInput {
  channelOrChatId: string;
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
  /** Webhook受信側で検証する秘密値。省略時は旧来の固定値（後方互換。新規コードでは必ず指定すること） */
  clientState?: string;
  /** 省略時は "created,updated"。チャネルメッセージ購読では "created,updated,deleted" を推奨（ADR-0005） */
  changeType?: string;
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

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number; // 既定30秒（SPEC-INT-080）
  maxDelayMs?: number; // 既定15分（SPEC-INT-080）
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms * (0.8 + Math.random() * 0.4);
}

/** 429/5xxに対する指数バックオフ付きfetch（SPEC-INT-080: 初期30秒、最大15分） */
export async function fetchWithBackoff(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 5;
  const initialDelayMs = opts.initialDelayMs ?? 30_000;
  const maxDelayMs = opts.maxDelayMs ?? 15 * 60_000;

  let attempt = 0;
  let delay = initialDelayMs;
  for (;;) {
    const res = await fetchImpl(url, init);
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt >= maxRetries) return res;

    const retryAfterHeader = res.headers.get("Retry-After");
    const waitMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : jitter(delay);
    await sleep(Math.min(waitMs, maxDelayMs));
    delay = Math.min(delay * 2, maxDelayMs);
    attempt += 1;
  }
}

export class GraphClient {
  constructor(
    private readonly tokenProvider: GraphTokenProvider,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl: string = "https://graph.microsoft.com/v1.0",
    private readonly retryOptions: RetryOptions = {},
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenProvider.getAccessToken();
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  /** Teamsチャネル/チャットへAdaptive Cardを送信する（SPEC-EXT-010〜012, 024） */
  async sendAdaptiveCard(input: SendTeamsMessageInput): Promise<{ messageId: string }> {
    const headers = await this.authHeaders();
    const body = {
      body: { contentType: "html", content: "" },
      attachments: [
        {
          id: "1",
          contentType: "application/vnd.microsoft.card.adaptive",
          content: JSON.stringify({
            type: "AdaptiveCard",
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            version: input.card.schemaVersion ?? "1.5",
            body: input.card.body,
            actions: input.card.actions.map((a) => ({
              type: "Action.Submit",
              title: a.title,
              data: { actionId: a.id },
            })),
          }),
        },
      ],
    };
    const res = await fetchWithBackoff(
      this.fetchImpl,
      `${this.baseUrl}/teams/messages/${encodeURIComponent(input.channelOrChatId)}/messages`,
      { method: "POST", headers, body: JSON.stringify(body) },
      this.retryOptions,
    );
    if (!res.ok) throw new Error(`E-DLV02: Teams card send failed with status ${res.status}`);
    const json = (await res.json()) as { id: string };
    return { messageId: json.id };
  }

  /** Outlook sendMail（REQ-018, SPEC-INT-062, 2000通/2時間 REQ-018 AC-018-1の呼び出し元） */
  async sendMail(input: SendMailInput): Promise<void> {
    const headers = await this.authHeaders();
    const body = {
      message: {
        subject: input.subject,
        body: { contentType: "HTML", content: input.htmlBody },
        toRecipients: [{ emailAddress: { address: input.toEmail } }],
      },
      saveToSentItems: "true",
    };
    const res = await fetchWithBackoff(
      this.fetchImpl,
      `${this.baseUrl}/users/${encodeURIComponent(input.fromMailbox)}/sendMail`,
      { method: "POST", headers, body: JSON.stringify(body) },
      this.retryOptions,
    );
    if (!res.ok) throw new Error(`E-DLV01: sendMail failed with status ${res.status}`);
  }

  /**
   * change notificationサブスクリプションを作成する。有効期限は資源種別により上限があり
   * （チャネルメッセージ等は最大60分程度）、呼び出し側が定期的に renewSubscription() を
   * 実行する必要がある（失敗時は5分間隔ポーリングへフォールバック。SPEC-INT-001）。
   */
  async createSubscription(
    resource: string,
    notificationUrl: string,
    expirationDateTimeIso: string,
    opts: CreateSubscriptionOptions = {},
  ): Promise<{ id: string }> {
    const headers = await this.authHeaders();
    const res = await fetchWithBackoff(
      this.fetchImpl,
      `${this.baseUrl}/subscriptions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          changeType: opts.changeType ?? "created,updated",
          notificationUrl,
          resource,
          expirationDateTime: expirationDateTimeIso,
          // ADR-0005: 新規コードは環境変数GRAPH_CLIENT_STATE（ランダム値）を必ず注入する
          // （packages/server/src/index.ts参照。実運用経路はこの固定値を通らない）。
          // spec-reviewer指摘: 完全な「廃止」ではなく、opts省略時のみに限定した後方互換フォールバック
          // として固定値を残している（呼び出し元がclientStateを指定しない場合のみ使用される）。
          clientState: opts.clientState ?? "prjops-devops-secret-state",
        }),
      },
      this.retryOptions,
    );
    if (!res.ok) throw new Error(`E-SUB01: subscription create failed with status ${res.status}`);
    return (await res.json()) as { id: string };
  }

  async renewSubscription(subscriptionId: string, newExpirationIso: string): Promise<void> {
    const headers = await this.authHeaders();
    const res = await fetchWithBackoff(
      this.fetchImpl,
      `${this.baseUrl}/subscriptions/${subscriptionId}`,
      { method: "PATCH", headers, body: JSON.stringify({ expirationDateTime: newExpirationIso }) },
      this.retryOptions,
    );
    if (!res.ok) {
      throw new Error(
        `E-SUB02: subscription renewal failed with status ${res.status}. Falling back to 5-minute polling (SPEC-INT-001).`,
      );
    }
  }

  /**
   * 単一チャネルメッセージの取得（ADR-0005: change notification受信後のfetch-on-notify用。
   * 通知ペイロードは本文を含まないため、resourceパスから抽出したIDで本文を取りに行く）。
   * replyOfMessageId を指定するとスレッド返信メッセージを取得する。
   */
  async getChannelMessage(ref: ChannelRef, messageId: string, replyOfMessageId?: string): Promise<ChannelMessage> {
    const headers = await this.authHeaders();
    const base = `${this.baseUrl}/teams/${encodeURIComponent(ref.teamId)}/channels/${encodeURIComponent(ref.channelId)}/messages`;
    const url = replyOfMessageId
      ? `${base}/${encodeURIComponent(replyOfMessageId)}/replies/${encodeURIComponent(messageId)}`
      : `${base}/${encodeURIComponent(messageId)}`;
    const res = await fetchWithBackoff(this.fetchImpl, url, { method: "GET", headers }, this.retryOptions);
    if (!res.ok) throw new Error(`E-CHM01: getChannelMessage failed with status ${res.status}`);
    return toChannelMessage(await res.json());
  }

  /**
   * チャネルメッセージのdelta取得（ADR-0005: pollingフォールバック SPEC-INT-001 とバックフィル用）。
   * @odata.nextLink が尽きるまでページングし、最後の @odata.deltaLink を返す。
   * 戻りのdeltaLinkは graph_subscriptions.delta_link に永続化し、次回呼び出しで渡すこと。
   * 注: deltaはルートメッセージ中心に返る。返信の完全な補完が必要な場合は listMessageReplies を併用する。
   */
  async getChannelMessagesDelta(
    ref: ChannelRef,
    opts: GetChannelMessagesDeltaOptions = {},
  ): Promise<{ messages: ChannelMessage[]; deltaLink: string }> {
    const headers = await this.authHeaders();
    const initialUrl =
      opts.deltaLink ??
      `${this.baseUrl}/teams/${encodeURIComponent(ref.teamId)}/channels/${encodeURIComponent(ref.channelId)}/messages/delta` +
        (opts.top ? `?$top=${opts.top}` : "");

    const messages: ChannelMessage[] = [];
    let url: string | null = initialUrl;
    let deltaLink = "";
    while (url) {
      const res: Response = await fetchWithBackoff(this.fetchImpl, url, { method: "GET", headers }, this.retryOptions);
      if (!res.ok) throw new Error(`E-CHM02: getChannelMessagesDelta failed with status ${res.status}`);
      const json = (await res.json()) as {
        value?: unknown[];
        "@odata.nextLink"?: string;
        "@odata.deltaLink"?: string;
      };
      for (const raw of json.value ?? []) messages.push(toChannelMessage(raw));
      if (json["@odata.deltaLink"]) {
        deltaLink = json["@odata.deltaLink"];
        url = null;
      } else {
        url = json["@odata.nextLink"] ?? null;
      }
    }
    if (!deltaLink) throw new Error("E-CHM02: delta response did not include @odata.deltaLink");
    return { messages, deltaLink };
  }

  /** ルートメッセージへのスレッド返信一覧（ADR-0005: deltaがルート中心の場合の補完取得） */
  async listMessageReplies(ref: ChannelRef, rootMessageId: string): Promise<ChannelMessage[]> {
    const headers = await this.authHeaders();
    let url: string | null =
      `${this.baseUrl}/teams/${encodeURIComponent(ref.teamId)}/channels/${encodeURIComponent(ref.channelId)}` +
      `/messages/${encodeURIComponent(rootMessageId)}/replies`;
    const replies: ChannelMessage[] = [];
    while (url) {
      const res: Response = await fetchWithBackoff(this.fetchImpl, url, { method: "GET", headers }, this.retryOptions);
      if (!res.ok) throw new Error(`E-CHM03: listMessageReplies failed with status ${res.status}`);
      const json = (await res.json()) as { value?: unknown[]; "@odata.nextLink"?: string };
      for (const raw of json.value ?? []) replies.push(toChannelMessage(raw));
      url = json["@odata.nextLink"] ?? null;
    }
    return replies;
  }

  /**
   * スレッド返信の投稿（ADR-0005: Teamsコマンド/照会への応答用）。
   * cardを渡すとAdaptive Cardを添付する。カードのボタンはAction.Submitではなく
   * Action.OpenUrl（WebUIへのディープリンク）を前提とするため、urlプロパティ付きのactionsを許容する。
   * 権限: RSC ChannelMessage.Send.Group（Teamsアプリとしてインストール済みのチームに限る）。
   */
  async replyToMessage(
    ref: ChannelRef,
    parentMessageId: string,
    body: { contentType: "html" | "text"; content: string },
    card?: AdaptiveCardPayload & { openUrlActions?: Array<{ title: string; url: string }> },
  ): Promise<{ messageId: string }> {
    const headers = await this.authHeaders();
    const payload: Record<string, unknown> = {
      body: { contentType: body.contentType, content: body.content },
    };
    if (card) {
      const actions = [
        ...card.actions.map((a) => ({ type: "Action.Submit", title: a.title, data: { actionId: a.id } })),
        ...(card.openUrlActions ?? []).map((a) => ({ type: "Action.OpenUrl", title: a.title, url: a.url })),
      ];
      payload.attachments = [
        {
          id: "1",
          contentType: "application/vnd.microsoft.card.adaptive",
          content: JSON.stringify({
            type: "AdaptiveCard",
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            version: card.schemaVersion ?? "1.5",
            body: card.body,
            actions,
          }),
        },
      ];
    }
    const res = await fetchWithBackoff(
      this.fetchImpl,
      `${this.baseUrl}/teams/${encodeURIComponent(ref.teamId)}/channels/${encodeURIComponent(ref.channelId)}` +
        `/messages/${encodeURIComponent(parentMessageId)}/replies`,
      { method: "POST", headers, body: JSON.stringify(payload) },
      this.retryOptions,
    );
    if (!res.ok) throw new Error(`E-CHM04: replyToMessage failed with status ${res.status}`);
    const json = (await res.json()) as { id: string };
    return { messageId: json.id };
  }
}
