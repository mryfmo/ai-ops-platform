/**
 * packages/devops/src/agents/AGT_SEC.ts
 *
 * 根拠: REQ-018 JIT権限付与と自動失効 / REQ-019 月次棚卸し / SPEC-INT-032 / SPEC-INT-053
 *   妥当性チェック（決定的ロジック）: 申請者の所属プロジェクト一致、理由テキスト非空、
 *   同一対象への有効な既存権限なし、TH-007上限以内の期間。いずれか不成立で申請を差し戻す。
 *   JIT失効: スケジューラが毎分、expires_at <= now の権限を剥奪する。
 *   手動変更を検出した場合は差分をSev3インシデントとして起票する。
 *   外部企業アカウントに関する見え方はSPEC-EXT-030(障害通知)/031(障害受付)/032(アクセス権の見え方、
 *   期限7日前の更新案内)に対応する。権限不足時の見え方はSPEC-EXT-043。
 */
import type { GitHubClient } from "@aiops/shared/clients/githubClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { validateGrantRequest, isGrantExpired, type GrantEnvironment, type SubjectType } from "../lib/jitExpiry.js";

export interface GrantApplication {
  subject: string;
  subjectType: SubjectType;
  targetRepo: string;
  targetOwner: string;
  env: GrantEnvironment;
  level: "pull" | "push" | "maintain" | "admin";
  reason: string;
  requesterProjectIds: string[];
  applicantProjectIds: string[];
  requestedDurationMs: number;
  existingActiveGrantForSameTarget: boolean;
}

export interface ValidationOutcome {
  ok: boolean;
  errors: string[];
  maxAllowedMs: number;
}

/** SPEC-INT-032 妥当性チェック（決定的ロジック、LLM不使用） */
export function validateGrantApplication(app: GrantApplication): ValidationOutcome {
  const errors: string[] = [];

  const projectMatches = app.requesterProjectIds.some((p) => app.applicantProjectIds.includes(p));
  if (!projectMatches) errors.push("E-SEC03: 申請者の所属プロジェクトと対象プロジェクトが一致しません");

  if (!app.reason || app.reason.trim().length === 0) errors.push("E-SEC04: 申請理由が空です");

  if (app.existingActiveGrantForSameTarget) errors.push("E-SEC05: 同一対象への有効な既存権限が既に存在します");

  const durationCheck = validateGrantRequest({
    env: app.env,
    subjectType: app.subjectType,
    requestedDurationMs: app.requestedDurationMs,
  });
  if (!durationCheck.ok) errors.push(`E-SEC06: 申請期間がTH-007の上限(${durationCheck.maxAllowedMs}ms)を超えています`);

  return { ok: errors.length === 0, errors, maxAllowedMs: durationCheck.maxAllowedMs };
}

export interface GrantRecord {
  grantId: string;
  subject: string;
  targetOwner: string;
  targetRepo: string;
  level: "pull" | "push" | "maintain" | "admin";
  expiresAt: string;
  revokedAt: string | null;
}

export interface SecDependencies {
  githubClient: Pick<GitHubClient, "putCollaboratorPermission" | "removeCollaborator">;
  auditLog: AuditLogWriter;
  traceId: string;
}

/** 承認後の権限付与実行（人間承認を経た後にのみ呼ばれる想定） */
export async function executeGrant(record: GrantRecord, approvedBy: string, deps: SecDependencies): Promise<void> {
  await deps.githubClient.putCollaboratorPermission(
    record.targetOwner,
    record.targetRepo,
    record.subject,
    record.level,
  );
  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-SEC",
    action: "grant",
    basis: "REQ-018",
    detail: { grantId: record.grantId, subject: record.subject, approvedBy, expiresAt: record.expiresAt },
    at: new Date().toISOString(),
  });
}

/** 毎分ジョブ: 期限到来した権限を自動剥奪する（安全側操作。AGT_ORCHのフェイルセーフ中も継続） */
export async function revokeExpiredGrants(grants: GrantRecord[], now: Date, deps: SecDependencies): Promise<string[]> {
  const revoked: string[] = [];
  for (const g of grants) {
    if (g.revokedAt) continue;
    if (isGrantExpired(g.expiresAt, now)) {
      await deps.githubClient.removeCollaborator(g.targetOwner, g.targetRepo, g.subject);
      await deps.auditLog.append({
        trace_id: deps.traceId,
        actor: "AGT-SEC",
        action: "auto_revoke",
        basis: "TH-007",
        detail: { grantId: g.grantId, subject: g.subject },
        at: new Date().toISOString(),
      });
      revoked.push(g.grantId);
    }
  }
  return revoked;
}

/** 手動権限変更の検出（台帳と実際の権限設定の突合。差分検出時はSev3起票が呼び出し側の責務） */
export function detectManualPermissionDrift(
  ledgerGrants: GrantRecord[],
  actualCollaborators: Array<{ subject: string; level: string }>,
): string[] {
  const activeLedgerSubjects = new Set(ledgerGrants.filter((g) => !g.revokedAt).map((g) => g.subject));
  const drifted: string[] = [];
  for (const actual of actualCollaborators) {
    if (!activeLedgerSubjects.has(actual.subject)) {
      drifted.push(actual.subject);
    }
  }
  return drifted;
}
