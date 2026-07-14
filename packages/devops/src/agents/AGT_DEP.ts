/**
 * packages/devops/src/agents/AGT_DEP.ts
 *
 * 根拠: DevOps:REQ-003 ステージング自動昇格 / DevOps:REQ-010 本番デプロイの人間承認 / DevOps:REQ-012 自動ロールバック
 *   DevOps:SPEC-INT-020 デプロイ状態機械
 *
 * 決定的な判断（TH-001/TH-002/TH-003評価、状態遷移検証）はlib/配下の純粋関数に委譲し、
 * 本エージェントはGitHubClient/Graph/AuditLogとの結線のみを担当する。
 */
import type { GitHubClient } from "@aiops/shared/clients/githubClient.js";
import type { ChannelRef, GraphClient } from "@aiops/shared/clients/graphClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import type { HolidayCalendar } from "@aiops/shared/calendar/businessCalendar.js";
import { evaluateTh001StagingPromotion, type Th001Input } from "../lib/thresholds.js";
import { assertDeployTransition, type DeployState } from "../lib/deployStateMachine.js";
import {
  evaluateTh003Rollback,
  selectRollbackTarget,
  type Th003Input,
  type StableVersionRecord,
} from "../lib/deployMonitor.js";
import { calculateRiskScore, type RiskScoreInput, type RiskScoreBreakdown } from "../lib/riskScore.js";

export interface DeployDependencies {
  githubClient: Pick<GitHubClient, "dispatchWorkflow" | "createIssue">;
  graphClient: Pick<GraphClient, "sendAdaptiveCard">;
  auditLog: AuditLogWriter;
  traceId: string;
  cal: HolidayCalendar;
}

/** DevOps:REQ-003: TH-001充足時にステージングへ自動昇格し、Teamsチャネルへ事後通知する（AC-003b: 5分以内） */
export async function promoteToStagingIfEligible(
  th001Input: Th001Input,
  channel: ChannelRef,
  commitShaShort: string,
  deps: DeployDependencies,
): Promise<boolean> {
  const eligible = evaluateTh001StagingPromotion(th001Input);
  if (!eligible) return false;

  await deps.graphClient.sendAdaptiveCard({
    target: channel,
    card: {
      body: [
        { type: "TextBlock", text: "ステージングへ自動デプロイしました", weight: "bolder" },
        { type: "TextBlock", text: `コミット: ${commitShaShort}` },
        {
          type: "FactSet",
          facts: [
            { title: "CI結果", value: th001Input.ciAllJobsSuccess ? "成功" : "失敗" },
            { title: "カバレッジ実測値", value: `${th001Input.unitTestCoveragePct}%` },
            { title: "静的解析Critical", value: `${th001Input.staticAnalysisCriticalCount}件` },
          ],
        },
      ],
      actions: [],
    },
  });

  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-DEP",
    action: "staging_promote",
    basis: "TH-001",
    detail: { commitShaShort, th001Input },
    at: new Date().toISOString(),
  });

  return true;
}

/** DevOps:REQ-011/DevOps:SPEC-INT-021: 承認パッケージ用のリスクスコアを計算する（AGT-CHGから呼ばれる想定の共有関数） */
export function computeDeploymentRiskScore(cal: HolidayCalendar, input: RiskScoreInput): RiskScoreBreakdown {
  return calculateRiskScore(cal, input);
}

/** DevOps:REQ-010: 承認完了後、本番デプロイをGitHub Actions workflow_dispatchで実行する */
export async function executeProdDeploy(
  from: DeployState,
  owner: string,
  repo: string,
  commitSha: string,
  deps: DeployDependencies,
): Promise<void> {
  assertDeployTransition(from, "prod_deploying");
  await deps.githubClient.dispatchWorkflow({
    owner,
    repo,
    workflowIdOrFileName: "deploy-prod.yml",
    ref: commitSha,
    inputs: { commit_sha: commitSha },
  });
  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-DEP",
    action: "prod_deploy_dispatch",
    basis: "DevOps:REQ-010",
    detail: { commitSha },
    at: new Date().toISOString(),
  });
}

export interface RollbackOutcome {
  rolledBack: boolean;
  targetVersion?: string;
  matchedConditions?: Array<"a" | "b">;
}

/** DevOps:REQ-012: TH-003充足時に自動ロールバックし、Sev2起票、Teams即時通知（2分以内, AC-012b）。
 *  ユーザー視点の見え方はSPEC-EXT-040（デプロイ失敗時のロールバック通知）に対応する。
 *  承認期限切れ時の見え方はSPEC-EXT-041（別経路、TH-002タイマー）を参照。 */
export async function monitorAndRollbackIfNeeded(
  th003Input: Th003Input,
  stableVersions: StableVersionRecord[],
  owner: string,
  repo: string,
  projectId: string,
  channel: ChannelRef,
  deps: DeployDependencies,
): Promise<RollbackOutcome> {
  const evaluation = evaluateTh003Rollback(th003Input);
  if (!evaluation.shouldRollback) return { rolledBack: false };

  const target = selectRollbackTarget(stableVersions);
  if (!target) {
    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-DEP",
      action: "rollback_target_not_found",
      basis: "TH-003/AC-012c",
      detail: { matchedConditions: evaluation.matchedConditions },
      at: new Date().toISOString(),
    });
    return { rolledBack: false, matchedConditions: evaluation.matchedConditions };
  }

  await deps.githubClient.dispatchWorkflow({
    owner,
    repo,
    workflowIdOrFileName: "deploy-prod.yml",
    ref: target.version,
    inputs: { rollback: "true", target_version: target.version },
  });

  const issue = await deps.githubClient.createIssue({
    owner,
    repo,
    title: `[Sev2][${projectId}] 自動ロールバック発動`,
    body: `TH-003該当（条件: ${evaluation.matchedConditions.join(", ")}）によりロールバックを実行しました。ロールバック先: ${target.version}`,
    labels: ["incident", "sev2", "auto-triaged"],
  });

  await deps.graphClient.sendAdaptiveCard({
    target: channel,
    card: {
      body: [
        { type: "TextBlock", text: "自動ロールバックを実行しました", weight: "bolder" },
        { type: "TextBlock", text: `ロールバック先: ${target.version}` },
        { type: "TextBlock", text: `Issue: ${issue.htmlUrl}` },
      ],
      actions: [],
    },
  });

  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-DEP",
    action: "rollback",
    basis: `TH-003(${evaluation.matchedConditions.join(",")})`,
    detail: { targetVersion: target.version, issueUrl: issue.htmlUrl },
    at: new Date().toISOString(),
  });

  return { rolledBack: true, targetVersion: target.version, matchedConditions: evaluation.matchedConditions };
}
