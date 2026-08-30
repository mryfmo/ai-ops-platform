// 根拠: ADR-0030 / 添付TEXT「Jira・GitHub・ai-ops-platform構成」
// Webhook欠落をJQL snapshotで補完する。全ページ完了(captureComplete=true)時だけcommitする。
import type { AuditLogWriter } from "@aiops/shared";
import type { JiraSnapshot } from "@aiops/integrations";
import type { ScheduledTask } from "../scheduler.js";

export interface JiraReconcileProject {
  readonly projectId: string;
  readonly jiraProjectId: string;
  readonly jql: string;
  readonly mappingVersion: number;
}

export interface JiraSnapshotReconcileDeps {
  readonly projects: readonly JiraReconcileProject[];
  captureSnapshot(project: JiraReconcileProject, now: Date): Promise<JiraSnapshot>;
  commitCompleteSnapshot(
    project: JiraReconcileProject,
    snapshot: JiraSnapshot & { readonly captureComplete: true },
  ): Promise<void>;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  intervalMs?: number;
}

function assertCompleteSnapshot(snapshot: JiraSnapshot): asserts snapshot is JiraSnapshot & { captureComplete: true } {
  if (snapshot.captureComplete !== true)
    throw new Error("Jira snapshot capture_complete=false; partial capture rejected");
  const seenIssueKeys = new Set<string>();
  for (const issue of snapshot.issues) {
    if (seenIssueKeys.has(issue.issueKey)) throw new Error(`duplicate Jira issue ${issue.issueKey} in snapshot`);
    seenIssueKeys.add(issue.issueKey);
  }
}

export function createJiraSnapshotReconcileTask(deps: JiraSnapshotReconcileDeps): ScheduledTask {
  return {
    name: "jira-snapshot-reconcile",
    intervalMs: deps.intervalMs ?? 15 * 60_000,
    async run(now: Date): Promise<void> {
      for (const project of deps.projects) {
        const traceId = deps.traceIdProvider();
        try {
          const snapshot = await deps.captureSnapshot(project, now);
          assertCompleteSnapshot(snapshot);
          await deps.commitCompleteSnapshot(project, snapshot);
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "SERVER",
            action: "jira_snapshot_reconcile_committed",
            basis: "JIRA-GH-GOV-001",
            detail: {
              projectId: project.projectId,
              jiraProjectId: project.jiraProjectId,
              mappingVersion: project.mappingVersion,
              capture_complete: true,
              issueCount: snapshot.issues.length,
              pageCount: snapshot.pageCount,
            },
            at: now.toISOString(),
          });
        } catch (error) {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "SERVER",
            action: "jira_snapshot_reconcile_rejected",
            basis: "JIRA-GH-GOV-001",
            detail: {
              projectId: project.projectId,
              jiraProjectId: project.jiraProjectId,
              capture_complete: false,
              reason: error instanceof Error ? error.message : String(error),
            },
            at: now.toISOString(),
          });
        }
      }
    },
  };
}
