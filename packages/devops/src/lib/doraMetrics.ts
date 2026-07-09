/**
 * packages/devops/src/lib/doraMetrics.ts
 *
 * 根拠: REQ-023 PRF-G（マネージャー）向け / AC-023b: DORA4指標すべてが数値で表示される。
 *
 * DORA（DevOps Research and Assessment）の4指標定義（出典: dora.dev / Google Cloud "Four Keys"）:
 *   - Deployment Frequency（デプロイ頻度）: 本番への successful deployment の頻度。
 *   - Lead Time for Changes（変更リードタイム）: コミットが本番稼働するまでの時間。
 *   - Change Failure Rate（変更失敗率）: 本番障害を引き起こしたデプロイの割合。
 *   - Time to Restore Service / MTTR（平均復旧時間）: 障害発生から復旧までの平均時間。
 * DORAの一般的な実務慣行に倣い、デプロイ頻度は平均（本数/期間）、リードタイムは中央値
 * （外れ値の影響を受けにくいためDORA公式ツールでも中央値が採用される）を用いる。
 *
 * 本モジュールは純粋な集計関数のみを提供し、数値の生成にLLMを一切使用しない
 * （DevOps SPEC-INT-033: 数値はスナップショットから直接埋め込み、LLMによる数値の再生成は行わない）。
 */

export interface DeploymentRecord {
  projectId: string;
  commitAt: string; // ISO 8601
  deployedAt: string; // ISO 8601（本番デプロイ完了時刻）
  causedFailure: boolean; // このデプロイが本番障害を引き起こしたか
}

export interface IncidentRecord {
  projectId: string;
  detectedAt: string;
  resolvedAt: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** デプロイ頻度: 期間内の成功デプロイ件数 ÷ 期間日数 × 7（週あたり件数として表現） */
export function calcDeploymentFrequencyPerWeek(deployments: DeploymentRecord[], periodDays: number): number {
  if (periodDays <= 0) return 0;
  return (deployments.length / periodDays) * 7;
}

/** 変更リードタイム（中央値、時間単位）: コミットから本番デプロイ完了までの時間 */
export function calcMedianLeadTimeHours(deployments: DeploymentRecord[]): number {
  const hours = deployments.map((d) => (Date.parse(d.deployedAt) - Date.parse(d.commitAt)) / (60 * 60 * 1000));
  return median(hours);
}

/** 変更失敗率(%): 本番障害を引き起こしたデプロイの割合 */
export function calcChangeFailureRatePct(deployments: DeploymentRecord[]): number {
  if (deployments.length === 0) return 0;
  const failed = deployments.filter((d) => d.causedFailure).length;
  return (failed / deployments.length) * 100;
}

/** MTTR（平均復旧時間、時間単位）: インシデント検知から復旧までの平均時間 */
export function calcMeanTimeToRestoreHours(incidents: IncidentRecord[]): number {
  if (incidents.length === 0) return 0;
  const hours = incidents.map((i) => (Date.parse(i.resolvedAt) - Date.parse(i.detectedAt)) / (60 * 60 * 1000));
  return hours.reduce((a, b) => a + b, 0) / hours.length;
}

export interface DoraSummary {
  deploymentFrequencyPerWeek: number;
  medianLeadTimeHours: number;
  changeFailureRatePct: number;
  meanTimeToRestoreHours: number;
}

/** REQ-023 AC-023b: DORA4指標をまとめて算出する（全50プロジェクト横断の呼び出しはAC-023a側で担保） */
export function calculateDoraSummary(
  deployments: DeploymentRecord[],
  incidents: IncidentRecord[],
  periodDays: number,
): DoraSummary {
  return {
    deploymentFrequencyPerWeek: calcDeploymentFrequencyPerWeek(deployments, periodDays),
    medianLeadTimeHours: calcMedianLeadTimeHours(deployments),
    changeFailureRatePct: calcChangeFailureRatePct(deployments),
    meanTimeToRestoreHours: calcMeanTimeToRestoreHours(incidents),
  };
}
