/**
 * packages/server/src/db/projectChannelsRepo.ts
 *
 * 根拠: ADR-0005（プロジェクト専用チーム/チャネル台帳）。
 *   project_channels テーブルは会話取込スコープ制限の正本であり、
 *   RSC権限（ChannelMessage.Read.Group）とアプリ側フィルタ（lib/channelAuthorization.ts）の
 *   二重防御のうちアプリ側フィルタの入力を提供する。
 *
 * 2026-07-07 追記（ADR-0005 / PrjOps:SPEC-INT-033）: github_owner/github_repo列（MIGRATIONS。
 *   packages/devops/src/db/schema.sql参照）を追加。Teamsチャネルからの /gh pr list 等の
 *   照会コマンド（teamsConversationAgent）がprojectIdに紐づくGitHubリポジトリを解決するために使用する。
 *
 * 2026-07-07 追記（ADR-0006）: findByProjectIdを追加。coding_tasks確認ルート
 *   （http/routes/codingTasks.ts）はteamId/channelIdを持たずprojectIdのみでGitHubリポジトリを
 *   解決する必要があるため。
 */
import type { PgQueryable } from "@aiops/shared";

export type ChannelIngestionMode = "active" | "paused" | "closed";

export interface ProjectChannel {
  teamId: string;
  channelId: string;
  projectId: string;
  createdBy: string;
  ingestion: ChannelIngestionMode;
  createdAt: string;
  closedAt: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
}

function toProjectChannel(r: Record<string, unknown>): ProjectChannel {
  return {
    teamId: String(r.team_id),
    channelId: String(r.channel_id),
    projectId: String(r.project_id),
    createdBy: String(r.created_by),
    ingestion: r.ingestion as ChannelIngestionMode,
    createdAt: new Date(String(r.created_at)).toISOString(),
    closedAt: r.closed_at ? new Date(String(r.closed_at)).toISOString() : null,
    githubOwner: r.github_owner ? String(r.github_owner) : null,
    githubRepo: r.github_repo ? String(r.github_repo) : null,
  };
}

export class ProjectChannelsRepo {
  constructor(private readonly db: PgQueryable) {}

  /**
   * 取込対象（ingestion='active'）のチャネルのみ返す。
   * 未登録・paused・closedはnull（呼び出し側で破棄+監査ログ。ADR-0005の二重防御）。
   */
  async findByChannel(teamId: string, channelId: string): Promise<ProjectChannel | null> {
    const res = await this.db.query(
      `SELECT team_id, channel_id, project_id, created_by, ingestion, created_at, closed_at,
              github_owner, github_repo
       FROM project_channels
       WHERE team_id = $1 AND channel_id = $2 AND ingestion = 'active'`,
      [teamId, channelId],
    );
    const row = res.rows[0];
    return row ? toProjectChannel(row) : null;
  }

  /**
   * projectIdに紐づく最初のactiveチャネル登録を返す（ADR-0006: coding-task確認フローが
   * projectIdのみからGitHubリポジトリを解決するために使用）。1プロジェクトに複数チャネルが
   * 登録されている場合はcreated_atが最も古いものを正とする。
   */
  async findByProjectId(projectId: string): Promise<ProjectChannel | null> {
    const res = await this.db.query(
      `SELECT team_id, channel_id, project_id, created_by, ingestion, created_at, closed_at,
              github_owner, github_repo
       FROM project_channels
       WHERE project_id = $1 AND ingestion = 'active'
       ORDER BY created_at
       LIMIT 1`,
      [projectId],
    );
    const row = res.rows[0];
    return row ? toProjectChannel(row) : null;
  }

  async list(): Promise<ProjectChannel[]> {
    const res = await this.db.query(
      `SELECT team_id, channel_id, project_id, created_by, ingestion, created_at, closed_at,
              github_owner, github_repo
       FROM project_channels ORDER BY created_at`,
    );
    return res.rows.map(toProjectChannel);
  }
}
