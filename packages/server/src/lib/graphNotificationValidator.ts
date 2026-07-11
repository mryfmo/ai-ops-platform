/**
 * packages/server/src/lib/graphNotificationValidator.ts
 *
 * 根拠:
 *   - ADR-0005: Graph change notification受信時のclientState検証（環境変数GRAPH_CLIENT_STATEと
 *     定数時間比較）。不一致通知は破棄し監査ログに記録する（攻撃兆候）。
 *   - SPEC-INT-001: チャネルメッセージ通知は本文を含まないため、resourceパスからID群を抽出し
 *     fetch-on-notifyで本文を取得する。
 *
 * 設計: 純粋関数のみ（HTTP・DB・時刻に依存しない）。
 */
import { createHash, timingSafeEqual } from "node:crypto";

/** clientStateの定数時間比較（長さ差でも計時差が出ないようハッシュ比較） */
export function isValidClientState(expected: string, actual: string | undefined | null): boolean {
  if (!actual) return false;
  const a = createHash("sha256").update(expected, "utf8").digest();
  const b = createHash("sha256").update(actual, "utf8").digest();
  return timingSafeEqual(a, b);
}

export interface GraphResourceIds {
  teamId: string;
  channelId: string;
  messageId: string;
  /** スレッド返信の場合、親メッセージID（このとき messageId は返信自身のID） */
  replyOfMessageId?: string;
}

/**
 * 通知の resource パスから ID群 を抽出する。
 * 例: teams('{tid}')/channels('{cid}')/messages('{mid}')
 *     teams('{tid}')/channels('{cid}')/messages('{mid}')/replies('{rid}')
 * 対象外のリソース形式は null を返す（呼び出し側で破棄）。
 */
export function parseChannelMessageResource(resource: string): GraphResourceIds | null {
  const m = resource.match(
    /teams\('([^']+)'\)\/channels\('([^']+)'\)\/messages\('([^']+)'\)(?:\/replies\('([^']+)'\))?/,
  );
  if (!m) return null;
  const [, teamId, channelId, messageId, replyId] = m;
  if (!teamId || !channelId || !messageId) return null;
  if (replyId) {
    return { teamId, channelId, messageId: replyId, replyOfMessageId: messageId };
  }
  return { teamId, channelId, messageId };
}

export interface GraphNotification {
  id?: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
  resourceData?: { "@odata.etag"?: string };
  subscriptionId?: string;
  lifecycleEvent?: string;
}

/** Graphが保証する通知ID、または完全なresource versionがある場合だけexact redelivery keyを返す。 */
export function graphNotificationDedupeKey(notification: GraphNotification): string | null {
  const id = notification.id?.trim();
  if (id) return `graph:notification:${id}`;

  const version = [
    notification.subscriptionId?.trim(),
    notification.resource?.trim(),
    notification.changeType?.trim(),
    notification.resourceData?.["@odata.etag"]?.trim(),
  ];
  return version.every(Boolean) ? `graph:resource-version:${JSON.stringify(version)}` : null;
}

export interface ClassifiedNotifications {
  accepted: Array<{ notification: GraphNotification; ids: GraphResourceIds | null }>;
  rejected: GraphNotification[]; // clientState不一致（監査ログ対象）
}

/** 通知バッチをclientStateで選別し、受理分のresource IDを抽出する */
export function classifyNotifications(
  expectedClientState: string,
  notifications: GraphNotification[],
): ClassifiedNotifications {
  const accepted: ClassifiedNotifications["accepted"] = [];
  const rejected: GraphNotification[] = [];
  for (const n of notifications) {
    if (!isValidClientState(expectedClientState, n.clientState)) {
      rejected.push(n);
      continue;
    }
    accepted.push({ notification: n, ids: n.resource ? parseChannelMessageResource(n.resource) : null });
  }
  return { accepted, rejected };
}
