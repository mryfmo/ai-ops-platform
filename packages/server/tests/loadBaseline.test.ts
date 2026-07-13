/**
 * packages/server/tests/loadBaseline.test.ts
 *
 * 根拠: REQ-018 / AC-018-1 / REQ-042 / AC-042-1。
 * 外部送信・実DBなしで配信throughputとingest→dispatch latencyの単発baselineを測る。
 */
import { createHmac } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Hono } from "hono";
import { InMemoryAuditLog, type StandardReportPayload } from "@aiops/shared";
import { InMemoryDeliveryLogStore, runDistributionCycle } from "@aiops/prjops";
import { describe, expect, it } from "vitest";
import { registerReportIngestRoutes } from "../src/http/routes/reportIngest.js";
import {
  DELIVERY_CYCLE_MAX_MS,
  INGEST_TO_DISPATCH_MAX_MS,
  isWithinDeliveryCycleSla,
  isWithinIngestToDispatchSla,
} from "../src/lib/loadThresholds.js";

const recipientCount = 2_000;
const ingestSecret = "load-baseline-secret-of-at-least-32-chars";
const payload: StandardReportPayload = {
  schemaVersion: "standard-report.v1",
  reportType: "weekly-summary",
  evidenceIds: ["REQ-018", "REQ-042"],
  period: { label: "2026-W29", generatedAt: "2026-07-13T00:00:00.000Z" },
  metrics: { completed: 1 },
  slots: { conclusion: "ok", riskSummary: "low", nextActions: "ship" },
};

describe("offline load baseline [AC-018-1 AC-042-1]", () => {
  it("exercises 2,000 sequential deliveries through the Graph stub without a production SLA claim", async () => {
    let mailCalls = 0;
    const startedAt = performance.now();
    const result = await runDistributionCycle(
      Array.from({ length: recipientCount }, (_, index) => ({
        reportId: "STD-load",
        recipientId: `recipient-${index}`,
        recipientEmail: `recipient-${index}@example.com`,
        subject: "load baseline",
        html: "<p>load baseline</p>",
        postTeamsSummaryCard: false,
      })),
      {
        graphClient: {
          sendMail: async () => void (mailCalls += 1),
          sendAdaptiveCard: async () => ({ messageId: "unused" }),
        },
        deliveryLogStore: new InMemoryDeliveryLogStore(),
        auditLog: new InMemoryAuditLog(),
        traceId: "trace-load",
        fromMailbox: "sender@example.com",
      },
    );
    const elapsedMs = performance.now() - startedAt;

    expect(result).toMatchObject({ sent: expect.arrayContaining(["recipient-0", "recipient-1999"]), failed: [] });
    expect(result.sent).toHaveLength(recipientCount);
    expect(mailCalls).toBe(recipientCount);
    console.info(
      JSON.stringify({
        metric: "stub_delivery_functional_baseline",
        messages: recipientCount,
        elapsedMs: Number(elapsedMs.toFixed(3)),
        messagesPerSecond: Number((recipientCount / (elapsedMs / 1_000)).toFixed(3)),
        productionSlaClaim: false,
      }),
    );
  }, 10_000);

  it("wires an accepted ingest request to the injected dispatch callback without a production SLA claim", async () => {
    const app = new Hono();
    let dispatchedAt = 0;
    registerReportIngestRoutes(app, {
      ingestSecret,
      reportsRepo: { insert: async () => ({ reportId: "STD-load", created: true }) },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-ingest-load",
      deliverReport: async () => void (dispatchedAt = performance.now()),
    });
    const raw = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", ingestSecret).update(raw).digest("hex")}`;
    const startedAt = performance.now();
    const response = await app.request("/reports/ingest", {
      method: "POST",
      headers: { "x-aiops-signature-256": signature },
      body: raw,
    });

    expect(response.status).toBe(201);
    expect(dispatchedAt).toBeGreaterThanOrEqual(startedAt);
    console.info(
      JSON.stringify({
        metric: "ingest_to_dispatch_functional_baseline",
        elapsedMs: Number((dispatchedAt - startedAt).toFixed(3)),
        productionSlaClaim: false,
      }),
    );
  });

  it("pins the SLA constants to the specification [AC-018-1 AC-042-1]", () => {
    expect(DELIVERY_CYCLE_MAX_MS).toBe(7_200_000);
    expect(INGEST_TO_DISPATCH_MAX_MS).toBe(300_000);
  });

  it.each([
    ["delivery exact", isWithinDeliveryCycleSla, 7_200_000, true],
    ["delivery plus one", isWithinDeliveryCycleSla, 7_200_001, false],
    ["ingest exact", isWithinIngestToDispatchSla, 300_000, true],
    ["ingest plus one", isWithinIngestToDispatchSla, 300_001, false],
  ])("applies the deterministic SLA boundary: %s [AC-018-1 AC-042-1]", (_name, predicate, elapsedMs, expected) => {
    expect(predicate(elapsedMs)).toBe(expected);
  });
});
