/**
 * packages/server/src/lib/channelAuthorization.ts
 *
 * 根拠: ADR-0005（RSC権限とアプリ側フィルタの二重防御）。
 *   project_channelsに未登録、またはingestionがpaused/closedのチャネルからのメッセージ・コマンドは
 *   RSC権限（ChannelMessage.Read.Group等）が及ぶ範囲であっても、アプリ側で明示的に破棄する
 *   （テナント側の権限誤設定・チーム削除漏れ等に対する多層防御。CLAUDE.md原則6の「表示層での
 *   後付けマスキング禁止」と同じ思想を取込パイプラインの入口に適用したもの）。
 *
 * 設計: 純粋関数のみ（DB・HTTP非依存。lib/agents分離。CLAUDE.md原則1）。
 */
import type { ProjectChannel } from "../db/projectChannelsRepo.js";

export interface ChannelIngestionDecision {
  accepted: boolean;
  reason?: string;
}

/**
 * チャネルの取込可否を判定する。
 * - channel が null（project_channelsに未登録）: 拒否
 * - ingestion が paused / closed: 拒否
 * - ingestion が active: 許可
 */
export function decideChannelIngestion(channel: ProjectChannel | null): ChannelIngestionDecision {
  if (!channel) {
    return { accepted: false, reason: "unregistered_channel" };
  }
  if (channel.ingestion === "paused") {
    return { accepted: false, reason: "ingestion_paused" };
  }
  if (channel.ingestion === "closed") {
    return { accepted: false, reason: "ingestion_closed" };
  }
  return { accepted: true };
}
