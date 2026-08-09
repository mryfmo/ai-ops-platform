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
const verificationProviders = {
  personalNamesProvider: async (): Promise<readonly string[]> => [],
  internalTermsProvider: (): readonly string[] => [],
  stakeholderEmailsProvider: async (stakeholderIds: readonly string[]): Promise<ReadonlyMap<string, string>> =>
    new Map(
      stakeholderIds.flatMap((id) =>
        id === "ST-001" ? [[id, "manager@example.com"]] : id === "ST-002" ? [[id, "allowed@example.com"]] : [],
      ),
    ),
};

const payload = {
  schemaVersion: "standard-report.v2",
  reportType: "weekly-summary",
  evidenceIds: ["PrjOps:REQ-042"],
  period: { label: "2026-W28", generatedAt: "2026-07-06T00:00:00.000Z" },
  metrics: {
    completed: {
      value: 1,
      source: "code:report-delivery-test",
      as_of: "2026-07-06T00:00:00.000Z",
      scope: { kind: "project", projectId: "PJ-001" },
    },
  },
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
    projects: ["PJ-001"],
    scopeMode: "project",
    language: "ja",
    active: true,
    teamsTeamId: null,
    teamsChannelId: null,
    ...overrides,
  };
}

function deliveryTask(overrides: Partial<ReportDeliveryTaskDeps> = {}) {
  return createReportDeliveryTask({
    ...verificationProviders,
    enabled: true,
    fromMailbox: "from@example.com",
    publicBaseUrl: "https://aiops.example.com",
    calendar: buildHolidayCalendar([]),
    recipientsRepo: { listForDelivery: async () => [recipient()] },
    standardReportsRepo: { listRecent: async () => [report] },
    graphClient: { sendMail: async () => {}, sendAdaptiveCard: async () => ({ messageId: "m" }) },
    deliveryLogStore: new InMemoryDeliveryLogStore(),
    auditLog: new InMemoryAuditLog(),
    traceIdProvider: () => "trace-heartbeat",
    ...overrides,
  });
}

describe("reportDeliveryTask [PrjOps:REQ-042 SPEC-INT-069 PrjOps:AC-042-1]", () => {
  it("FROM_MAILBOX未設定時はdisabled監査を残し、送信しない", async () => {
    const auditLog = new InMemoryAuditLog();
    const mails: unknown[] = [];
    const task = createReportDeliveryTask({
      ...verificationProviders,
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
      ...verificationProviders,
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
        ...verificationProviders,
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
          ...verificationProviders,
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
        ...verificationProviders,
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
        ...verificationProviders,
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
        ...verificationProviders,
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
    expect(result.failed).toBe(1);
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
        ...verificationProviders,
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

  it("PrjOps:SPEC-INT-051: 権限内metricを公開IDと表示名で描画し内部keyを出さない", () => {
    const html = renderStandardReportHtml(
      {
        ...payload,
        metrics: {
          blocked: {
            value: 2,
            source: "code:z",
            as_of: "2026-07-06T02:00:00.000Z",
            scope: { kind: "project", projectId: "PJ-001" },
          },
          completed: {
            value: 1,
            source: "code:a",
            as_of: "2026-07-06T01:00:00.000Z",
            scope: { kind: "project", projectId: "PJ-001" },
          },
        },
      },
      recipient(),
    );
    expect(html).toContain('<span data-src="MTR-COMPLETED#value">1</span>');
    expect(html).toContain("完了件数");
    expect(html).not.toContain("completed");
    expect(html).toContain('<time datetime="2026-07-06T01:00:00.000Z">2026-07-06T01:00:00.000Z</time>');
    expect(html.indexOf("MTR-BLOCKED#value")).toBeLessThan(html.indexOf("MTR-COMPLETED#value"));
  });

  it("PrjOps:REQ-016/PrjOps:SPEC-INT-051: metric表示名を受信者言語へ揃える", () => {
    const html = renderStandardReportHtml(payload, recipient({ language: "en" }));
    expect(html).toContain("Completed");
    expect(html).not.toContain("完了件数");
  });

  it("PrjOps:SPEC-INT-051: scope欠落・権限外・表示名未定義metricを全audienceで省略する", () => {
    const html = renderStandardReportHtml(
      {
        ...payload,
        metrics: {
          completed: { ...payload.metrics.completed, scope: { kind: "project", projectId: "PJ-OTHER" } },
          blocked: { value: 2, source: "code:b", as_of: payload.period.generatedAt },
          secret_internal_key: {
            value: 99,
            source: "code:secret",
            as_of: payload.period.generatedAt,
            scope: { kind: "project", projectId: "PJ-001" },
          },
        },
      },
      recipient(),
    );
    expect(html).not.toMatch(/99|secret_internal_key|MTR-COMPLETED|MTR-BLOCKED/);
  });

  it("PrjOps:SPEC-INT-051: project-scoped PRF-04は他project metricとその数値を含むslotを隠す", () => {
    const html = renderStandardReportHtml(
      {
        ...payload,
        metrics: {
          completed: {
            value: 99,
            source: "code:other-project",
            as_of: payload.period.generatedAt,
            scope: { kind: "project", projectId: "PJ-OTHER" },
          },
        },
        slots: { ...payload.slots, conclusion: "完了は99件です" },
      },
      recipient({ profile: "PRF-04", projects: ["PJ-OWN"] }),
    );
    expect(html).not.toContain("MTR-COMPLETED");
    expect(html).not.toContain("99");
    expect(html).toContain("[masked]");
  });

  it("PrjOps:SPEC-INT-051: slot数値が可視metric値にgroundedなら同値の非可視metricがあっても維持する", () => {
    const html = renderStandardReportHtml(
      {
        ...payload,
        metrics: {
          completed: { ...payload.metrics.completed, value: 5, scope: { kind: "project", projectId: "PJ-001" } },
          blocked: {
            value: 5,
            source: "code:other-project",
            as_of: payload.period.generatedAt,
            scope: { kind: "project", projectId: "PJ-002" },
          },
        },
        slots: { ...payload.slots, conclusion: "他案件のブロックは5件です" },
      },
      recipient({ profile: "PRF-04", projects: ["PJ-001"] }),
    );
    expect(html).toContain("MTR-COMPLETED");
    expect(html).toContain("他案件のブロックは5件です");
    expect(html).not.toContain("[masked]");
  });

  const changingMetricValues = [1, 2];
  const changingMetric = {
    source: "code:v-a-test",
    as_of: "2026-07-06T00:00:00.000Z",
    scope: { kind: "project", projectId: "PJ-001" },
  };
  Object.defineProperty(changingMetric, "value", {
    enumerable: true,
    get: () => changingMetricValues.shift() ?? 2,
  });
  const vAFailedReport = {
    ...report,
    payload: { ...payload, metrics: { completed: changingMetric } },
  } as StandardReportRecord;

  it.each([
    ["V-A", "E-VER0A", vAFailedReport, recipient(), verificationProviders],
    [
      "V-B",
      "E-VER0B",
      report,
      recipient({ profile: "PRF-04" }),
      { ...verificationProviders, personalNamesProvider: async () => ["Alice"] },
    ],
    [
      "V-C",
      "E-VER0C",
      { ...report, payload: { ...payload, slots: { ...payload.slots, conclusion: "{{todo}}" } } },
      recipient(),
      verificationProviders,
    ],
  ] as const)(
    "PrjOps:REQ-019/AC-019-1: %s NGは送信せず%s監査・warn・metricを残す",
    async (_failureCode, errorCode, failedReport, failedRecipient, providers) => {
      const auditLog = new InMemoryAuditLog();
      const metrics = new MetricsRegistry();
      const mails: unknown[] = [];
      const warnings: unknown[] = [];
      const result = await deliverStandardReportToRecipients(
        failedReport,
        {
          ...providers,
          fromMailbox: "from@example.com",
          publicBaseUrl: "https://aiops.example.com",
          recipientsRepo: { listForDelivery: async () => [failedRecipient] },
          graphClient: {
            sendMail: async (mail) => void mails.push(mail),
            sendAdaptiveCard: async () => ({ messageId: "m" }),
          },
          deliveryLogStore: new InMemoryDeliveryLogStore(),
          auditLog,
          traceIdProvider: () => "trace-verification",
          metrics,
          logger: {
            child: () => ({ info: () => {}, warn: (...args: unknown[]) => void warnings.push(args) }),
          } as unknown as NonNullable<ReportDeliveryTaskDeps["logger"]>,
        },
        "trace-verification",
      );
      expect(mails).toHaveLength(0);
      expect(result).toMatchObject({ sent: 0, failed: 1 });
      expect(await auditLog.readAll()).toContainEqual(
        expect.objectContaining({
          action: "report_delivery_verification_failed",
          detail: { reportId: "STD-1", recipientId: failedRecipient.userId, code: errorCode },
        }),
      );
      expect(warnings).toHaveLength(1);
      expect(metrics.renderPrometheus()).toContain(`aiops_report_verification_failures_total{code="${errorCode}"} 1`);
    },
  );

  it("PrjOps:REQ-019/AC-019-1: V-D NGは実送信先不一致を送信せずE-VER0D監査する", async () => {
    const auditLog = new InMemoryAuditLog();
    const mails: unknown[] = [];
    const changingRecipient = recipient();
    const emails = ["intended@example.com", "intended@example.com", "actual@example.com"];
    Object.defineProperty(changingRecipient, "email", {
      enumerable: true,
      get: () => emails.shift() ?? "actual@example.com",
    });
    const result = await deliverStandardReportToRecipients(
      report,
      {
        ...verificationProviders,
        stakeholderEmailsProvider: async () => new Map([["ST-001", "intended@example.com"]]),
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: { listForDelivery: async () => [changingRecipient] },
        graphClient: {
          sendMail: async (mail) => void mails.push(mail),
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog,
        traceIdProvider: () => "trace-v-d",
      },
      "trace-v-d",
    );
    expect(mails).toHaveLength(0);
    expect(result.failed).toBe(1);
    expect(await auditLog.readAll()).toContainEqual(
      expect.objectContaining({ detail: { reportId: "STD-1", recipientId: "ST-001", code: "E-VER0D" } }),
    );
  });

  it.each(["missing", "error"])(
    "PrjOps:REQ-019/AC-019-1: ST-idのmaster email %sはE-VER0Dでfail-closeする",
    async (mode) => {
      const auditLog = new InMemoryAuditLog();
      const result = await deliverStandardReportToRecipients(
        report,
        {
          ...verificationProviders,
          stakeholderEmailsProvider: async () => {
            if (mode === "error") throw new Error("master unavailable");
            return new Map();
          },
          fromMailbox: "from@example.com",
          publicBaseUrl: "https://aiops.example.com",
          recipientsRepo: { listForDelivery: async () => [recipient()] },
          graphClient: { sendMail: async () => {}, sendAdaptiveCard: async () => ({ messageId: "m" }) },
          deliveryLogStore: new InMemoryDeliveryLogStore(),
          auditLog,
          traceIdProvider: () => "trace-master-v-d",
        },
        "trace-master-v-d",
      );
      expect(result.failed).toBe(1);
      expect(await auditLog.readAll()).toContainEqual(
        expect.objectContaining({ detail: { reportId: "STD-1", recipientId: "ST-001", code: "E-VER0D" } }),
      );
    },
  );

  it("PrjOps:REQ-019: stakeholder masterは複数ST受信者でもdelivery cycleごとに1回だけ読む", async () => {
    let providerCalls = 0;
    const mails: string[] = [];
    await deliverStandardReportToRecipients(
      report,
      {
        ...verificationProviders,
        stakeholderEmailsProvider: async (ids) => {
          providerCalls += 1;
          return new Map(ids.map((id) => [id, id === "ST-001" ? "one@example.com" : "two@example.com"]));
        },
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: {
          listForDelivery: async () => [
            recipient({ userId: "ST-001", email: "one@example.com" }),
            recipient({ userId: "ST-002", email: "two@example.com" }),
          ],
        },
        graphClient: {
          sendMail: async ({ toEmail }) => void mails.push(toEmail),
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-batch-master",
      },
      "trace-batch-master",
    );
    expect(providerCalls).toBe(1);
    expect(mails).toEqual(["one@example.com", "two@example.com"]);
  });

  it("PrjOps:REQ-019/PrjOps:SPEC-INT-051: 即時ingestはV-B/V-Dを同じmaster snapshotで検証する", async () => {
    let snapshotReads = 0;
    const mails: string[] = [];
    const result = await deliverStandardReportToRecipients(
      report,
      {
        ...verificationProviders,
        personalNamesProvider: async () => {
          throw new Error("separate personal-name scan must not run");
        },
        stakeholderEmailsProvider: async () => {
          throw new Error("separate email scan must not run");
        },
        verificationSnapshotProvider: async () => {
          snapshotReads += 1;
          return {
            personalNames: ["Other Person"],
            stakeholderEmails: new Map([["ST-001", "manager@example.com"]]),
          };
        },
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: { listForDelivery: async () => [recipient({ profile: "PRF-05", persona: "investor" })] },
        graphClient: {
          sendMail: async ({ toEmail }) => void mails.push(toEmail),
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-ingest-snapshot",
      },
      "trace-ingest-snapshot",
    );

    expect(snapshotReads).toBe(1);
    expect(mails).toEqual(["manager@example.com"]);
    expect(result).toMatchObject({ sent: 1, failed: 0 });
  });

  it("PrjOps:REQ-019/AC-019-1: 1受信者のV-B NGを隔離し他受信者を配信する", async () => {
    const auditLog = new InMemoryAuditLog();
    const mails: string[] = [];
    const result = await deliverStandardReportToRecipients(
      report,
      {
        ...verificationProviders,
        personalNamesProvider: async () => ["Alice"],
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: {
          listForDelivery: async () => [
            recipient({ userId: "ST-001", profile: "PRF-04", email: "blocked@example.com" }),
            recipient({ userId: "ST-002", profile: "PRF-02", email: "allowed@example.com" }),
          ],
        },
        graphClient: {
          sendMail: async ({ toEmail }) => void mails.push(toEmail),
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog,
        traceIdProvider: () => "trace-isolation",
      },
      "trace-isolation",
    );
    expect(mails).toEqual(["allowed@example.com"]);
    expect(result).toMatchObject({ sent: 1, failed: 1, activeRecipients: 2 });
  });

  it("PrjOps:REQ-019/AC-019-1: 個人名provider不在はPRF-04だけをfail-closeしPRF-02を配信する", async () => {
    const mails: string[] = [];
    const result = await deliverStandardReportToRecipients(
      report,
      {
        ...verificationProviders,
        personalNamesProvider: async () => {
          throw new Error("provider unavailable");
        },
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: {
          listForDelivery: async () => [
            recipient({ userId: "ST-001", profile: "PRF-04", email: "blocked@example.com" }),
            recipient({ userId: "ST-002", profile: "PRF-02", email: "allowed@example.com" }),
          ],
        },
        graphClient: {
          sendMail: async ({ toEmail }) => void mails.push(toEmail),
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-provider-isolation",
      },
      "trace-provider-isolation",
    );
    expect(mails).toEqual(["allowed@example.com"]);
    expect(result).toMatchObject({ sent: 1, failed: 1, activeRecipients: 2 });
  });

  it("PRF-Gは空projectsでもglobal audienceとして標準レポート本文を読める", () => {
    const html = renderStandardReportHtml(
      {
        ...payload,
        metrics: {
          completed: { ...payload.metrics.completed, scope: { kind: "project", projectId: "PRJ-001" } },
        },
      },
      recipient({ profile: "PRF-G", persona: "global-manager", projects: [], scopeMode: "global" }),
    );
    expect(html).toContain("Alice finished InternalPhoenix migration");
    expect(html).not.toContain("[masked]");
  });

  it("Teamsカードにdashboardディープリンクを付ける", async () => {
    const cards: unknown[] = [];
    await deliverStandardReportToRecipients(
      report,
      {
        ...verificationProviders,
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

  it("default Teams targetへは1枚だけ送り、全受信者へemailを送る", async () => {
    const mails: string[] = [];
    const cards: unknown[] = [];
    await deliverStandardReportToRecipients(
      report,
      {
        ...verificationProviders,
        stakeholderEmailsProvider: async () =>
          new Map([
            ["ST-001", "manager@example.com"],
            ["ST-002", "other@example.com"],
          ]),
        fromMailbox: "from@example.com",
        defaultTeamsTeamId: "team-1",
        defaultTeamsChannelId: "chan-1",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: {
          listForDelivery: async () => [recipient(), recipient({ userId: "ST-002", email: "other@example.com" })],
        },
        graphClient: {
          sendMail: async ({ toEmail }) => void mails.push(toEmail),
          sendAdaptiveCard: async (input) => {
            cards.push(input);
            return { messageId: "card-1" };
          },
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-default-card",
      },
      "trace-default-card",
    );

    expect(mails).toEqual(["manager@example.com", "other@example.com"]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ target: { teamId: "team-1", channelId: "chan-1" } });
  });

  it("月曜祝日なら週内の次営業日にキャッチアップ配信する", async () => {
    const mails: unknown[] = [];
    const task = createReportDeliveryTask({
      ...verificationProviders,
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

  it("PrjOps:REQ-042 AUD-OPM-009: 配信サイクル成功時だけ設定済みheartbeatへGETを1回送る", async () => {
    const requests: Array<{ input: string; method: string | undefined }> = [];
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      fetchImpl: async (input, init) => {
        requests.push({ input, method: init?.method });
        return new Response(null, { status: 200 });
      },
    });

    await task.run(new Date("2026-07-06T00:00:00.000Z"));

    expect(requests).toEqual([{ input: "https://heartbeat.example.com/report-delivery", method: "GET" }]);
  });

  it("PrjOps:REQ-042 AUD-OPM-009: 当期レポートがなければheartbeatを送らない", async () => {
    let heartbeats = 0;
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      standardReportsRepo: { listRecent: async () => [] },
      fetchImpl: async () => {
        heartbeats += 1;
        return new Response(null, { status: 200 });
      },
    });

    await task.run(new Date("2026-07-06T00:00:00.000Z"));

    expect(heartbeats).toBe(0);
  });

  it("PrjOps:REQ-042 AUD-OPM-009: 前週レポートをskipしただけならheartbeatを送らない", async () => {
    let heartbeats = 0;
    const store = new InMemoryDeliveryLogStore();
    const generatedAt = "2026-06-29T00:00:00.000Z";
    const oldReport = {
      ...report,
      reportId: "STD-OLD",
      generatedAt,
      receivedAt: generatedAt,
      payload: { ...report.payload, period: { ...report.payload.period, generatedAt } },
    };
    await store.record({
      reportId: oldReport.reportId,
      recipientId: "ST-001",
      deliveredAt: generatedAt,
      status: "sent",
    });
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      standardReportsRepo: { listRecent: async () => [oldReport] },
      deliveryLogStore: store,
      fetchImpl: async () => {
        heartbeats += 1;
        return new Response(null, { status: 200 });
      },
    });

    await task.run(new Date("2026-07-06T00:00:00.000Z"));

    expect(heartbeats).toBe(0);
  });

  it("PrjOps:REQ-042 AUD-OPM-009: 複数レポートを配信してもheartbeatはサイクルごとに1回", async () => {
    let mails = 0;
    let heartbeats = 0;
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      fetchImpl: async () => {
        heartbeats += 1;
        return new Response(null, { status: 200 });
      },
      standardReportsRepo: { listRecent: async () => [report, { ...report, reportId: "STD-2" }] },
      graphClient: {
        sendMail: async () => {
          mails += 1;
        },
        sendAdaptiveCard: async () => ({ messageId: "m" }),
      },
    });

    await task.run(new Date("2026-07-06T00:00:00.000Z"));

    expect(mails).toBe(2);
    expect(heartbeats).toBe(1);
  });

  it("PrjOps:REQ-019/PrjOps:SPEC-INT-051: 複数レポートでも関係者snapshotをサイクルごとに1回だけ読む", async () => {
    let snapshotReads = 0;
    const task = deliveryTask({
      standardReportsRepo: { listRecent: async () => [report, { ...report, reportId: "STD-2" }] },
      verificationSnapshotProvider: async () => {
        snapshotReads += 1;
        return {
          personalNames: [],
          stakeholderEmails: new Map([["ST-001", "manager@example.com"]]),
        };
      },
    });

    await task.run(new Date("2026-07-06T00:00:00.000Z"));

    expect(snapshotReads).toBe(1);
  });

  it("PrjOps:SPEC-INT-051: 未知metric keyをsanitizeしてreportごとに1回だけ警告する", async () => {
    const warnings: unknown[] = [];
    const unknownKey = "api_key=abcdefghijklmnopqrstuvwxyz123456";
    const unsafeReport = {
      ...report,
      payload: {
        ...payload,
        metrics: {
          ...payload.metrics,
          [unknownKey]: {
            value: 9,
            source: "code:unknown",
            as_of: payload.period.generatedAt,
            scope: { kind: "project", projectId: "PJ-001" },
          },
        },
      },
    } as StandardReportRecord;
    await deliverStandardReportToRecipients(
      unsafeReport,
      {
        ...verificationProviders,
        stakeholderEmailsProvider: async () =>
          new Map([
            ["ST-001", "manager@example.com"],
            ["ST-002", "allowed@example.com"],
          ]),
        fromMailbox: "from@example.com",
        publicBaseUrl: "https://aiops.example.com",
        recipientsRepo: {
          listForDelivery: async () => [recipient(), recipient({ userId: "ST-002", email: "allowed@example.com" })],
        },
        graphClient: { sendMail: async () => {}, sendAdaptiveCard: async () => ({ messageId: "m" }) },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-unknown-key",
        logger: {
          child: () => ({ info: () => {}, warn: (...args: unknown[]) => void warnings.push(args) }),
        } as unknown as NonNullable<ReportDeliveryTaskDeps["logger"]>,
      },
      "trace-unknown-key",
    );

    const serialized = JSON.stringify(warnings);
    expect(warnings).toHaveLength(1);
    expect(serialized).toContain("undefined metric display keys");
    expect(serialized).toContain("REDACTED");
    expect(serialized).not.toContain(unknownKey);
  });

  it("PrjOps:REQ-042 AUD-OPM-009: HEARTBEAT_URL未設定時は外部通信しない", async () => {
    let requests = 0;
    const task = deliveryTask({
      fetchImpl: async () => {
        requests += 1;
        return new Response(null, { status: 200 });
      },
    });

    await task.run(new Date("2026-07-06T00:00:00.000Z"));

    expect(requests).toBe(0);
  });

  it("PrjOps:REQ-042 AUD-OPM-009: 配信サイクルが例外終了した場合はheartbeatを送らない", async () => {
    let requests = 0;
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      fetchImpl: async () => {
        requests += 1;
        return new Response(null, { status: 200 });
      },
      standardReportsRepo: { listRecent: async () => Promise.reject(new Error("database unavailable")) },
    });

    await expect(task.run(new Date("2026-07-06T00:00:00.000Z"))).rejects.toThrow("database unavailable");
    expect(requests).toBe(0);
  });

  it.each(["Graph", "delivery-log"] as const)(
    "PrjOps:REQ-042 AUD-OPM-009: %s失敗サイクルはheartbeatを送らない",
    async (failure) => {
      let heartbeats = 0;
      const auditLog = new InMemoryAuditLog();
      const task = deliveryTask({
        heartbeatUrl: "https://heartbeat.example.com/report-delivery",
        fetchImpl: async () => {
          heartbeats += 1;
          return new Response(null, { status: 200 });
        },
        graphClient: {
          sendMail: async () => {
            if (failure === "Graph") throw new Error("Graph unavailable");
          },
          sendAdaptiveCard: async () => ({ messageId: "m" }),
        },
        deliveryLogStore:
          failure === "delivery-log"
            ? {
                exists: async () => false,
                record: async () => Promise.reject(new Error("delivery log unavailable")),
              }
            : new InMemoryDeliveryLogStore(),
        auditLog,
      });

      await task.run(new Date("2026-07-06T00:00:00.000Z"));

      expect(heartbeats).toBe(0);
      expect((await auditLog.readAll()).some((record) => record.action === "report_delivery_cycle_failed")).toBe(true);
      expect((await auditLog.readAll()).some((record) => record.action === "report_delivery_cycle_completed")).toBe(
        false,
      );
    },
  );

  it("PrjOps:REQ-042 AUD-OPM-009: 配信対象の構築に失敗した不完全サイクルはheartbeatを送らない", async () => {
    let heartbeats = 0;
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      defaultTeamsTeamId: "team-1",
      defaultTeamsChannelId: "channel-1",
      publicBaseUrl: "not-a-url",
      fetchImpl: async () => {
        heartbeats += 1;
        return new Response(null, { status: 200 });
      },
    });

    await task.run(new Date("2026-07-06T00:00:00.000Z"));

    expect(heartbeats).toBe(0);
  });

  it("PrjOps:REQ-042 AUD-OPM-009: heartbeatの非2xx応答はタスク失敗として扱う", async () => {
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      fetchImpl: async () => new Response(null, { status: 503 }),
    });

    await expect(task.run(new Date("2026-07-06T00:00:00.000Z"))).rejects.toThrow("heartbeat failed: HTTP 503");
  });

  it("PrjOps:REQ-042 AUD-OPM-009: heartbeat失敗後の同日再実行でも配信副作用は重複しない", async () => {
    let mails = 0;
    let cards = 0;
    let heartbeats = 0;
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      defaultTeamsTeamId: "team-1",
      defaultTeamsChannelId: "channel-1",
      fetchImpl: async () => new Response(null, { status: ++heartbeats === 1 ? 503 : 200 }),
      graphClient: {
        sendMail: async () => {
          mails += 1;
        },
        sendAdaptiveCard: async () => {
          cards += 1;
          return { messageId: "m" };
        },
      },
    });
    const now = new Date("2026-07-06T00:00:00.000Z");

    await expect(task.run(now)).rejects.toThrow("heartbeat failed: HTTP 503");
    await task.run(now);

    expect({ mails, cards, heartbeats }).toEqual({ mails: 1, cards: 1, heartbeats: 2 });
  });

  it("PrjOps:REQ-042 AUD-OPM-009: メール後のカード部分失敗はheartbeatせず再実行でメールを重複しない", async () => {
    let mails = 0;
    let cards = 0;
    let heartbeats = 0;
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      defaultTeamsTeamId: "team-1",
      defaultTeamsChannelId: "channel-1",
      fetchImpl: async () => {
        heartbeats += 1;
        return new Response(null, { status: 200 });
      },
      graphClient: {
        sendMail: async () => {
          mails += 1;
        },
        sendAdaptiveCard: async () => {
          cards += 1;
          if (cards === 1) throw new Error("card unavailable");
          return { messageId: "m" };
        },
      },
    });
    const now = new Date("2026-07-06T00:00:00.000Z");

    await task.run(now);
    expect({ mails, cards, heartbeats }).toEqual({ mails: 1, cards: 1, heartbeats: 0 });

    await task.run(now);
    expect({ mails, cards, heartbeats }).toEqual({ mails: 1, cards: 2, heartbeats: 1 });
  });

  it("PrjOps:REQ-042 AUD-OPM-009: 応答しないheartbeatは設定時間で中断する", async () => {
    const task = deliveryTask({
      heartbeatUrl: "https://heartbeat.example.com/report-delivery",
      heartbeatTimeoutMs: 1,
      fetchImpl: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }),
    });

    await expect(task.run(new Date("2026-07-06T00:00:00.000Z"))).rejects.toThrow("heartbeat request failed");
  });

  it("PrjOps:REQ-042 AUD-OPM-009: heartbeat通信例外はcredential URLを外部へ漏らさない", async () => {
    const secretUrl = "https://heartbeat-user:super-secret@heartbeat.example.com/report-delivery";
    const task = deliveryTask({
      heartbeatUrl: secretUrl,
      fetchImpl: async () => Promise.reject(new Error(`request to ${secretUrl} failed`)),
    });
    let loggedError = "";

    try {
      await task.run(new Date("2026-07-06T00:00:00.000Z"));
    } catch (error) {
      loggedError = error instanceof Error ? error.message : String(error);
    }

    expect(loggedError).toBe("heartbeat request failed");
    expect(loggedError).not.toContain("super-secret");
    expect(loggedError).not.toContain(secretUrl);
  });

  it("不正publicBaseUrlは該当受信者だけskipして監査し、他受信者を継続する", async () => {
    const auditLog = new InMemoryAuditLog();
    const mails: Array<{ toEmail: string }> = [];
    const result = await deliverStandardReportToRecipients(
      report,
      {
        ...verificationProviders,
        stakeholderEmailsProvider: async () =>
          new Map([
            ["ST-001", "bad-link@example.com"],
            ["ST-002", "ok@example.com"],
          ]),
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
    expect(result.failed).toBe(1);
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
