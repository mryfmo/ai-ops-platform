/**
 * packages/devops/src/lib/doraMetrics.ts
 *
 * 根拠: REQ-023 PRF-G（マネージャー）向け / AC-023b: DORA指標を決定的に算出する。
 *
 * DORA（DevOps Research and Assessment）の5指標定義（出典: dora.dev / Google Cloud "Four Keys"）:
 *   - Deployment Frequency（デプロイ頻度）: 本番への successful deployment の頻度。
 *   - Lead Time for Changes（変更リードタイム）: コミットが本番稼働するまでの時間。
 *   - Change Failure Rate（変更失敗率）: 本番障害を引き起こしたデプロイの割合。
 *   - Failed Deployment Recovery Time（旧MTTR）: 変更起因障害の発生から復旧までの中央値。
 *   - Reliability: システムが利用者期待を満たす能力。現行DBには決定的な算出入力が無いため未集計。
 * DORAの一般的な実務慣行に倣い、デプロイ頻度は平均（本数/期間）、リードタイムは中央値
 * （外れ値の影響を受けにくいためDORA公式ツールでも中央値が採用される）を用いる。
 *
 * 本モジュールは純粋な集計関数のみを提供し、数値の生成にLLMを一切使用しない
 * （DevOps:SPEC-INT-033: 数値はスナップショットから直接埋め込み、LLMによる数値の再生成は行わない）。
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
  resolvedAt: string | null;
  causedByDeployment?: boolean;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** デプロイ頻度: 期間内の成功デプロイ件数 ÷ 期間日数 × 7（週あたり件数として表現） */
export function calcDeploymentFrequencyPerWeek(deployments: DeploymentRecord[], periodDays: number): number | null {
  if (deployments.length === 0 || periodDays <= 0) return null;
  return (deployments.length / periodDays) * 7;
}

/** 変更リードタイム（中央値、時間単位）: コミットから本番デプロイ完了までの時間 */
export function calcMedianLeadTimeHours(deployments: DeploymentRecord[]): number | null {
  const hours = deployments.map((d) => (Date.parse(d.deployedAt) - Date.parse(d.commitAt)) / (60 * 60 * 1000));
  return median(hours);
}

/** 変更失敗率(%): 本番障害を引き起こしたデプロイの割合 */
export function calcChangeFailureRatePct(deployments: DeploymentRecord[]): number | null {
  if (deployments.length === 0) return null;
  const failed = deployments.filter((d) => d.causedFailure).length;
  return (failed / deployments.length) * 100;
}

/** Failed deployment recovery time（中央値、時間単位）: 変更起因かつ解決済み障害のみ */
export function calcFailedDeploymentRecoveryTimeHours(incidents: IncidentRecord[]): number | null {
  const hours = incidents.flatMap((incident) => {
    if (incident.causedByDeployment !== true || incident.resolvedAt === null) return [];
    return [(Date.parse(incident.resolvedAt) - Date.parse(incident.detectedAt)) / (60 * 60 * 1000)];
  });
  return median(hours);
}

export interface DoraSummary {
  deploymentFrequencyPerWeek: number | null;
  medianLeadTimeHours: number | null;
  changeFailureRatePct: number | null;
  failedDeploymentRecoveryTimeHours: number | null;
}

export type DoraBand = "elite" | "high" | "medium" | "low" | "na";

export interface DoraBands {
  deploymentFrequency: DoraBand;
  leadTime: DoraBand;
  changeFailureRate: DoraBand;
  failedDeploymentRecoveryTime: DoraBand;
}

export function classifyDoraBands(summary: DoraSummary): DoraBands {
  return {
    deploymentFrequency:
      summary.deploymentFrequencyPerWeek == null
        ? "na"
        : summary.deploymentFrequencyPerWeek >= 7
          ? "elite"
          : summary.deploymentFrequencyPerWeek >= 1
            ? "high"
            : summary.deploymentFrequencyPerWeek >= 0.25
              ? "medium"
              : "low",
    leadTime:
      summary.medianLeadTimeHours == null
        ? "na"
        : summary.medianLeadTimeHours <= 24
          ? "elite"
          : summary.medianLeadTimeHours <= 168
            ? "high"
            : summary.medianLeadTimeHours <= 720
              ? "medium"
              : "low",
    changeFailureRate:
      summary.changeFailureRatePct == null
        ? "na"
        : summary.changeFailureRatePct <= 5
          ? "elite"
          : summary.changeFailureRatePct <= 15
            ? "high"
            : summary.changeFailureRatePct <= 30
              ? "medium"
              : "low",
    failedDeploymentRecoveryTime:
      summary.failedDeploymentRecoveryTimeHours == null
        ? "na"
        : summary.failedDeploymentRecoveryTimeHours <= 1
          ? "elite"
          : summary.failedDeploymentRecoveryTimeHours <= 24
            ? "high"
            : summary.failedDeploymentRecoveryTimeHours <= 168
              ? "medium"
              : "low",
  };
}

/** REQ-023 AC-023b: 現行DBで算出可能なDORA指標をまとめて算出する */
export function calculateDoraSummary(
  deployments: DeploymentRecord[],
  incidents: IncidentRecord[],
  periodDays: number,
): DoraSummary {
  return {
    deploymentFrequencyPerWeek: calcDeploymentFrequencyPerWeek(deployments, periodDays),
    medianLeadTimeHours: calcMedianLeadTimeHours(deployments),
    changeFailureRatePct: calcChangeFailureRatePct(deployments),
    failedDeploymentRecoveryTimeHours: calcFailedDeploymentRecoveryTimeHours(incidents),
  };
}
