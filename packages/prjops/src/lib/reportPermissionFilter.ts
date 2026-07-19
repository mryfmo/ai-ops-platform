/**
 * packages/prjops/src/lib/reportPermissionFilter.ts
 *
 * 根拠: DOC-03 §4.5（プロファイル別要件・閲覧権限）, PrjOps:SPEC-EXT-021（プロファイル別レイアウト）,
 *   AC-011〜015共通-1: 各プロファイルのレポートに「非表示」と定めた情報が一切含まれない
 *   （AGT-07が配信前に機械チェック。PrjOps:SPEC-INT-051）。
 *
 * 閲覧権限（DOC-03 §4.5より）:
 *   PRF-01: 自分に関わる情報のみ。他者の課題は非表示
 *   PRF-02: 担当プロジェクトの全情報
 *   PRF-03: 配下の全情報＋エスカレーション履歴
 *   PRF-04: 全情報の集計値。個人名は表示しない
 *   PRF-05: 集計値のみ。社内課題の詳細・個人名・社内固有情報は非表示
 *
 * 本モジュールは「どのプロジェクト/課題/個人名をレポート対象データに含めてよいか」を決定的に判定する。
 * テンプレート層はこのフィルタを通過したデータのみを描画に用いる（禁止語彙の後付け除去には頼らない設計。
 * PrjOps:SPEC-EXT-026「配信名簿はAGT-SEC管理の名簿を唯一のソースとする」と同じ「事前フィルタ」思想）。
 */

import type { Profile } from "./reportJobStateMachine.js";
export type { Profile };
export type ReportAudience = Profile | "investor";

export interface ProjectVisibilityContext {
  recipientStakeholderId: string;
  recipientManagedProjectIds: string[]; // PRF-03が配下に持つプロジェクトID一覧
  recipientAssignedProjectIds: string[]; // PRF-02が担当するプロジェクトID一覧
  recipientParticipatingProjectIds: string[]; // PRF-01が参加するプロジェクトID一覧
  investedProjectIds: string[]; // PRF-05の出資対象プロジェクトID一覧
  /** stable-subject persona resolver が明示する assignment scope。legacy delivery context では未設定。 */
  scopeMode?: "project" | "global";
}

/** プロジェクトが受信者のレポート対象範囲に含まれるかどうか（DOC-03 §4.5「対象範囲」列） */
export function isProjectInScope(profile: ReportAudience, projectId: string, ctx: ProjectVisibilityContext): boolean {
  if (ctx.scopeMode === "global") return profile === "PRF-04";
  if (Object.prototype.hasOwnProperty.call(ctx, "scopeMode") && ctx.scopeMode !== "project") return false;

  switch (profile) {
    case "PRF-01":
      return ctx.recipientParticipatingProjectIds.includes(projectId);
    case "PRF-02":
      return ctx.recipientAssignedProjectIds.includes(projectId);
    case "PRF-03":
      return ctx.recipientManagedProjectIds.includes(projectId);
    case "PRF-04":
      return ctx.scopeMode === "project" ? ctx.recipientManagedProjectIds.includes(projectId) : true;
    case "PRF-05":
    case "investor":
      return ctx.investedProjectIds.includes(projectId);
  }
}

/** 個人名を表示してよいプロファイルかどうか（PRF-04/05は個人名非表示） */
export function canShowPersonalNames(profile: ReportAudience): boolean {
  return profile === "PRF-01" || profile === "PRF-02" || profile === "PRF-03";
}

/** 課題の詳細記述(detail)を表示してよいかどうか（PRF-05は社内課題詳細を非表示） */
export function canShowIssueDetail(profile: ReportAudience): boolean {
  return profile !== "PRF-05" && profile !== "investor";
}

/** 課題・アクションが「自分に関わる情報」かどうか（PRF-01のみ適用される絞り込み） */
export function isOwnItemForMember(recipientStakeholderId: string, itemOwnerId: string): boolean {
  return recipientStakeholderId === itemOwnerId;
}

export interface IssueLike {
  projectId: string;
  ownerStakeholderId?: string; // 課題の起票者・担当者
  detail: string;
  reportedByName?: string;
}

/**
 * プロファイル別にレポート掲載可能な課題一覧をフィルタする。
 * PRF-01は自分が関わる課題のみ。PRF-05は社内固有情報を含むためdetailを掲載しない（別途タイトルのみ許容）。
 */
export function filterIssuesForProfile(
  profile: ReportAudience,
  issues: IssueLike[],
  ctx: ProjectVisibilityContext,
): IssueLike[] {
  return issues
    .filter((i) => isProjectInScope(profile, i.projectId, ctx))
    .filter((i) => {
      if (profile === "PRF-01") {
        return i.ownerStakeholderId ? isOwnItemForMember(ctx.recipientStakeholderId, i.ownerStakeholderId) : false;
      }
      return true;
    })
    .map((i) => ({
      ...i,
      detail: canShowIssueDetail(profile) ? i.detail : "",
      reportedByName: canShowPersonalNames(profile) ? i.reportedByName : undefined,
    }));
}

/** 社内固有語（部門名・社内システム名等）のリストに基づく除去対象語の判定（PRF-05向け, PrjOps:SPEC-INT-051(b)） */
export function buildForbiddenTermsForProfile(
  profile: ReportAudience,
  personalNames: string[],
  internalTermsList: string[],
): string[] {
  if (profile === "PRF-04") return [...personalNames];
  if (profile === "PRF-05" || profile === "investor") return [...personalNames, ...internalTermsList];
  return [];
}
