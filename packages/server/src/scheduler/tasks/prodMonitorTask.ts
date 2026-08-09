/**
 * packages/server/src/scheduler/tasks/prodMonitorTask.ts
 *
 * 根拠: DevOps:REQ-012 / TH-003 / DevOps:SPEC-INT-020 / ADR-0014。
 * 60秒 cadenceで監視対象を評価し、欠落入力は0へ補完しない。
 */
import type { AuditLogWriter, ChannelRef } from "@aiops/shared";
import {
  evaluateTh003Rollback,
  selectRollbackTarget,
  type RollbackOutcome,
  type StableVersionRecord,
  type Th003Input,
} from "@aiops/devops";
import type { MonitoringDeploymentTarget } from "../../db/deploymentsRepo.js";
import type { ScheduledTask } from "../scheduler.js";

export interface ProdMonitorTaskDeps {
  /** Repo query is bounded to at most 100 active monitoring rows per tick. */
  deploymentsRepo: {
    listMonitoringTargets(): Promise<MonitoringDeploymentTarget[]>;
    markRollingBack(deployId: string): Promise<boolean>;
    markRolledBack(deployId: string): Promise<void>;
  };
  metricsProvider: { read(target: MonitoringDeploymentTarget, now: Date): Promise<Th003Input | null> };
  stableVersionsProvider: {
    read(target: MonitoringDeploymentTarget, now: Date): Promise<StableVersionRecord[] | null>;
  };
  workflowExists(owner: string, repo: string): Promise<boolean>;
  evaluate(
    input: Th003Input,
    stableVersions: StableVersionRecord[],
    target: MonitoringDeploymentTarget,
    channel: ChannelRef,
    traceId: string,
  ): Promise<RollbackOutcome>;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
}

export function createProdMonitorTask(deps: ProdMonitorTaskDeps): ScheduledTask {
  return {
    name: "prod-red-monitor-60s",
    intervalMs: 60_000,
    async run(now): Promise<void> {
      const targets = await deps.deploymentsRepo.listMonitoringTargets();
      for (const target of targets) {
        const traceId = deps.traceIdProvider();
        if (target.channels.length !== 1 || !target.channels[0]!.teamId || !target.channels[0]!.channelId) {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "AGT-DEP",
            action: "prod_monitor_target_invalid",
            basis: "DevOps:REQ-012 / TH-003",
            detail: { deployId: target.deployId, channelMappingCount: target.channels.length },
            at: now.toISOString(),
          });
          continue;
        }
        const input = await deps.metricsProvider.read(target, now);
        if (!input) {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "AGT-DEP",
            action: "prod_monitor_input_missing",
            basis: "ADR-0014 / DevOps:REQ-012 / TH-003 / D-04",
            detail: { deployId: target.deployId, reason: "TH-003 metrics window is unavailable" },
            at: now.toISOString(),
          });
          continue;
        }
        const stableVersions = await deps.stableVersionsProvider.read(target, now);
        let rollbackCandidates = stableVersions ?? [];
        if (!stableVersions) {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "AGT-DEP",
            action: "prod_monitor_stable_history_missing",
            basis: "ADR-0014 / DevOps:REQ-012 / TH-003 / D-04",
            detail: { deployId: target.deployId, reason: "Stable deployment history is unavailable" },
            at: now.toISOString(),
          });
        } else if (!(await deps.workflowExists(target.owner, target.repo))) {
          rollbackCandidates = [];
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "AGT-DEP",
            action: "prod_monitor_rollback_disabled",
            basis: "ADR-0014 / DevOps:REQ-012 / D-04",
            detail: { deployId: target.deployId, reason: "deploy-prod.yml is absent" },
            at: now.toISOString(),
          });
        }
        const willDispatch =
          evaluateTh003Rollback(input).shouldRollback && selectRollbackTarget(rollbackCandidates) !== null;
        if (willDispatch && !(await deps.deploymentsRepo.markRollingBack(target.deployId))) continue;
        const outcome = await deps.evaluate(input, rollbackCandidates, target, target.channels[0]!, traceId);
        if (outcome.rolledBack) await deps.deploymentsRepo.markRolledBack(target.deployId);
      }
    },
  };
}
