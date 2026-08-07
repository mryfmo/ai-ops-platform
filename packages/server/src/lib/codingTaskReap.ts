/**
 * packages/server/src/lib/codingTaskReap.ts
 *
 * 根拠: ADR-0006（coding_tasks 台帳の状態管理。誤発火・誤終端の防止）。
 *   callback が届かず running のまま滞留したタスクを回収してよいかを、観測した
 *   Actions run 一覧から決める純粋関数。外部API・DB・監査ログには一切依存しない
 *   （CLAUDE.md 設計原則1: 判定は lib/ に置き、agents/scheduler は結線に徹する）。
 *
 * 判定の前提となる制約:
 *   workflow_dispatch は run ID を返さず、dispatch の ref はワークフロー定義のある
 *   ブランチ（`main`）なので、個別 run を特定する相関キーが存在しない。観測できるのは
 *   「このワークフローの、この時刻以降の実行」までである。したがって未完了の run が
 *   1件でもあれば当該タスクのものである可能性を排除できず、回収しない側へ倒す。
 *   誤って終端させるより、回収が遅れる方が安全である。
 */
import type { WorkflowRunListing } from "@aiops/shared";

/** GitHub が run を完了扱いにするまでの status 値。これ以外は実行中/待機中とみなす。 */
const COMPLETED_RUN_STATUS = "completed";

/**
 * run 一覧の下限時刻に持たせる余裕（分）。
 *
 * confirmed_at は DB の時計、run の created_at は GitHub の時計で刻まれる。両者が
 * わずかにずれると、dispatch 後に作られた run が下限を下回って一覧から漏れ、
 * 実行中のタスクを「run 皆無」と誤判定し得る。窓を広げても、無関係な未完了 run が
 * 回収を先送りするだけで誤終端は起きないため、安全側に倒して広めに取る。
 */
export const RUN_LOOKBACK_MINUTES = 15;

export type StaleRunDecision =
  | { reap: false; reason: "still_executing" | "observation_incomplete" }
  | { reap: true; reason: "no_run_observed" | "all_runs_completed"; conclusions: string[] };

/** 観測の下限時刻を、時計ずれを見込んで confirmed_at より手前へ広げる。 */
export function runLookbackSince(confirmedAtIso: string, lookbackMinutes = RUN_LOOKBACK_MINUTES): string {
  const confirmedAtMs = Date.parse(confirmedAtIso);
  if (Number.isNaN(confirmedAtMs)) return confirmedAtIso;
  return new Date(confirmedAtMs - lookbackMinutes * 60_000).toISOString();
}

/**
 * 観測した run 一覧から回収可否を決める。
 *
 * 全件を見られていない場合は判断材料が足りないので回収しない。run は新しい順に返るため、
 * 打ち切った先に古い未完了の run が隠れている可能性があり、「見えた範囲は全部完了」を
 * 「全部完了」と読み替えると実行中のタスクを終端させてしまう。
 */
export function classifyStaleRun(listing: WorkflowRunListing): StaleRunDecision {
  if (listing.runs.some((run) => run.status !== COMPLETED_RUN_STATUS)) {
    return { reap: false, reason: "still_executing" };
  }
  if (!listing.complete) return { reap: false, reason: "observation_incomplete" };
  if (listing.runs.length === 0) return { reap: true, reason: "no_run_observed", conclusions: [] };
  return {
    reap: true,
    reason: "all_runs_completed",
    conclusions: listing.runs.map((run) => run.conclusion ?? "unknown"),
  };
}
