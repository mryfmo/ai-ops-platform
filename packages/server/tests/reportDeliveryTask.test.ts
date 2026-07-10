import { describe, it, expect } from "vitest";
import { InMemoryAuditLog, buildHolidayCalendar } from "@aiops/shared";
import { InMemoryDeliveryLogStore } from "@aiops/prjops";
import { MetricsRegistry } from "../src/observability/metrics.js";
import {
  createReportDeliveryTask,
  deliverStandardReportToRecipients,
  renderStandardReportHtml,
} from "../src/scheduler/tasks/reportDeliveryTask.js";
import type { DeliveryRecipient } from "../src/db/recipientsRepo.js";
import type { StandardReportRecord } from "../src/db/standardReportsRepo.js";

const payload = {
  schemaVersion: "standard-report.v1",
  reportType: "weekly-summary",
  evidenceIds: ["REQ-042"],
  period: { label: "2026-W28", generatedAt: "2026-07-06T00:00:00.000Z" },
  metrics: { completed: 1 },
  slots: {
    conclusion: "Alice finished InternalPhoenix migration",
    riskSummary: "InternalPhoenix risk remains",
    nextActions: "Alice follows up",
  },
} as const;

const report: StandardReportRecord = {
  reportId: "STD-1",
  payload,
  reportType: "weekly-summary",
  periodLabel: "2026-W28",
  generatedAt: payload.period.generatedAt,
  receivedAt: payload.period.generatedAt,
};

function recipient(overrides: Partial<DeliveryRecipient> = {}): DeliveryRecipient {
  return {
    userId: "ST-001",
    profile: "PRF-02",
    persona: "manager",
    email: "manager@example.com",
    projects: ["global"],
    language: "ja",
    active: true,
    teamsTeamId: null,
    teamsChannelId: null,
    ...overrides,
  };
}

describe("reportDeliveryTask [REQ-042 SPEC-INT-069 AC-042-1]", () => {
  it("FROM_MAILBOX未設定時はdisabled監査を残し、送信しない", async () => {
    const auditLog = new InMemoryAuditLog();
    const mails: unknown[] = [];
    const task = createReportDeliveryTask({
      enabled: true,
      publicBaseUrl: "https://aiops.example.com",
      calendar: buildHolidayCalendar([]),
      recipientsRepo: { listForDelivery: async () => [recipient()] },
      standardReportsRepo: { listRecent: async () => [report] },
      graphClient: { sendMail: async (m) => void mails.push(m), sendAdaptiveCard: async () => ({ messageId: "m" }) },
      deliveryLogStore: new InMemoryDeliveryLogStore(),
      auditLog,
      traceIdProvider: () => "trace-1",
    });
    await task.run(new Date("2026-07-06T00:00:00.000Z"));
    expect(mails).toHaveLength(0);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "report_delivery_disabled")).toBe(true);
  });

  it("inactive recipientsを除外し、同一report/recipientの再配信をskipする", async () => {
    const auditLog = new InMemoryAuditLog();
    const mails: Array<{ toEmail: string }> = [];
    const store = new InMemoryDeliveryLogStore();
    const deps = {
      fromMailbox: "from@example.com",
      publicBaseUrl: "https://aiops.example.com",
      recipientsRepo: { listForDelivery: async () => [recipient(), recipient({ userId: "ST-002", active: false })] },
      graphClient: {
        sendMail: async (m: { toEmail: string }) => void mails.push(m),
        sendAdaptiveCard: async () => ({ messageId: "m" }),
      },
      deliveryLogStore: store,
      auditLog,
      traceIdProvider: () => "trace-2",
    };
    await deliverStandardReportToRecipients(report, deps, "trace-2");
    await deliverStandardReportToRecipients(report, deps, "trace-2");
    expect(mails.map((m) => m.toEmail)).toEqual(["manager@example.com"]);
  });

  it("delivery outcome metricsを記録する", async () => {
    const metrics = new MetricsRegistry();
    const mails: Array<{ toEmail: string }> = [];
    await deliverStandardReportToRecipients(
      report,
      {
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: { listForDelivery: async () => [recipient()] },
        graphClient: {
          sendMail: async (m: { toEmail: string }) => void mails.push(m),
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-metrics",
        metrics,
      },
      "trace-metrics",
    );
    expect(metrics.renderPrometheus()).toContain('aiops_report_delivery_total{result="sent"} 1');
  });

  it("investor向け本文では内部詳細が漏れない", () => {
    const html = renderStandardReportHtml(payload, recipient({ profile: "PRF-05", persona: "investor" }));
    expect(html).not.toContain("InternalPhoenix");
    expect(html).not.toContain("Alice");
    expect(html).toContain("[masked]");
  });

  it("PRF-Gは空projectsでもglobal audienceとして標準レポート本文を読める", () => {
    const html = renderStandardReportHtml(
      payload,
      recipient({ profile: "PRF-G", persona: "global-manager", projects: [] }),
    );
    expect(html).toContain("Alice finished InternalPhoenix migration");
    expect(html).not.toContain("[masked]");
  });

  it("Teamsカードにdashboardディープリンクを付ける", async () => {
    const cards: unknown[] = [];
    await deliverStandardReportToRecipients(
      report,
      {
        fromMailbox: "from@example.com",
        defaultTeamsChannelId: "chan-1",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: { listForDelivery: async () => [recipient({ teamsChannelId: "chan-1" })] },
        graphClient: {
          sendMail: async () => {},
          sendAdaptiveCard: async (input) => {
            cards.push(input.card);
            return { messageId: "card-1" };
          },
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-3",
      },
      "trace-3",
    );
    expect(JSON.stringify(cards[0])).toContain("openUrlActions");
    expect(JSON.stringify(cards[0])).toContain("/app/dashboard?persona=manager&period=2026-W28");
  });

  it("月曜祝日なら週内の次営業日にキャッチアップ配信する", async () => {
    const mails: unknown[] = [];
    const task = createReportDeliveryTask({
      enabled: true,
      fromMailbox: "from@example.com",
      publicBaseUrl: "https://aiops.example.com",
      calendar: buildHolidayCalendar([{ date: "2026-07-06", name_ja: "振替休日", verified: true }]),
      recipientsRepo: { listForDelivery: async () => [recipient()] },
      standardReportsRepo: { listRecent: async () => [report] },
      graphClient: { sendMail: async (m) => void mails.push(m), sendAdaptiveCard: async () => ({ messageId: "m" }) },
      deliveryLogStore: new InMemoryDeliveryLogStore(),
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-catchup",
    });
    await task.run(new Date("2026-07-07T00:00:00.000Z"));
    expect(mails).toHaveLength(1);
  });

  it("不正publicBaseUrlは該当受信者だけskipして監査し、他受信者を継続する", async () => {
    const auditLog = new InMemoryAuditLog();
    const mails: Array<{ toEmail: string }> = [];
    const result = await deliverStandardReportToRecipients(
      report,
      {
        fromMailbox: "from@example.com",
        publicBaseUrl: "not-a-url",
        recipientsRepo: {
          listForDelivery: async () => [
            recipient({
              userId: "ST-001",
              email: "bad-link@example.com",
              persona: "manager",
              teamsChannelId: "chan-1",
            }),
            recipient({ userId: "ST-002", email: "ok@example.com", persona: "investor" }),
          ],
        },
        graphClient: {
          sendMail: async (m: { toEmail: string }) => void mails.push(m),
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog,
        traceIdProvider: () => "trace-link",
      },
      "trace-link",
    );
    expect(result.activeRecipients).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mails.map((mail) => mail.toEmail)).toEqual(["ok@example.com"]);
    expect((await auditLog.readAll()).some((record) => record.action === "report_delivery_recipient_skipped")).toBe(
      true,
    );
  });
});
