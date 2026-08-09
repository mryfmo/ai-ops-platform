/**
 * packages/server/src/scheduler/tasks/approvedDeployTask.ts
 *
 * 根拠: DevOps:REQ-010 / DevOps:SPEC-INT-020 / AC-010a / ADR-0014。
 * 承認の記録と実行を分離し、approved changeをCAS claimしてからdispatchする。
 */
import { sanitizeSecrets, type AuditLogWriter } from "@aiops/shared";
import type { ApprovedDeployClaim } from "../../db/approvalsRepo.js";
import type { ApprovedDeploymentTarget } from "../../db/deploymentsRepo.js";
import type { ScheduledTask } from "../scheduler.js";

export interface ApprovedDeployTaskDeps {
  approvalsRepo: { claimNextApprovedChange(traceId: string): Promise<ApprovedDeployClaim | null> };
  deploymentsRepo: {
    findNextApprovedDispatch(): Promise<ApprovedDeploymentTarget | null>;
    markDispatching(deployId: string): Promise<boolean>;
    markDispatchFailed(deployId: string): Promise<boolean>;
  };
  workflowExists(owner: string, repo: string): Promise<boolean>;
  execute(owner: string, repo: string, commitSha: string, traceId: string): Promise<void>;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
}

function validTarget(
  claim: ApprovedDeployClaim,
): claim is ApprovedDeployClaim & { deployId: string; projectId: string; commitSha: string } {
  const repository = claim.repositories[0];
  return (
    typeof claim.deployId === "string" &&
    claim.deployId.length > 0 &&
    typeof claim.projectId === "string" &&
    claim.projectId.trim().length > 0 &&
    typeof claim.commitSha === "string" &&
    /^[0-9a-f]{40}$/.test(claim.commitSha) &&
    claim.repositories.length === 1 &&
    Boolean(repository?.owner.trim()) &&
    Boolean(repository?.repo.trim())
  );
}

function targetFromClaim(
  claim: ApprovedDeployClaim & { deployId: string; projectId: string; commitSha: string },
): ApprovedDeploymentTarget {
  return {
    deployId: claim.deployId,
    projectId: claim.projectId,
    owner: claim.repositories[0]!.owner,
    repo: claim.repositories[0]!.repo,
    commitSha: claim.commitSha,
  };
}

export function createApprovedDeployTask(deps: ApprovedDeployTaskDeps): ScheduledTask {
  return {
    name: "approved-prod-deploy-30s",
    intervalMs: 30_000,
    runOnStart: true,
    async run(now): Promise<void> {
      const traceId = deps.traceIdProvider();
      let target = await deps.deploymentsRepo.findNextApprovedDispatch();
      let approvalId: string | null = null;
      if (!target) {
        const claim = await deps.approvalsRepo.claimNextApprovedChange(traceId);
        if (!claim) return;
        approvalId = claim.approvalId;
        if (!validTarget(claim)) {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "AGT-DEP",
            action: "prod_deploy_target_invalid",
            basis: "DevOps:REQ-010 / AC-010a",
            detail: {
              approvalId: claim.approvalId,
              projectIdAvailable: Boolean(claim.projectId),
              commitShaAvailable: Boolean(claim.commitSha),
              repositoryMappingCount: claim.repositories.length,
              workItemCreated: Boolean(claim.deployId),
            },
            at: now.toISOString(),
          });
          return;
        }
        target = targetFromClaim(claim);
      }
      let workflowAvailable: boolean;
      try {
        workflowAvailable = await deps.workflowExists(target.owner, target.repo);
      } catch (error) {
        await deps.deploymentsRepo.markDispatchFailed(target.deployId);
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-DEP",
          action: "prod_deploy_workflow_observation_failed",
          basis: "ADR-0014 / DevOps:REQ-010 / D-04",
          detail: { error: sanitizeSecrets(error instanceof Error ? error.message : String(error)).sanitized },
          at: now.toISOString(),
        });
        return;
      }
      if (!workflowAvailable) {
        await deps.deploymentsRepo.markDispatchFailed(target.deployId);
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-DEP",
          action: "prod_deploy_disabled",
          basis: "ADR-0014 / DevOps:REQ-010 / D-04",
          detail: { approvalId, deployId: target.deployId, reason: "deploy-prod.yml is absent" },
          at: now.toISOString(),
        });
        return;
      }
      if (!(await deps.deploymentsRepo.markDispatching(target.deployId))) return;
      try {
        await deps.execute(target.owner, target.repo, target.commitSha, traceId);
      } catch (error) {
        await deps.deploymentsRepo.markDispatchFailed(target.deployId);
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-DEP",
          action: "prod_deploy_dispatch_failed",
          basis: "DevOps:REQ-010 / DevOps:SPEC-INT-020",
          detail: { error: sanitizeSecrets(error instanceof Error ? error.message : String(error)).sanitized },
          at: now.toISOString(),
        });
        throw error;
      }
    },
  };
}
