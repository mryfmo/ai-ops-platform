import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { InMemoryAuditLog, type StandardReportPayload } from "@aiops/shared";
import { registerReportIngestRoutes } from "../src/http/routes/reportIngest.js";

const secret = "report-ingest-secret-of-at-least-32-chars";
const payload: StandardReportPayload = {
  schemaVersion: "standard-report.v1",
  reportType: "weekly-summary",
  evidenceIds: ["REQ-042"],
  period: { label: "2026-W28", generatedAt: "2026-07-06T00:00:00.000Z" },
  metrics: { completed: 1 },
  slots: { conclusion: "ok", riskSummary: "low", nextActions: "ship" },
};

function sign(raw: string): string {
  return "sha256=" + createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

function makeApp() {
  const app = new Hono();
  const auditLog = new InMemoryAuditLog();
  const inserts: StandardReportPayload[] = [];
  const delivered: string[] = [];
  registerReportIngestRoutes(app, {
    ingestSecret: secret,
    reportsRepo: {
      insert: async (p) => {
        inserts.push(p);
        return { reportId: "STD-1", created: inserts.length === 1 };
      },
    },
    auditLog,
    traceIdProvider: () => "trace-1",
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
    expect(delivered).toEqual(["STD-1"]);
  });

  it("再送は冪等にduplicateとして受け、配信しない", async () => {
    const { app, delivered } = makeApp();
    const raw = JSON.stringify(payload);
    const headers = { "x-aiops-signature-256": sign(raw) };
    await app.request("/reports/ingest", { method: "POST", headers, body: raw });
    const res = await app.request("/reports/ingest", { method: "POST", headers, body: raw });
    expect(res.status).toBe(200);
    expect(delivered).toEqual(["STD-1"]);
  });
});
