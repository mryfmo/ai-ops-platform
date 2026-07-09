/**
 * packages/devops/src/lib/reportPermissionFilter.ts
 *
 * 根拠: SPEC-EXT-021/022/024（プロファイル別レイアウト）, SPEC-EXT-026（閲覧権限）
 *   REQ-021 PRF-M: 本人の担当分のみ（他人の個人別データは含めない）
 *   REQ-022 PRF-L: 担当プロジェクトのみ。メンバー別ではなくタスク種別別の滞留状況
 *   REQ-023 PRF-G: 全50プロジェクト横断
 *   SPEC-EXT-022 PRF-L日次(5): 滞留状況はメンバー個人名別の集計を表示しない
 */

export type Profile = "PRF-M" | "PRF-L" | "PRF-G";

export interface DevOpsVisibilityContext {
  recipientUserId: string;
  recipientAssignedProjectIds: string[];
}

/** REQ-021/022: プロジェクトが受信者の対象範囲に含まれるか */
export function isProjectInScope(profile: Profile, projectId: string, ctx: DevOpsVisibilityContext): boolean {
  if (profile === "PRF-G") return true;
  if (profile === "PRF-L") return ctx.recipientAssignedProjectIds.includes(projectId);
  return true;
}

export interface PrLike {
  id: string;
  authorUserId: string;
  reviewerUserId?: string;
}

/** REQ-021 AC-021b: 他メンバーの個人別タスクデータが含まれない（自分のPRのみ） */
export function filterOwnPrsForMember(prs: PrLike[], recipientUserId: string): PrLike[] {
  return prs.filter((pr) => pr.authorUserId === recipientUserId || pr.reviewerUserId === recipientUserId);
}

export interface StalePrLike {
  taskType: string;
  authorUserId: string;
  hoursStale: number;
}

/** SPEC-EXT-022(5): 滞留状況はタスク種別別に集計し、メンバー個人名別の集計は表示しない。 */
export function aggregateStalePrsByTaskType(
  prs: StalePrLike[],
  staleThresholdHours = 48,
): Array<{ taskType: string; count: number }> {
  const stale = prs.filter((p) => p.hoursStale >= staleThresholdHours);
  const counts = new Map<string, number>();
  for (const p of stale) {
    counts.set(p.taskType, (counts.get(p.taskType) ?? 0) + 1);
  }
  return [...counts.entries()].map(([taskType, count]) => ({ taskType, count }));
}

export interface RecipientRecord {
  userId: string;
  profile: Profile;
  email: string;
  active: boolean;
}

/** REQ-024 AC-024a: 配信名簿から外れた宛先には配信しない */
export function isActiveRecipient(recipients: RecipientRecord[], userId: string): boolean {
  return recipients.some((r) => r.userId === userId && r.active);
}
