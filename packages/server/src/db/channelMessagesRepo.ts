/**
 * packages/server/src/db/channelMessagesRepo.ts
 *
 * 根拠: ADR-0005（チャネル会話の写し channel_messages）/ DevOps:REQ-030。
 *   - created → INSERT / updated → content・last_modified_at 更新 / deleted → deleted_at セット。
 *     物理DELETEは行わない（監査整合。保持期間の削除は runbooks/channel-messages-purge.md の運用）。
 *   - content の sanitizeSecrets() は「保存前に呼び出し側（agents/teamsConversationAgent）が行う」責務分担
 *     （DevOps:REQ-030 の (a) DB保存前サニタイズ。本Repoは永続化のみを担う）。
 */
import type { PgQueryable } from "@aiops/shared";

export interface ChannelMessageRecord {
  source?: string;
  teamId: string;
  channelId: string;
  messageId: string;
  replyToId: string | null;
  authorAadId: string | null;
  authorName: string | null;
  contentType: "html" | "text";
  content: string;
  createdAt: string; // ISO 8601
  lastModifiedAt: string | null;
  deletedAt: string | null;
}

function toRecord(r: Record<string, unknown>): ChannelMessageRecord {
  return {
    source: String(r.source ?? "teams"),
    teamId: String(r.team_id),
    channelId: String(r.channel_id),
    messageId: String(r.message_id),
    replyToId: r.reply_to_id ? String(r.reply_to_id) : null,
    authorAadId: r.author_aad_id ? String(r.author_aad_id) : null,
    authorName: r.author_name ? String(r.author_name) : null,
    contentType: r.content_type === "text" ? "text" : "html",
    content: String(r.content),
    createdAt: new Date(String(r.created_at)).toISOString(),
    lastModifiedAt: r.last_modified_at ? new Date(String(r.last_modified_at)).toISOString() : null,
    deletedAt: r.deleted_at ? new Date(String(r.deleted_at)).toISOString() : null,
  };
}

export class ChannelMessagesRepo {
  constructor(private readonly db: PgQueryable) {}

  /**
   * Teams側の created / updated / deleted を単一のupsertで追従する（deltaポーリングは
   * 変更種別を区別しないため冪等な形にする）:
   *   - deletedAt あり → deleted_at のみセット（本文は保持。物理削除しない）
   *   - 既存行なし → INSERT
   *   - 既存行あり → content / content_type / last_modified_at を更新
   */
  async upsert(msg: ChannelMessageRecord): Promise<void> {
    if (msg.deletedAt) {
      await this.db.query(
        `UPDATE channel_messages SET deleted_at = $5
         WHERE source = $1 AND team_id = $2 AND channel_id = $3 AND message_id = $4 AND deleted_at IS NULL`,
        [msg.source ?? "teams", msg.teamId, msg.channelId, msg.messageId, msg.deletedAt],
      );
      return;
    }
    const inserted = await this.db.query(
      `INSERT INTO channel_messages
         (source, team_id, channel_id, message_id, reply_to_id, author_aad_id, author_name,
          content_type, content, created_at, last_modified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT DO NOTHING`,
      [
        msg.source ?? "teams",
        msg.teamId,
        msg.channelId,
        msg.messageId,
        msg.replyToId,
        msg.authorAadId,
        msg.authorName,
        msg.contentType,
        msg.content,
        msg.createdAt,
        msg.lastModifiedAt,
      ],
    );
    if (inserted.rowCount === 1) return;

    const replayed = await this.db.query(
      `UPDATE channel_messages SET
         content = $5,
         content_type = $6,
         last_modified_at = $7
       WHERE source = $1 AND team_id = $2 AND channel_id = $3 AND message_id = $4`,
      [
        msg.source ?? "teams",
        msg.teamId,
        msg.channelId,
        msg.messageId,
        msg.content,
        msg.contentType,
        msg.lastModifiedAt,
      ],
    );
    if (replayed.rowCount !== 1) throw new Error("source message identity conflict");
  }

  async listByChannel(teamId: string, channelId: string): Promise<ChannelMessageRecord[]> {
    const res = await this.db.query(
      `SELECT source, team_id, channel_id, message_id, reply_to_id, author_aad_id, author_name,
              content_type, content, created_at, last_modified_at, deleted_at
       FROM channel_messages
       WHERE team_id = $1 AND channel_id = $2
       ORDER BY created_at`,
      [teamId, channelId],
    );
    return res.rows.map(toRecord);
  }
}
