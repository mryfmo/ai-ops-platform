/**
 * packages/server/src/scheduler/tasks/prjopsDailyTrackerTask.ts
 *
 * 根拠: PrjOps:REQ-006/009 / PrjOps:SPEC-INT-025/040 / PrjOps:SPEC-EXT-034/035。
 * 営業日09:00 JSTにAGT-06を実行し、通知成功直後にDB operational stateを更新する。
 */
import { processActionForDay, type TrackedAction } from "@aiops/prjops";
import { sanitizeSecrets, todayJstDateString, type AuditLogWriter, type HolidayCalendar } from "@aiops/shared";
import type { GraphClient } from "@aiops/shared";
import type {
  ActionReminderState,
  ActionReminderStateRepo,
  ReminderOutcome,
} from "../../db/actionReminderStateRepo.js";
import { failureSchedule, isDailyTrackingDue, isSameJstDate } from "../../lib/prjopsJobPolicy.js";
import type { ScheduledTask } from "../scheduler.js";

export interface DailyTrackedAction extends Omit<TrackedAction, "remindersSentCount"> {
  managerEmail: string;
  remindersSentCountBaseline?: number;
}

export interface PrjopsDailyTrackerProvider {
  listOpenActions(): Promise<DailyTrackedAction[]>;
}

type ProcessAction = typeof processActionForDay;

export interface PrjopsDailyTrackerTaskDeps {
  provider?: PrjopsDailyTrackerProvider;
  stateRepo: Pick<ActionReminderStateRepo, "findMany" | "recordOutcome">;
  processAction?: ProcessAction;
  graphClient?: Pick<GraphClient, "sendMail" | "sendAdaptiveCard">;
  fromMailbox?: string;
  pmoNotifyMailbox?: string;
  calendar: HolidayCalendar;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  intervalMs?: number;
}

const emptyState = (actionId: string): ActionReminderState => ({
  actionId,
  remindersSentCount: 0,
  lastNotifiedAt: null,
  escalatedAt: null,
});

export function createPrjopsDailyTrackerTask(deps: PrjopsDailyTrackerTaskDeps): ScheduledTask {
  let retry: { attemptNumber: number; nextAttemptAtMs: number; slot: string } | null = null;
  let completedSlot: string | null = null;

  return {
    name: "prjops-daily-tracker",
    intervalMs: deps.intervalMs ?? 60_000,
    async run(now): Promise<void> {
      const slot = todayJstDateString(now);
      const retryDue = retry !== null && now.getTime() >= retry.nextAttemptAtMs;
      if (!retryDue && (!isDailyTrackingDue(deps.calendar, now) || completedSlot === slot)) return;
      const traceId = deps.traceIdProvider();
      const attemptNumber = retryDue ? retry!.attemptNumber : 1;
      if (!deps.provider || !deps.graphClient || !deps.fromMailbox) {
        completedSlot = slot;
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-06",
          action: "daily_tracking_disabled",
          basis: "ADR-0014 / PrjOps:SPEC-INT-040",
          detail: { reason: "Pinned PrjOps job data provider, FROM_MAILBOX, or Graph dependency is not configured" },
          at: now.toISOString(),
        });
        return;
      }

      try {
        const sourceActions = await deps.provider.listOpenActions();
        const states = await deps.stateRepo.findMany(sourceActions.map((action) => action.id));
        const process = deps.processAction ?? processActionForDay;
        let processed = 0;
        for (const source of sourceActions) {
          const persisted = states.get(source.id) ?? emptyState(source.id);
          const state = {
            ...persisted,
            remindersSentCount: Math.max(persisted.remindersSentCount, source.remindersSentCountBaseline ?? 0),
          };
          if (state.escalatedAt || (state.lastNotifiedAt && isSameJstDate(state.lastNotifiedAt, slot))) continue;
          const { managerEmail, remindersSentCountBaseline, ...action } = source;
          const result = await process(
            { ...action, remindersSentCount: state.remindersSentCount },
            {
              cal: deps.calendar,
              graphClient: deps.graphClient,
              auditLog: deps.auditLog,
              traceId,
              todayJst: slot,
              fromMailbox: deps.fromMailbox,
              managerEmailByProject: () => managerEmail,
            },
          );
          if (result !== "none") {
            await deps.stateRepo.recordOutcome(
              source.id,
              result as ReminderOutcome,
              now.toISOString(),
              remindersSentCountBaseline ?? 0,
            );
            processed += 1;
          }
        }
        retry = null;
        completedSlot = slot;
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-06",
          action: "daily_tracking_completed",
          basis: "PrjOps:REQ-009 / PrjOps:SPEC-INT-040",
          detail: { actionCount: sourceActions.length, processed },
          at: now.toISOString(),
        });
      } catch (error) {
        const schedule = failureSchedule(attemptNumber, now);
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-01",
          action: schedule.action === "retry" ? "scheduled_job_retry" : "scheduled_job_escalation",
          basis: "PrjOps:REQ-006 / PrjOps:SPEC-INT-040",
          detail: {
            jobName: "prjops-daily-tracker",
            attemptNumber,
            error: sanitizeSecrets(error instanceof Error ? error.message : String(error)).sanitized,
          },
          at: now.toISOString(),
        });
        if (schedule.action === "retry") {
          retry = { attemptNumber: schedule.nextAttemptNumber!, nextAttemptAtMs: schedule.nextAttemptAtMs!, slot };
          return;
        }
        retry = null;
        completedSlot = slot;
        if (deps.pmoNotifyMailbox) {
          await deps.graphClient.sendMail({
            toEmail: deps.pmoNotifyMailbox,
            fromMailbox: deps.fromMailbox,
            subject: "[ai-ops] PrjOps daily tracking failed",
            htmlBody: "<p>AGT-06 daily tracking failed after three attempts. Check the audit trace.</p>",
          });
        } else {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "AGT-01",
            action: "pmo_escalation_disabled",
            basis: "ADR-0014 / PrjOps:REQ-006",
            detail: { reason: "PMO_NOTIFY_MAILBOX is not configured" },
            at: now.toISOString(),
          });
        }
      }
    },
  };
}
