/**
 * packages/prjops/src/agents/AGT06_tracker.ts
 *
 * 根拠: REQ-009（アクション期限管理）/ SPEC-EXT-034（アクション事前通知/督促）/ SPEC-EXT-035（エスカレーション）
 * 毎営業日09:00 JSTのtrack-dailyジョブから呼ばれる想定（PrjOps:SPEC-INT-040）だが、T20時点では
 * packages/prjops/src/workflows/*.ymlを出荷しておらず、package-local schedulerは未実装。
 *
 * 本モジュールは判定（actionReminder.ts）と配信（GraphClient）・記録（AuditLogWriter）を結線する
 * 薄いオーケストレーション層。判定ロジック自体はlib/actionReminder.tsの純粋関数に委譲する。
 */
import type { HolidayCalendar } from "@aiops/shared/calendar/businessCalendar.js";
import type { GraphClient } from "@aiops/shared/clients/graphClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { decideReminderAction, isPreDueReminderDay } from "../lib/actionReminder.js";

export interface TrackedAction {
  id: string; // ACT-nnn
  projectId: string;
  due: string;
  status: "open" | "done";
  remindersSentCount: number;
  assigneeEmail: string;
  assigneeTeamsChatId?: string;
}

export interface TrackerDependencies {
  cal: HolidayCalendar;
  graphClient: Pick<GraphClient, "sendMail" | "sendAdaptiveCard">;
  auditLog: AuditLogWriter;
  traceId: string;
  todayJst: string;
  fromMailbox: string;
  managerEmailByProject: (projectId: string) => string;
}

export interface TrackerRunSummary {
  preDueNotified: string[];
  reminded: string[];
  escalated: string[];
}

/** REQ-009: 1件のアクションに対する日次判定・通知実行 */
export async function processActionForDay(
  action: TrackedAction,
  deps: TrackerDependencies,
): Promise<"pre_due" | "reminded" | "escalated" | "none"> {
  if (action.status === "done") return "none";

  if (isPreDueReminderDay(deps.cal, action.due, deps.todayJst)) {
    await deps.graphClient.sendMail({
      toEmail: action.assigneeEmail,
      subject: `【期限3営業日前】${action.id}`,
      htmlBody: `<p>アクション ${action.id} の期限が近づいています（期限: ${action.due}）。</p>`,
      fromMailbox: deps.fromMailbox,
    });
    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-06",
      action: "pre_due_notice",
      basis: "SPEC-EXT-034",
      detail: { actionId: action.id },
      at: new Date().toISOString(),
    });
    return "pre_due";
  }

  const decision = decideReminderAction(deps.cal, {
    due: action.due,
    status: action.status,
    remindersSentCount: action.remindersSentCount,
    todayJst: deps.todayJst,
  });

  if (decision.shouldRemind) {
    await deps.graphClient.sendMail({
      toEmail: action.assigneeEmail,
      subject: `【督促${decision.reminderNumber}回目】${action.id}`,
      htmlBody: `<p>アクション ${action.id} が期限超過しています（期限: ${action.due}）。至急ご対応ください。</p>`,
      fromMailbox: deps.fromMailbox,
    });
    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-06",
      action: "reminder",
      basis: "REQ-009 AC-009-1",
      detail: { actionId: action.id, reminderNumber: decision.reminderNumber },
      at: new Date().toISOString(),
    });
    return "reminded";
  }

  if (decision.shouldEscalate) {
    const managerEmail = deps.managerEmailByProject(action.projectId);
    await deps.graphClient.sendMail({
      toEmail: managerEmail,
      subject: `【エスカレーション】${action.id} 督促超過`,
      htmlBody: `<p>アクション ${action.id}（担当: ${action.assigneeEmail}）が督促3回を超えても未完了です。</p>`,
      fromMailbox: deps.fromMailbox,
    });
    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-06",
      action: "escalation",
      basis: "REQ-009 AC-009-2",
      detail: { actionId: action.id, projectId: action.projectId },
      at: new Date().toISOString(),
    });
    return "escalated";
  }

  return "none";
}

/** track-dailyジョブ本体: 全オープンアクションを処理する */
export async function runDailyTracking(
  actions: TrackedAction[],
  deps: TrackerDependencies,
): Promise<TrackerRunSummary> {
  const summary: TrackerRunSummary = { preDueNotified: [], reminded: [], escalated: [] };
  for (const action of actions) {
    const result = await processActionForDay(action, deps);
    if (result === "pre_due") summary.preDueNotified.push(action.id);
    if (result === "reminded") summary.reminded.push(action.id);
    if (result === "escalated") summary.escalated.push(action.id);
  }
  return summary;
}
