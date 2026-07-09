/**
 * packages/devops/src/lib/riskScore.ts
 *
 * 根拠: SPEC-INT-021 リスクスコア算出式 / REQ-011
 *   score = min(100, round(0.3*A + 0.25*B + 0.2*C + 0.15*D + 0.1*E))
 *   A: 変更行数を0〜100に正規化（2000行以上=100、線形）
 *   B: 変更ファイルに /infra/, /migrations/, 認証関連パス(/auth/) が含まれる場合100、それ以外0
 *   C: 直近30日の当該プロジェクト変更失敗率（%を0〜100でそのまま使用、上限100）
 *   D: テスト結果（失敗0かつカバレッジ80%以上=0、カバレッジ70〜80%=50、70%未満または失敗あり=100）
 *   E: デプロイ予定時刻が営業時間外（JST 19:00〜翌9:00・土日）なら100、営業時間内0
 *   AC-011a: 同一入力に対しスコアが決定的（同値）であること → 純関数として実装。
 *   AC-011b: スコア70以上の場合、承認カードに「高リスク」バッジが表示される。
 */
import { isBusinessHoursJst, type HolidayCalendar } from "@aiops/shared/calendar/businessCalendar.js";

const SENSITIVE_PATH_PATTERNS = [/\/infra\//, /\/migrations\//, /\/auth\//];

export interface RiskScoreInput {
  changedLinesCount: number;
  changedFilePaths: string[];
  recentFailureRatePct: number;
  testFailedCount: number;
  coveragePct: number;
  deployScheduledDateJst: string;
  deployScheduledTimeJst: string;
}

export function factorA_changedLines(changedLinesCount: number): number {
  return Math.min(100, (Math.max(changedLinesCount, 0) / 2000) * 100);
}

export function factorB_sensitivePaths(changedFilePaths: string[]): number {
  const touchesSensitive = changedFilePaths.some((p) => SENSITIVE_PATH_PATTERNS.some((re) => re.test(p)));
  return touchesSensitive ? 100 : 0;
}

export function factorC_recentFailureRate(recentFailureRatePct: number): number {
  return Math.min(100, Math.max(0, recentFailureRatePct));
}

export function factorD_testResult(testFailedCount: number, coveragePct: number): number {
  if (testFailedCount === 0 && coveragePct >= 80) return 0;
  if (testFailedCount === 0 && coveragePct >= 70) return 50;
  return 100;
}

export function factorE_offHours(cal: HolidayCalendar, dateJst: string, timeJst: string): number {
  return isBusinessHoursJst(cal, dateJst, timeJst) ? 0 : 100;
}

export interface RiskScoreBreakdown {
  score: number;
  factors: { A: number; B: number; C: number; D: number; E: number };
  isHighRisk: boolean;
}

/** SPEC-INT-021: 決定的なリスクスコア算出（純関数） */
export function calculateRiskScore(cal: HolidayCalendar, input: RiskScoreInput): RiskScoreBreakdown {
  const A = factorA_changedLines(input.changedLinesCount);
  const B = factorB_sensitivePaths(input.changedFilePaths);
  const C = factorC_recentFailureRate(input.recentFailureRatePct);
  const D = factorD_testResult(input.testFailedCount, input.coveragePct);
  const E = factorE_offHours(cal, input.deployScheduledDateJst, input.deployScheduledTimeJst);

  const raw = 0.3 * A + 0.25 * B + 0.2 * C + 0.15 * D + 0.1 * E;
  const score = Math.min(100, Math.round(raw));

  return { score, factors: { A, B, C, D, E }, isHighRisk: score >= 70 };
}
