/**
 * packages/devops/src/lib/jitExpiry.ts
 *
 * 根拠: TH-007 権限のJIT付与（DOC-ANL-01 §2.5）/ DevOps:REQ-018
 *   本番環境権限は最長8時間で自動失効。開発・ステージングは最長30日。
 *   外部企業アカウントは全環境で最長90日、更新には再承認必須。
 *   AC-018a: 本番権限が付与から8時間で自動失効することを確認。
 *   AC-018b: 外部企業アカウントが90日で失効し、再承認なしに延長されないことを確認。
 */

export type GrantEnvironment = "dev" | "staging" | "prod";
export type SubjectType = "internal" | "external";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** TH-007: 環境・主体種別に応じた最長付与期間(ミリ秒)を返す */
export function maxGrantDurationMs(env: GrantEnvironment, subjectType: SubjectType): number {
  if (subjectType === "external") return 90 * DAY_MS;
  if (env === "prod") return 8 * HOUR_MS;
  return 30 * DAY_MS;
}

export interface GrantRequest {
  env: GrantEnvironment;
  subjectType: SubjectType;
  requestedDurationMs: number;
}

export interface GrantValidation {
  ok: boolean;
  maxAllowedMs: number;
  clampedDurationMs: number;
}

/** 妥当性チェック: TH-007上限以内の期間かどうか */
export function validateGrantRequest(req: GrantRequest): GrantValidation {
  const maxAllowedMs = maxGrantDurationMs(req.env, req.subjectType);
  const ok = req.requestedDurationMs <= maxAllowedMs;
  return { ok, maxAllowedMs, clampedDurationMs: Math.min(req.requestedDurationMs, maxAllowedMs) };
}

/** 現在時刻が有効期限を過ぎているかどうか（JIT自動失効の判定。毎分ジョブから呼ばれる想定） */
export function isGrantExpired(expiresAtIso: string, now: Date): boolean {
  return now.getTime() >= Date.parse(expiresAtIso);
}

/** AC-018b: 更新（延長）には再承認が必須。再承認なしの延長は常に不可であることを型で表現する。 */
export function canExtendWithoutReapproval(): false {
  return false;
}
