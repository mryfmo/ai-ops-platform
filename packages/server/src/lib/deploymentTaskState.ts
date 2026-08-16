// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-003 / TMP-005
// approved deploy / prod monitor の live task 判定を I/O から分離する。

import { evaluateTh003Rollback, selectRollbackTarget, type StableVersionRecord, type Th003Input } from "@aiops/devops";

import type { ApprovedDeployClaim } from "../db/approvalsRepo.js";
import type { ApprovedDeploymentTarget, MonitoringDeploymentTarget } from "../db/deploymentsRepo.js";

export type ApprovedDeployClaimPlan =
  | { readonly kind: "idle" }
  | { readonly kind: "invalid" }
  | { readonly kind: "dispatch"; readonly target: ApprovedDeploymentTarget };

export function classifyApprovedDeployClaim(claim: ApprovedDeployClaim | null): ApprovedDeployClaimPlan {
  if (claim === null) return { kind: "idle" };
  const repository = claim.repositories[0];
  if (
    typeof claim.deployId !== "string" ||
    claim.deployId.length === 0 ||
    typeof claim.projectId !== "string" ||
    claim.projectId.trim().length === 0 ||
    typeof claim.commitSha !== "string" ||
    !/^[0-9a-f]{40}$/u.test(claim.commitSha) ||
    claim.repositories.length !== 1 ||
    !repository?.owner.trim() ||
    !repository.repo.trim()
  ) {
    return { kind: "invalid" };
  }
  return {
    kind: "dispatch",
    target: {
      deployId: claim.deployId,
      projectId: claim.projectId,
      owner: repository.owner,
      repo: repository.repo,
      commitSha: claim.commitSha,
    },
  };
}

export type ProdMonitorTargetPlan =
  | { readonly kind: "skip"; readonly reason: "invalid-channel" | "metrics-missing" }
  | {
      readonly kind: "evaluate";
      readonly rollbackCandidates: StableVersionRecord[];
      readonly willDispatch: boolean;
      readonly boundary: "stable-history-missing" | "workflow-unavailable" | null;
    };

export function planProdMonitorTarget(
  target: MonitoringDeploymentTarget,
  input: Th003Input | null,
  stableVersions: StableVersionRecord[] | null,
  workflowAvailable: boolean | null,
): ProdMonitorTargetPlan {
  if (target.channels.length !== 1 || !target.channels[0]?.teamId || !target.channels[0].channelId) {
    return { kind: "skip", reason: "invalid-channel" };
  }
  if (input === null) return { kind: "skip", reason: "metrics-missing" };
  if (stableVersions === null) {
    return { kind: "evaluate", rollbackCandidates: [], willDispatch: false, boundary: "stable-history-missing" };
  }
  if (workflowAvailable === null)
    throw new RangeError("workflow availability must be observed when stable history exists");
  const rollbackCandidates = workflowAvailable ? stableVersions : [];
  return {
    kind: "evaluate",
    rollbackCandidates,
    willDispatch:
      workflowAvailable &&
      evaluateTh003Rollback(input).shouldRollback &&
      selectRollbackTarget(rollbackCandidates) !== null,
    boundary: workflowAvailable ? null : "workflow-unavailable",
  };
}
