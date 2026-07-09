/**
 * packages/prjops/src/agents/AGT01_orchestrator.ts
 *
 * 根拠: DOC-02 §5（例外・障害時のふるまい） / REQ-006
 *   エージェント処理が失敗した場合、AGT-01が同一ジョブを最大2回リトライ（間隔10分）し、
 *   3回目失敗でPMO運用担当（PRF-03が指名する1名）へTeams通知する。
 * SPEC-INT-040（DOC-05 §5）: ジョブの依存順序（analyze→report→verify→deliver）を定義する。
 *   T20時点ではpackages/prjops/src/workflows/*.ymlを出荷しておらず、package-local schedulerは未実装。
 *
 * 設計方針: 本モジュールはリトライ回数・状態遷移の決定ロジックのみを純粋関数として提供する
 * （テスト時に実時間を待たせないための設計判断）。
 */

export interface JobAttemptState {
  jobName: string;
  attemptNumber: number; // 1-indexed。今回の試行が何回目か
  lastError?: string;
}

export type OrchestratorDecision =
  { action: "retry"; delayMinutes: 10 } | { action: "escalate"; notifyTarget: "pmo_operator" } | { action: "proceed" };

const MAX_RETRIES = 2; // 初回失敗後、最大2回リトライ（合計最大3回試行）
const RETRY_INTERVAL_MINUTES = 10;

/**
 * ジョブ失敗時のオーケストレーション判定（DOC-02 §5）。
 * attemptNumberは「今回失敗した試行」の回数（1回目失敗、2回目失敗、3回目失敗）。
 */
export function decideOnJobFailure(state: JobAttemptState): OrchestratorDecision {
  if (state.attemptNumber <= MAX_RETRIES) {
    return { action: "retry", delayMinutes: RETRY_INTERVAL_MINUTES };
  }
  // 3回目（初回+リトライ2回）失敗でエスカレーション
  return { action: "escalate", notifyTarget: "pmo_operator" };
}

export function decideOnJobSuccess(): OrchestratorDecision {
  return { action: "proceed" };
}

/** SPEC-INT-040: analyze→report→verify→deliver の依存順序定義（DAG）。順序を変更する場合は本配列を更新する。 */
export const WEEKLY_JOB_DEPENDENCY_ORDER = [
  "analyze-weekly",
  "report-weekly",
  "verify-weekly",
  "deliver-weekly",
] as const;

export function nextJobInSequence(currentJob: (typeof WEEKLY_JOB_DEPENDENCY_ORDER)[number]): string | null {
  const idx = WEEKLY_JOB_DEPENDENCY_ORDER.indexOf(currentJob);
  if (idx === -1 || idx === WEEKLY_JOB_DEPENDENCY_ORDER.length - 1) return null;
  return WEEKLY_JOB_DEPENDENCY_ORDER[idx + 1]!;
}
