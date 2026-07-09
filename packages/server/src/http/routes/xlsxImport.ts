/**
 * packages/server/src/http/routes/xlsxImport.ts
 *
 * 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。
 * .xlsxアップロードをdry-run検証し、確認ヘッダ付きのexecuteでGitHub書き込みを行う。
 */
import type { Hono } from "hono";
import {
  buildXlsxImportTemplateBuffer,
  executeXlsxImport,
  parseXlsxImport,
  type AuditLogWriter,
  type ImportLedger,
  type XlsxImportGithubClient,
} from "@aiops/shared";

export interface XlsxImportRoutesDeps {
  ledger: ImportLedger;
  githubClient: XlsxImportGithubClient;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
}

function requiredQuery(c: { req: { query(name: string): string | undefined } }, name: string): string {
  const value = c.req.query(name);
  if (!value) throw new Error(`missing query: ${name}`);
  return value;
}

export function registerXlsxImportRoutes(app: Hono, deps: XlsxImportRoutesDeps): void {
  app.get("/xlsx-import/template", async () => {
    const buffer = await buildXlsxImportTemplateBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="aiops-import-template.xlsx"',
      },
    });
  });

  app.post("/xlsx-import/dry-run", async (c) => {
    const buffer = Buffer.from(await c.req.arrayBuffer());
    const parsed = await parseXlsxImport(buffer);
    return c.json({ ok: parsed.errors.length === 0, rowCount: parsed.rows.length, errors: parsed.errors }, 200);
  });

  app.post("/xlsx-import/execute", async (c) => {
    if (c.req.header("x-confirm-import") !== "yes") return c.json({ error: "confirmation required" }, 409);
    let owner: string;
    let repo: string;
    try {
      owner = requiredQuery(c, "owner");
      repo = requiredQuery(c, "repo");
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "missing query" }, 400);
    }

    const buffer = Buffer.from(await c.req.arrayBuffer());
    const parsed = await parseXlsxImport(buffer);
    if (parsed.errors.length > 0) {
      return c.json({ ok: false, rowCount: 0, errors: parsed.errors }, 400);
    }

    const importRunId = deps.traceIdProvider();
    const result = await executeXlsxImport({
      owner,
      repo,
      importRunId,
      rows: parsed.rows,
      ledger: deps.ledger,
      github: deps.githubClient,
    });
    await deps.auditLog.append({
      trace_id: importRunId,
      actor: "SERVER",
      action: "xlsx_import_executed",
      basis: "REQ-037/SPEC-INT-063",
      detail: { importRunId, imported: result.imported, skipped: result.skipped, failed: result.failed },
      at: new Date().toISOString(),
    });
    return c.json({ ok: result.failed === 0, result }, 200);
  });
}
