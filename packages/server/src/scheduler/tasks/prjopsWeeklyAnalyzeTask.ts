/**
 * packages/server/src/scheduler/tasks/prjopsWeeklyAnalyzeTask.ts
 *
 * 根拠: PrjOps:REQ-006/007 / PrjOps:SPEC-INT-040 / ADR-0003 amendment。
 * 月曜06:00 JSTにAGT-03の決定的status分析を実行し、AGT-01の10分×2 retryを適用する。
 */
import type { GraphClient } from "@aiops/shared";
import { sanitizeSecrets, todayJstDateString, type AuditLogWriter } from "@aiops/shared";
import { analyzeProjectStatus, type ProjectJudgementRequest } from "@aiops/prjops";
import { failureSchedule, isWeeklyAnalysisDue } from "../../lib/prjopsJobPolicy.js";
import type { ScheduledTask } from "../scheduler.js";

export interface PrjopsWeeklyAnalyzeProvider {
  listActiveProjects(): Promise<ProjectJudgementRequest[]>;
}

export interface PrjopsWeeklyAnalyzeTaskDeps {
  provider?: PrjopsWeeklyAnalyzeProvider;
  analyze?: (project: ProjectJudgementRequest) => unknown;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  graphClient?: Pick<GraphClient, "sendMail">;
  pmoNotifyMailbox?: string;
  fromMailbox?: string;
  intervalMs?: number;
}

export function createPrjopsWeeklyAnalyzeTask(deps: PrjopsWeeklyAnalyzeTaskDeps): ScheduledTask {
  let retry: { attemptNumber: number; nextAttemptAtMs: number; slot: string } | null = null;
  let completedSlot: string | null = null;

  return {
    name: "prjops-weekly-analyze",
    intervalMs: deps.intervalMs ?? 60_000,
    async run(now): Promise<void> {
      const slot = todayJstDateString(now);
      const retryDue = retry !== null && now.getTime() >= retry.nextAttemptAtMs;
      if (!retryDue && (!isWeeklyAnalysisDue(now) || completedSlot === slot)) return;
      const attemptNumber = retryDue ? retry!.attemptNumber : 1;
      const traceId = deps.traceIdProvider();

      if (!deps.provider) {
        completedSlot = slot;
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-03",
          action: "weekly_analysis_disabled",
          basis: "ADR-0014 / PrjOps:SPEC-INT-040",
          detail: { reason: "Pinned PrjOps job data provider is not configured" },
          at: now.toISOString(),
        });
        return;
      }

      try {
        const projects = await deps.provider.listActiveProjects();
        const analyze = deps.analyze ?? analyzeProjectStatus;
        const results = projects.map((project) => analyze(project));
        retry = null;
        completedSlot = slot;
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-03",
          action: "weekly_analysis_completed",
          basis: "PrjOps:REQ-007 / PrjOps:SPEC-INT-040",
          detail: { projectCount: projects.length, results },
          at: now.toISOString(),
        });
      } catch (error) {
        const schedule = failureSchedule(attemptNumber, now);
        const safeError = sanitizeSecrets(error instanceof Error ? error.message : String(error)).sanitized;
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-01",
          action: schedule.action === "retry" ? "scheduled_job_retry" : "scheduled_job_escalation",
          basis: "PrjOps:REQ-006 / PrjOps:SPEC-INT-040",
          detail: { jobName: "prjops-weekly-analyze", attemptNumber, error: safeError },
          at: now.toISOString(),
        });
        if (schedule.action === "retry") {
          retry = { attemptNumber: schedule.nextAttemptNumber!, nextAttemptAtMs: schedule.nextAttemptAtMs!, slot };
          return;
        }
        retry = null;
        completedSlot = slot;
        if (deps.graphClient && deps.pmoNotifyMailbox && deps.fromMailbox) {
          await deps.graphClient.sendMail({
            toEmail: deps.pmoNotifyMailbox,
            fromMailbox: deps.fromMailbox,
            subject: "[ai-ops] PrjOps weekly analysis failed",
            htmlBody: "<p>AGT-03 weekly analysis failed after three attempts. Check the audit trace.</p>",
          });
        } else {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "AGT-01",
            action: "pmo_escalation_disabled",
            basis: "ADR-0014 / PrjOps:REQ-006",
            detail: { reason: "PMO_NOTIFY_MAILBOX or Graph mail dependency is not configured" },
            at: now.toISOString(),
          });
        }
      }
    },
  };
}
