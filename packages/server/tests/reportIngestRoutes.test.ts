import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { InMemoryAuditLog, type StandardReportPayload } from "@aiops/shared";
import { registerReportIngestRoutes } from "../src/http/routes/reportIngest.js";
import { standardReportId } from "../src/db/standardReportsRepo.js";

const secret = "report-ingest-secret-of-at-least-32-chars";
const payload: StandardReportPayload = {
  schemaVersion: "standard-report.v2",
  reportType: "weekly-summary",
  evidenceIds: ["REQ-042"],
  period: { label: "2026-W28", generatedAt: "2026-07-06T00:00:00.000Z" },
  metrics: {
    completed: { value: 1, source: "test:completed", as_of: "2026-07-06T00:00:00.000Z" },
  },
  slots: { conclusion: "ok", riskSummary: "low", nextActions: "ship" },
};

function sign(raw: string): string {
  return "sha256=" + createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

function makeApp(opts: { failsafe?: boolean } = {}) {
  const app = new Hono();
  const auditLog = new InMemoryAuditLog();
  const inserts: StandardReportPayload[] = [];
  const delivered: string[] = [];
  const seenReportIds = new Set<string>();
  registerReportIngestRoutes(app, {
    ingestSecret: secret,
    reportsRepo: {
      insert: async (p) => {
        inserts.push(p);
        const reportId = standardReportId(p);
        const created = !seenReportIds.has(reportId);
        seenReportIds.add(reportId);
        return { reportId, created };
      },
    },
    auditLog,
    traceIdProvider: () => "trace-1",
    isFailsafeActive: () => opts.failsafe ?? false,
    deliverReport: async (report) => {
      delivered.push(report.reportId);
    },
  });
  return { app, auditLog, inserts, delivered };
}

describe("POST /reports/ingest [REQ-042 SPEC-INT-069 SPEC-INT-083 AC-042-1]", () => {
  it("HMAC不正は401", async () => {
    const { app, inserts } = makeApp();
    const res = await app.request("/reports/ingest", {
      method: "POST",
      headers: { "x-aiops-signature-256": "sha256=deadbeef" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(401);
    expect(inserts).toHaveLength(0);
  });

  it("schema不適合は422", async () => {
    const { app } = makeApp();
    const raw = JSON.stringify({ schemaVersion: "bad" });
    const res = await app.request("/reports/ingest", {
      method: "POST",
      headers: { "x-aiops-signature-256": sign(raw) },
      body: raw,
    });
    expect(res.status).toBe(422);
  });

  it("legacy v1 numeric metricsは422で保存しない", async () => {
    const { app, inserts } = makeApp();
    const legacy = { ...payload, schemaVersion: "standard-report.v1", metrics: { completed: 1 } };
    const raw = JSON.stringify(legacy);
    const res = await app.request("/reports/ingest", {
      method: "POST",
      headers: { "x-aiops-signature-256": sign(raw) },
      body: raw,
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ details: expect.arrayContaining([expect.stringMatching(/legacy/i)]) });
    expect(inserts).toHaveLength(0);
  });

  it("正常系は保存して配信パイプラインへ渡す", async () => {
    const { app, inserts, delivered } = makeApp();
    const raw = JSON.stringify(payload);
    const res = await app.request("/reports/ingest", {
      method: "POST",
      headers: { "x-aiops-signature-256": sign(raw) },
      body: raw,
    });
    expect(res.status).toBe(201);
    expect(inserts).toHaveLength(1);
    expect(delivered).toEqual([standardReportId(payload)]);
  });

  it("フェイルセーフ中は新規作成しても配信パイプラインを呼ばない", async () => {
    const { app, inserts, delivered, auditLog } = makeApp({ failsafe: true });
    const raw = JSON.stringify(payload);
    const res = await app.request("/reports/ingest", {
      method: "POST",
      headers: { "x-aiops-signature-256": sign(raw) },
      body: raw,
    });
    expect(res.status).toBe(201);
    expect(inserts).toHaveLength(1);
    expect(delivered).toEqual([]);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "report_delivery_blocked_by_failsafe" && l.basis === "REQ-029")).toBe(true);
  });

  it("generatedAtだけが違う再生成は冪等にduplicateとして受け、配信を再試行する", async () => {
    const { app, delivered } = makeApp();
    const raw = JSON.stringify(payload);
    const regenerated = JSON.stringify({
      ...payload,
      period: { ...payload.period, generatedAt: "2026-07-06T12:34:56.000Z" },
    });
    await app.request("/reports/ingest", {
      method: "POST",
      headers: { "x-aiops-signature-256": sign(raw) },
      body: raw,
    });
    const res = await app.request("/reports/ingest", {
      method: "POST",
      headers: { "x-aiops-signature-256": sign(regenerated) },
      body: regenerated,
    });
    expect(res.status).toBe(200);
    expect(delivered).toEqual([standardReportId(payload), standardReportId(payload)]);
  });
});
