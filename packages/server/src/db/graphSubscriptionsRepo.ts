/**
 * packages/server/src/db/graphSubscriptionsRepo.ts
 *
 * 根拠: ADR-0005（Graphサブスクリプション台帳。renew対象・プロセス再起動後の復元・deltaLink永続化の正本）/
 *   SPEC-INT-001（チャネルメッセージ通知はfetch-on-notify。renewSubscription失敗時は
 *   5分間隔ポーリング(mode='polling')へフォールバックする）。
 *
 * 設計: 既存Repo（channelMessagesRepo.ts / projectChannelsRepo.ts）と同じPgQueryable注入パターン。
 */
import type { PgConnectable, PgQueryable } from "@aiops/shared";

export type GraphSubscriptionMode = "notification" | "polling";

export interface GraphSubscription {
  subscriptionId: string;
  resource: string;
  teamId: string | null;
  channelId: string | null;
  expiresAt: string;
  deltaLink: string | null;
  mode: GraphSubscriptionMode;
  updatedAt: string;
}

export interface UpsertGraphSubscriptionInput {
  subscriptionId: string;
  resource: string;
  teamId?: string | null;
  channelId?: string | null;
  expiresAt: string;
  deltaLink?: string | null;
  mode?: GraphSubscriptionMode;
}

function toGraphSubscription(r: Record<string, unknown>): GraphSubscription {
  return {
    subscriptionId: String(r.subscription_id),
    resource: String(r.resource),
    teamId: r.team_id ? String(r.team_id) : null,
    channelId: r.channel_id ? String(r.channel_id) : null,
    expiresAt: new Date(String(r.expires_at)).toISOString(),
    deltaLink: r.delta_link ? String(r.delta_link) : null,
    mode: r.mode as GraphSubscriptionMode,
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

export class GraphSubscriptionsRepo {
  constructor(private readonly db: PgQueryable) {}

  /** 新規作成/既存更新の両対応（createSubscription直後の登録、renew時のexpires_at更新に使用） */
  async upsert(sub: UpsertGraphSubscriptionInput): Promise<void> {
    await this.db.query(
      `INSERT INTO graph_subscriptions
         (subscription_id, resource, team_id, channel_id, expires_at, delta_link, mode, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (subscription_id) DO UPDATE SET
         resource = EXCLUDED.resource,
         team_id = EXCLUDED.team_id,
         channel_id = EXCLUDED.channel_id,
         expires_at = EXCLUDED.expires_at,
         delta_link = EXCLUDED.delta_link,
         mode = EXCLUDED.mode,
         updated_at = now()`,
      [
        sub.subscriptionId,
        sub.resource,
        sub.teamId ?? null,
        sub.channelId ?? null,
        sub.expiresAt,
        sub.deltaLink ?? null,
        sub.mode ?? "notification",
      ],
    );
  }

  async findBySubscriptionId(subscriptionId: string): Promise<GraphSubscription | null> {
    const res = await this.db.query(
      `SELECT subscription_id, resource, team_id, channel_id, expires_at, delta_link, mode, updated_at
       FROM graph_subscriptions WHERE subscription_id = $1`,
      [subscriptionId],
    );
    const row = res.rows[0];
    return row ? toGraphSubscription(row) : null;
  }

  async listByMode(mode: GraphSubscriptionMode): Promise<GraphSubscription[]> {
    const res = await this.db.query(
      `SELECT subscription_id, resource, team_id, channel_id, expires_at, delta_link, mode, updated_at
       FROM graph_subscriptions WHERE mode = $1 ORDER BY updated_at`,
      [mode],
    );
    return res.rows.map(toGraphSubscription);
  }

  /** channelPollingTask: delta取得成功後、次回呼び出し用のdeltaLinkを永続化する */
  async updateDeltaLink(subscriptionId: string, deltaLink: string): Promise<void> {
    await this.db.query(
      `UPDATE graph_subscriptions SET delta_link = $2, updated_at = now() WHERE subscription_id = $1`,
      [subscriptionId, deltaLink],
    );
  }

  /** subscriptionRenewalTask: renew失敗(E-SUB02)時にpollingへ、復旧時にnotificationへ切替 */
  async switchMode(subscriptionId: string, mode: GraphSubscriptionMode): Promise<void> {
    await this.db.query(`UPDATE graph_subscriptions SET mode = $2, updated_at = now() WHERE subscription_id = $1`, [
      subscriptionId,
      mode,
    ]);
  }

  /** renew成功時: expires_atのみ更新（mode変更なし） */
  async updateExpiresAt(subscriptionId: string, expiresAt: string): Promise<void> {
    await this.db.query(
      `UPDATE graph_subscriptions SET expires_at = $2, updated_at = now() WHERE subscription_id = $1`,
      [subscriptionId, expiresAt],
    );
  }

  /** polling rowの識別子だけをGraph返却値へ条件付き置換し、resource/team/channel/deltaを保持する。 */
  async replacePollingSubscription(
    oldSubscriptionId: string,
    newSubscriptionId: string,
    expiresAt: string,
  ): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE graph_subscriptions
       SET subscription_id = $2, expires_at = $3, mode = 'notification', updated_at = now()
       WHERE subscription_id = $1 AND mode = 'polling'`,
      [oldSubscriptionId, newSubscriptionId, expiresAt],
    );
    return (res.rowCount ?? 0) > 0;
  }

  /** PostgreSQL session advisory lockで同じrowのcross-process recovery ownerを1つに絞る。 */
  async withRecoveryLock(subscriptionId: string, operation: () => Promise<void>): Promise<boolean> {
    const connectable = this.db as Partial<PgConnectable>;
    if (typeof connectable.connect !== "function") throw new Error("recovery lock requires a connectable database");
    const client = await connectable.connect.call(this.db);
    const key = `graph-subscription-recovery:${subscriptionId}`;
    let locked = false;
    let releaseError: Error | undefined;
    try {
      const result = await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [key]);
      locked = result.rows[0]?.locked === true;
      if (!locked) return false;
      let operationError: unknown;
      let operationFailed = false;
      try {
        await operation();
      } catch (error) {
        operationFailed = true;
        operationError = error;
      }
      try {
        const unlock = await client.query("SELECT pg_advisory_unlock(hashtext($1)) AS unlocked", [key]);
        if (unlock.rows[0]?.unlocked !== true) throw new Error("recovery advisory unlock failed");
      } catch (error) {
        releaseError = error instanceof Error ? error : new Error("recovery advisory unlock failed");
        throw releaseError;
      }
      if (operationFailed) throw operationError;
      return true;
    } catch (error) {
      if (!locked) releaseError = error instanceof Error ? error : new Error("recovery lock query failed");
      throw error;
    } finally {
      client.release(releaseError);
    }
  }
}
