/**
 * packages/devops/src/lib/deployMonitor.ts
 *
 * 根拠: TH-003 自動ロールバック発動条件（DOC-ANL-01 §2.5）/ SPEC-INT-020
 *   本番デプロイ完了後15分間の監視ウィンドウにおいて、
 *   (a) HTTP 5xx率が5分移動平均で5%超、または
 *   (b) p95レイテンシがデプロイ前1時間ベースラインの200%超を10分間継続
 *   のいずれかを満たした場合、自動ロールバックを発動する。
 *   AC-012a: (a)(b)それぞれを模擬した負荷テストでロールバックが発動する。
 *
 * サンプルは30秒間隔取得を想定（SPEC-INT-020: 監視API(Datadog想定)から30秒間隔でメトリクス取得）が、
 * 本モジュールはサンプル間隔に依存しない汎用実装とする（実際の時刻差分から連続時間を算出する）。
 */

export interface MonitorSample {
  atSecondsFromDeploy: number; // デプロイ完了時刻からの経過秒数
  http5xxRatePct: number;
  p95LatencyMs: number;
}

export interface Th003Input {
  samples: MonitorSample[]; // atSecondsFromDeploy昇順であること
  baselineP95Ms: number; // デプロイ前1時間ベースラインのp95レイテンシ
}

export interface Th003Result {
  shouldRollback: boolean;
  matchedConditions: Array<"a" | "b">;
}

const FIVE_MIN_SEC = 5 * 60;
const TEN_MIN_SEC = 10 * 60;

/** 条件(a): 5xx率が5分移動平均で5%超となる時点が存在するか */
export function evaluateCondition5xxMovingAverage(samples: MonitorSample[]): boolean {
  for (let i = 0; i < samples.length; i++) {
    const t = samples[i]!.atSecondsFromDeploy;
    const windowSamples = samples.filter((s) => s.atSecondsFromDeploy > t - FIVE_MIN_SEC && s.atSecondsFromDeploy <= t);
    if (windowSamples.length === 0) continue;
    const avg = windowSamples.reduce((sum, s) => sum + s.http5xxRatePct, 0) / windowSamples.length;
    if (avg > 5) return true;
  }
  return false;
}

/** 条件(b): p95がベースラインの200%超の状態が10分間（600秒）以上連続したか */
export function evaluateConditionLatencySustained(samples: MonitorSample[], baselineP95Ms: number): boolean {
  const threshold = baselineP95Ms * 2;
  let runStart: number | null = null;
  let lastInRun: number | null = null;

  for (const s of samples) {
    if (s.p95LatencyMs > threshold) {
      if (runStart === null) runStart = s.atSecondsFromDeploy;
      lastInRun = s.atSecondsFromDeploy;
      if (lastInRun - runStart >= TEN_MIN_SEC) return true;
    } else {
      runStart = null;
      lastInRun = null;
    }
  }
  return false;
}

/** TH-003: 監視ウィンドウ評価本体。(a)(b)いずれかで自動ロールバックを発動する。 */
export function evaluateTh003Rollback(input: Th003Input): Th003Result {
  const matchedConditions: Array<"a" | "b"> = [];
  if (evaluateCondition5xxMovingAverage(input.samples)) matchedConditions.push("a");
  if (evaluateConditionLatencySustained(input.samples, input.baselineP95Ms)) matchedConditions.push("b");
  return { shouldRollback: matchedConditions.length > 0, matchedConditions };
}

/**
 * AC-012c: ロールバック先バージョンは「直前に本番で15分以上安定稼働したバージョン」であること。
 * stableVersions: 各バージョンが本番で安定稼働を開始した時刻と、その継続時間(分)の履歴。
 */
export interface StableVersionRecord {
  version: string;
  stableSince: string; // ISO 8601
  stableDurationMinutesAsOfFailure: number;
}

export function selectRollbackTarget(stableVersions: StableVersionRecord[]): StableVersionRecord | null {
  const eligible = stableVersions.filter((v) => v.stableDurationMinutesAsOfFailure >= 15);
  if (eligible.length === 0) return null;
  // 直前（stableSinceが最も新しい）ものを選ぶ
  return eligible.reduce((latest, v) => (Date.parse(v.stableSince) > Date.parse(latest.stableSince) ? v : latest));
}
