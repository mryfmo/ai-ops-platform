import { describe, it, expect } from "vitest";
import { InMemoryAuditLog, buildHolidayCalendar } from "@aiops/shared";
import { InMemoryDeliveryLogStore } from "@aiops/prjops";
import { MetricsRegistry } from "../src/observability/metrics.js";
import {
  createReportDeliveryTask,
  deliverStandardReportToRecipients,
  renderStandardReportHtml,
  type ReportDeliveryTaskDeps,
} from "../src/scheduler/tasks/reportDeliveryTask.js";
import type { DeliveryRecipient } from "../src/db/recipientsRepo.js";
import type { StandardReportRecord } from "../src/db/standardReportsRepo.js";

const EMAIL_ADDRESS = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;

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
    expect(JSON.stringify(logs)).not.toMatch(EMAIL_ADDRESS);
    expect(JSON.stringify(logs)).not.toMatch(/InternalPhoenix|weekly-summary/);
  });

  it("inactive recipientsを除外し、同一report/recipientの再配信をskipする", async () => {
    const auditLog = new InMemoryAuditLog();
    const mails: Array<{ toEmail: string }> = [];
    const loggerEvents: unknown[] = [];
    const logger = {
      child(bindings: unknown) {
        loggerEvents.push(bindings);
        return { info: (...args: unknown[]) => void loggerEvents.push(args) };
      },
    } as unknown as NonNullable<ReportDeliveryTaskDeps["logger"]>;
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
      logger,
    };
    const first = await deliverStandardReportToRecipients(report, deps, "trace-2");
    const auditCountBeforeRetry = (await auditLog.readAll()).length;
    const retry = await deliverStandardReportToRecipients(report, deps, "trace-2");
    expect(mails.map((m) => m.toEmail)).toEqual(["manager@example.com"]);
    expect(first.sent).toBe(1);
    expect(retry.skipped).toBe(1);
    const retryAuditJson = JSON.stringify((await auditLog.readAll()).slice(auditCountBeforeRetry));
    expect(retryAuditJson).toContain('"reportId":"STD-1"');
    expect(retryAuditJson).toContain('"recipientId":"ST-001"');
    expect(retryAuditJson).not.toMatch(EMAIL_ADDRESS);
    expect(retryAuditJson).not.toMatch(/InternalPhoenix|weekly-summary/);
    const serialized = JSON.stringify(await auditLog.readAll());
    expect(serialized).toContain('"reportId":"STD-1"');
    expect(serialized).toContain('"recipientId":"ST-001"');
    expect(serialized).not.toMatch(EMAIL_ADDRESS);
    expect(serialized).not.toMatch(/InternalPhoenix|weekly-summary/);
    expect(JSON.stringify(loggerEvents)).toContain('"report_id":"STD-1"');
    expect(JSON.stringify(loggerEvents)).not.toMatch(EMAIL_ADDRESS);
    expect(JSON.stringify(loggerEvents)).not.toMatch(/InternalPhoenix|weekly-summary/);
  });

  it("pending delivery logは実配信経路で再送し、retry監査/logger JSONにPIIを残さない", async () => {
    const auditLog = new InMemoryAuditLog();
    const store = new InMemoryDeliveryLogStore();
    const subjects: string[] = [];
    const loggerEvents: unknown[] = [];
    await store.record({
      reportId: report.reportId,
      recipientId: "ST-001",
      deliveredAt: "2026-07-11T00:00:00.000Z",
      status: "pending",
    });
    const result = await deliverStandardReportToRecipients(
      report,
      {
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: { listForDelivery: async () => [recipient()] },
        graphClient: {
          sendMail: async ({ subject }) => void subjects.push(subject),
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: store,
        auditLog,
        traceIdProvider: () => "trace-pending-retry",
        logger: {
          child(bindings: unknown) {
            loggerEvents.push(bindings);
            return { info: (...args: unknown[]) => void loggerEvents.push(args) };
          },
        } as unknown as NonNullable<ReportDeliveryTaskDeps["logger"]>,
      },
      "trace-pending-retry",
    );
    expect(result.sent).toBe(1);
    expect(subjects).toEqual(["[ai-ops] weekly-summary 2026-W28 (再送)"]);
    const auditJson = JSON.stringify(await auditLog.readAll());
    const loggerJson = JSON.stringify(loggerEvents);
    expect(auditJson).toContain('"reportId":"STD-1"');
    expect(auditJson).toContain('"recipientId":"ST-001"');
    expect(auditJson).not.toMatch(EMAIL_ADDRESS);
    expect(auditJson).not.toMatch(/InternalPhoenix|weekly-summary|再送/);
    expect(loggerJson).toContain('"report_id":"STD-1"');
    expect(loggerJson).not.toMatch(EMAIL_ADDRESS);
    expect(loggerJson).not.toMatch(/InternalPhoenix|weekly-summary|再送/);
  });

  it.each(["victim@example.com", "arbitrary unsafe id", "ST-AliceSmith", "U-JaneDoe"])(
    "unsafe userId %s はdelivery logへ渡さず、監査にも値を残さない",
    async (userId) => {
      const auditLog = new InMemoryAuditLog();
      const deliveryLogCalls: unknown[] = [];
      const result = await deliverStandardReportToRecipients(
        report,
        {
          fromMailbox: "from@example.com",
          publicBaseUrl: "https://aiops.example.com",
          recipientsRepo: { listForDelivery: async () => [recipient({ userId })] },
          graphClient: {
            sendMail: async () => {
              throw new Error("must not send");
            },
            sendAdaptiveCard: async () => ({ messageId: "m" }),
          },
          deliveryLogStore: {
            exists: async (...args) => (deliveryLogCalls.push(args), false),
            record: async (...args) => void deliveryLogCalls.push(args),
          },
          auditLog,
          traceIdProvider: () => "trace-invalid-id",
        },
        "trace-invalid-id",
      );
      expect(result).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
      expect(deliveryLogCalls).toEqual([]);
      const serialized = JSON.stringify(await auditLog.readAll());
      expect(serialized).toContain('"reason":"invalid_recipient_id"');
      expect(serialized).not.toContain(userId);
      expect(serialized).not.toMatch(EMAIL_ADDRESS);
    },
  );

  it("Graph失敗監査はraw exceptionを捨て、固定code/statusと追跡IDだけを残す", async () => {
    const auditLog = new InMemoryAuditLog();
    const result = await deliverStandardReportToRecipients(
      report,
      {
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: { listForDelivery: async () => [recipient()] },
        graphClient: {
          sendMail: async () => {
            throw Object.assign(new Error("E-DLV01: sendMail failed with status 503"), {
              recipientEmail: "manager@example.com",
              subject: "SUBJECT-MARKER",
              body: "BODY-MARKER",
              clientState: "SECRET-MARKER",
            });
          },
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog,
        traceIdProvider: () => "trace-failure",
      },
      "trace-failure",
    );
    expect(result.failed).toBe(1);
    const serialized = JSON.stringify(await auditLog.readAll());
    expect(serialized).toContain('"reportId":"STD-1"');
    expect(serialized).toContain('"recipientId":"ST-001"');
    expect(serialized).toContain("E-DLV01");
    expect(serialized).toContain("status=503");
    expect(serialized).not.toMatch(EMAIL_ADDRESS);
    expect(serialized).not.toMatch(/SUBJECT-MARKER|BODY-MARKER|SECRET-MARKER/);
  });

  it("任意Graph messageからstatusや本文を監査へ取り込まない", async () => {
    const auditLog = new InMemoryAuditLog();
    await deliverStandardReportToRecipients(
      report,
      {
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: { listForDelivery: async () => [recipient()] },
        graphClient: {
          sendMail: async () => {
            throw new Error("E-DLV01: sendMail failed with status 503 BODY-MARKER");
          },
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog,
        traceIdProvider: () => "trace-arbitrary-error",
      },
      "trace-arbitrary-error",
    );
    const serialized = JSON.stringify(await auditLog.readAll());
    expect(serialized).toContain("E-DLV01: graph_delivery_failed status=unknown");
    expect(serialized).not.toContain("BODY-MARKER");
  });

  it("Teams失敗監査もraw exceptionを捨て、固定code/statusだけを残す", async () => {
    const auditLog = new InMemoryAuditLog();
    const result = await deliverStandardReportToRecipients(
      report,
      {
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: {
          listForDelivery: async () => [recipient({ teamsTeamId: "team-1", teamsChannelId: "chan-1" })],
        },
        graphClient: {
          sendMail: async () => {},
          sendAdaptiveCard: async () => {
            throw Object.assign(new Error("E-DLV02: Teams card send failed with status 429"), {
              recipientEmail: "manager@example.com",
              subject: "SUBJECT-MARKER",
              body: "BODY-MARKER",
              clientState: "SECRET-MARKER",
            });
          },
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog,
        traceIdProvider: () => "trace-card-failure",
      },
      "trace-card-failure",
    );
    expect(result.sent).toBe(1);
    const serialized = JSON.stringify(await auditLog.readAll());
    expect(serialized).toContain('"reportId":"STD-1"');
    expect(serialized).toContain('"recipientId":"ST-001"');
    expect(serialized).toContain("E-DLV02");
    expect(serialized).toContain("status=429");
    expect(serialized).not.toMatch(EMAIL_ADDRESS);
    expect(serialized).not.toMatch(/SUBJECT-MARKER|BODY-MARKER|SECRET-MARKER/);
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
        defaultTeamsTeamId: "team-1",
        defaultTeamsChannelId: "chan-1",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: {
          listForDelivery: async () => [recipient({ teamsTeamId: "team-1", teamsChannelId: "chan-1" })],
        },
        graphClient: {
          sendMail: async () => {},
          sendAdaptiveCard: async (input) => {
            cards.push(input);
            return { messageId: "card-1" };
          },
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-3",
      },
      "trace-3",
    );
    expect(cards[0]).toMatchObject({ target: { teamId: "team-1", channelId: "chan-1" } });
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
              teamsTeamId: "team-1",
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
    expect(await auditLog.readAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ detail: { recipientId: "ST-001", reason: "invalid_dashboard_url" } }),
      ]),
    );
  });
});
