/**
 * packages/server/src/http/routes/reportIngest.ts
 *
 * 根拠: ADR-0014 / REQ-042 / SPEC-INT-069 / DevOps SPEC-INT-083 / AC-042-1。
 * GitHub Actions report-generation.yml が生成した標準report.jsonをHMAC検証後に受け付ける。
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import { validateStandardReportPayload, type AuditLogWriter, type StandardReportPayload } from "@aiops/shared";

export interface ReportIngestDeps {
  ingestSecret?: string;
  reportsRepo: {
    insert(payload: StandardReportPayload, traceId: string): Promise<{ reportId: string; created: boolean }>;
  };
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  deliverReport?(
    report: { reportId: string; payload: StandardReportPayload; periodLabel: string },
    traceId: string,
  ): Promise<void>;
}

function verifyReportSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const actualHex = signature.slice("sha256=".length);
  try {
    const actual = Buffer.from(actualHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function registerReportIngestRoutes(app: Hono, deps?: ReportIngestDeps): void {
  app.post("/reports/ingest", async (c) => {
    const rawBody = await c.req.text();
    const traceId = deps?.traceIdProvider() ?? "trace-disabled";
    if (!deps?.ingestSecret) {
      await deps?.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "report_ingest_disabled",
        basis: "ADR-0014",
        detail: { reason: "REPORT_INGEST_SECRET is not configured" },
        at: new Date().toISOString(),
      });
      return c.json({ error: "report ingest disabled" }, 503);
    }

    const signature = c.req.header("x-aiops-signature-256") ?? c.req.header("x-hub-signature-256") ?? null;
    if (!verifyReportSignature(rawBody, signature, deps.ingestSecret)) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "report_ingest_rejected",
        basis: "SPEC-INT-069",
        detail: { reason: "signature verification failed" },
        at: new Date().toISOString(),
      });
      return c.json({ error: "invalid signature" }, 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }

    const validation = validateStandardReportPayload(payload);
    if (!validation.ok) {
      return c.json({ error: "invalid report", details: validation.errors }, 422);
    }

    const reportPayload = payload as StandardReportPayload;
    const inserted = await deps.reportsRepo.insert(reportPayload, traceId);
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: inserted.created ? "report_ingested" : "report_ingest_duplicate",
      basis: "REQ-042 SPEC-INT-069",
      detail: { reportId: inserted.reportId, reportType: reportPayload.reportType },
      at: new Date().toISOString(),
    });

    if (inserted.created) {
      await deps.deliverReport?.(
        { reportId: inserted.reportId, payload: reportPayload, periodLabel: reportPayload.period.label },
        traceId,
      );
    }
    return c.json({ reportId: inserted.reportId, created: inserted.created }, inserted.created ? 201 : 200);
  });
}
