/**
 * packages/server/src/scheduler/tasks/reportDeliveryTask.ts
 *
 * 根拠: ADR-0014 / REQ-042 / SPEC-INT-069 / AC-042-1。
 * 標準report.jsonをrecipientsへOutlook/Teamsで配信する常駐server schedulerタスク。
 */
import {
  filterIssuesForProfile,
  type DeliveryLogStore,
  type DeliveryTarget,
  type ReportAudience,
  runDistributionCycle,
} from "@aiops/prjops";
import { isActiveRecipient, type RecipientRecord as DevopsRecipientRecord } from "@aiops/devops";
import {
  isBusinessDay,
  todayJstDateString,
  type AuditLogWriter,
  type GraphClient,
  type HolidayCalendar,
  type StandardReportPayload,
} from "@aiops/shared";
import type { DeliveryRecipient } from "../../db/recipientsRepo.js";
import type { StandardReportRecord } from "../../db/standardReportsRepo.js";
import type { Logger } from "../../observability/logger.js";
import type { MetricsRegistry } from "../../observability/metrics.js";
import { buildDashboardDeepLink } from "../../lib/dashboardDeepLink.js";
import type { ScheduledTask } from "../scheduler.js";

export interface ReportDeliveryTaskDeps {
  enabled: boolean;
  fromMailbox?: string;
  defaultTeamsChannelId?: string;
  publicBaseUrl: string;
  calendar: HolidayCalendar;
  recipientsRepo: { listForDelivery(): Promise<DeliveryRecipient[]> };
  standardReportsRepo: { listRecent(limit?: number): Promise<StandardReportRecord[]> };
  graphClient: Pick<GraphClient, "sendMail" | "sendAdaptiveCard">;
  deliveryLogStore: DeliveryLogStore;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  intervalMs?: number;
  logger?: Logger;
  metrics?: MetricsRegistry;
}

function jstDayOfWeek(now: Date): number {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCDay();
}

function jstDateAtStart(now: Date): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - 9 * 60 * 60 * 1000);
}

function toJstDateString(date: Date): string {
  return todayJstDateString(date);
}

function isFirstBusinessDayOfWeek(calendar: HolidayCalendar, now: Date): boolean {
  const today = toJstDateString(now);
  if (!isBusinessDay(calendar, today)) return false;
  const start = jstDateAtStart(now);
  const day = jstDayOfWeek(now);
  const daysSinceMonday = (day + 6) % 7;
  for (let i = 1; i <= daysSinceMonday; i += 1) {
    const previous = new Date(start.getTime() - i * 24 * 60 * 60 * 1000);
    if (isBusinessDay(calendar, toJstDateString(previous))) return false;
  }
  return true;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function audienceForRecipient(recipient: DeliveryRecipient): ReportAudience {
  if (recipient.persona === "investor") return "investor";
  if (["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05"].includes(recipient.profile)) {
    return recipient.profile as ReportAudience;
  }
  return "PRF-03";
}

function devopsActiveRecords(recipients: DeliveryRecipient[]): DevopsRecipientRecord[] {
  return recipients.map((r) => ({
    userId: r.userId,
    profile: ["PRF-M", "PRF-L", "PRF-G"].includes(r.profile)
      ? (r.profile as DevopsRecipientRecord["profile"])
      : "PRF-G",
    email: r.email,
    active: r.active,
  }));
}

function visibleSlots(payload: StandardReportPayload, recipient: DeliveryRecipient): StandardReportPayload["slots"] {
  const audience = audienceForRecipient(recipient);
  const projectId = recipient.projects[0] ?? "global";
  const issues = Object.entries(payload.slots).map(([key, text]) => ({
    projectId,
    ownerStakeholderId: recipient.userId,
    detail: text,
    reportedByName: recipient.userId,
    slotKey: key,
  }));
  const filtered = filterIssuesForProfile(audience, issues, {
    recipientStakeholderId: recipient.userId,
    recipientManagedProjectIds: recipient.projects,
    recipientAssignedProjectIds: recipient.projects,
    recipientParticipatingProjectIds: recipient.projects,
    investedProjectIds: recipient.projects,
  });
  const byKey = new Map(filtered.map((i) => [String((i as unknown as { slotKey: string }).slotKey), i.detail]));
  return {
    conclusion: byKey.get("conclusion") || "[masked]",
    riskSummary: byKey.get("riskSummary") || "[masked]",
    nextActions: byKey.get("nextActions") || "[masked]",
  };
}

export function renderStandardReportHtml(payload: StandardReportPayload, recipient: DeliveryRecipient): string {
  const slots = visibleSlots(payload, recipient);
  return [
    `<h1>${escapeHtml(payload.reportType)} ${escapeHtml(payload.period.label)}</h1>`,
    `<h2>Conclusion</h2><p>${escapeHtml(slots.conclusion)}</p>`,
    `<h2>Risk</h2><p>${escapeHtml(slots.riskSummary)}</p>`,
    `<h2>Next actions</h2><p>${escapeHtml(slots.nextActions)}</p>`,
  ].join("\n");
}

export async function deliverStandardReportToRecipients(
  record: Pick<StandardReportRecord, "reportId" | "payload" | "periodLabel">,
  deps: Omit<ReportDeliveryTaskDeps, "standardReportsRepo" | "intervalMs" | "calendar" | "enabled"> & {
    fromMailbox: string;
  },
  traceId: string,
): Promise<{ sent: number; skipped: number; failed: number; activeRecipients: number }> {
  const logger = deps.logger?.child({ trace_id: traceId, report_id: record.reportId });
  logger?.info("report delivery started");
  const recipients = await deps.recipientsRepo.listForDelivery();
  const activeRecords = devopsActiveRecords(recipients);
  const activeRecipients = recipients.filter((r) => isActiveRecipient(activeRecords, r.userId));
  const targets: DeliveryTarget[] = [];
  for (const recipient of activeRecipients) {
    const persona = recipient.persona ?? recipient.profile;
    const teamsChannelId = recipient.teamsChannelId ?? deps.defaultTeamsChannelId;
    let dashboardUrl: string | undefined;
    if (teamsChannelId) {
      try {
        dashboardUrl = buildDashboardDeepLink({
          publicBaseUrl: deps.publicBaseUrl,
          persona,
          periodLabel: record.periodLabel,
        });
      } catch (err) {
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-05",
          action: "report_delivery_recipient_skipped",
          basis: "REQ-042 SPEC-INT-069",
          detail: { recipientId: recipient.userId, reason: String(err) },
          at: new Date().toISOString(),
        });
        continue;
      }
    }
    targets.push({
      reportId: record.reportId,
      recipientId: recipient.userId,
      recipientEmail: recipient.email,
      subject: `[ai-ops] ${record.payload.reportType} ${record.periodLabel}`,
      html: renderStandardReportHtml(record.payload, recipient),
      postTeamsSummaryCard: Boolean(teamsChannelId),
      teamsChannelId: teamsChannelId ?? undefined,
      dashboardUrl,
    });
  }
  const result = await runDistributionCycle(targets, {
    graphClient: deps.graphClient,
    deliveryLogStore: deps.deliveryLogStore,
    auditLog: deps.auditLog,
    traceId,
    fromMailbox: deps.fromMailbox,
  });
  deps.metrics?.recordDelivery("sent", result.sent.length);
  deps.metrics?.recordDelivery("skipped", result.skipped.length);
  deps.metrics?.recordDelivery("failed", result.failed.length);
  logger?.info(
    { sent: result.sent.length, skipped: result.skipped.length, failed: result.failed.length },
    "report delivery completed",
  );
  return {
    sent: result.sent.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
    activeRecipients: activeRecipients.length,
  };
}

export function createReportDeliveryTask(deps: ReportDeliveryTaskDeps): ScheduledTask {
  return {
    name: "report-delivery-weekly",
    intervalMs: deps.intervalMs ?? 24 * 60 * 60 * 1000,
    async run(now: Date): Promise<void> {
      const traceId = deps.traceIdProvider();
      const at = now.toISOString();
      if (!deps.enabled || !deps.fromMailbox) {
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "AGT-05",
          action: "report_delivery_disabled",
          basis: "ADR-0014",
          detail: {
            reason: !deps.enabled ? "REPORT_DELIVERY_ENABLED is not true" : "FROM_MAILBOX is not configured",
          },
          at,
        });
        return;
      }

      if (!isFirstBusinessDayOfWeek(deps.calendar, now)) return;

      let sent = 0;
      let skipped = 0;
      let failed = 0;
      for (const report of await deps.standardReportsRepo.listRecent(100)) {
        const result = await deliverStandardReportToRecipients(
          report,
          { ...deps, fromMailbox: deps.fromMailbox },
          traceId,
        );
        sent += result.sent;
        skipped += result.skipped;
        failed += result.failed;
      }

      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-05",
        action: "report_delivery_cycle_completed",
        basis: "REQ-042 SPEC-INT-069 AC-042-1",
        detail: { sent, skipped, failed },
        at,
      });
    },
  };
}
