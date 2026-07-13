/**
 * packages/server/src/http/routes/xlsxImport.ts
 *
 * 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。
 * .xlsxアップロードをdry-run検証し、確認ヘッダ付きのexecuteでGitHub書き込みを行う。
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  buildXlsxImportTemplateBuffer,
  executeXlsxImport,
  parseXlsxImport,
  type AuditLogWriter,
  type ImportLedger,
  type XlsxImportGithubClient,
} from "@aiops/shared";

export const XLSX_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export interface XlsxImportRoutesDeps {
  ledger: ImportLedger;
  githubClient: XlsxImportGithubClient;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  importSecret?: string;
  allowedRepos?: string[];
  isFailsafeActive?: () => boolean;
}

function requiredQuery(c: { req: { query(name: string): string | undefined } }, name: string): string {
  const value = c.req.query(name);
  if (!value) throw new Error(`missing query: ${name}`);
  return value;
}

function verifyXlsxImportSignature(rawBody: Buffer, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actualHex = signature.slice("sha256=".length);
  try {
    const actual = Buffer.from(actualHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function readAuthenticatedBody(
  c: Context,
  deps: XlsxImportRoutesDeps,
): Promise<{ ok: true; buffer: Buffer; traceId: string } | { ok: false; response: Response }> {
  const buffer = Buffer.from(await c.req.arrayBuffer());
  const traceId = deps.traceIdProvider();
  if (!deps.importSecret) {
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "xlsx_import_disabled",
      basis: "REQ-037/SPEC-INT-063",
      detail: { reason: "XLSX_IMPORT_SECRET is not configured" },
      at: new Date().toISOString(),
    });
    return { ok: false, response: c.json({ error: "xlsx import disabled" }, 503) };
  }
  const signature = c.req.header("x-aiops-signature-256") ?? c.req.header("x-hub-signature-256") ?? null;
  if (!verifyXlsxImportSignature(buffer, signature, deps.importSecret)) {
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "xlsx_import_rejected",
      basis: "REQ-037/SPEC-INT-063",
      detail: { reason: "signature verification failed" },
      at: new Date().toISOString(),
    });
    return { ok: false, response: c.json({ error: "invalid signature" }, 401) };
  }
  return { ok: true, buffer, traceId };
}

async function auditSubmittedFile(
  deps: XlsxImportRoutesDeps,
  traceId: string,
  operation: "dry-run" | "execute",
  buffer: Buffer,
): Promise<void> {
  await deps.auditLog.append({
    trace_id: traceId,
    actor: "SERVER",
    action: "xlsx_import_file_submitted",
    basis: "REQ-037/SPEC-INT-063/AUD-OPM-011",
    detail: { operation, sha256: createHash("sha256").update(buffer).digest("hex") },
    at: new Date().toISOString(),
  });
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

  const xlsxBodyLimit = bodyLimit({
    maxSize: XLSX_IMPORT_MAX_BYTES,
    onError: (c) => c.json({ error: "payload too large", maxBytes: XLSX_IMPORT_MAX_BYTES }, 413),
  });

  app.post("/xlsx-import/dry-run", xlsxBodyLimit, async (c) => {
    const body = await readAuthenticatedBody(c, deps);
    if (!body.ok) return body.response;
    const parsed = await parseXlsxImport(body.buffer);
    if (parsed.errors.length === 0) await auditSubmittedFile(deps, body.traceId, "dry-run", body.buffer);
    return c.json(
      { ok: parsed.errors.length === 0, rowCount: parsed.rows.length, errors: parsed.errors, summary: parsed.summary },
      200,
    );
  });

  app.post("/xlsx-import/execute", xlsxBodyLimit, async (c) => {
    const body = await readAuthenticatedBody(c, deps);
    if (!body.ok) return body.response;
    const parsed = await parseXlsxImport(body.buffer);
    if (parsed.errors.length > 0) {
      return c.json({ ok: false, rowCount: 0, errors: parsed.errors, summary: parsed.summary }, 400);
    }
    if (c.req.header("x-confirm-import") !== "yes") return c.json({ error: "confirmation required" }, 409);
    let owner: string;
    let repo: string;
    try {
      owner = requiredQuery(c, "owner");
      repo = requiredQuery(c, "repo");
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "missing query" }, 400);
    }
    const fullRepo = `${owner}/${repo}`;
    if (!deps.allowedRepos?.includes(fullRepo)) {
      const traceId = deps.traceIdProvider();
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "xlsx_import_repo_rejected",
        basis: "REQ-037/SPEC-INT-063",
        detail: { owner, repo, reason: "repository is not in XLSX_IMPORT_ALLOWED_REPOS" },
        at: new Date().toISOString(),
      });
      return c.json({ error: "repository not allowed" }, 403);
    }
    if (deps.isFailsafeActive?.()) {
      const traceId = deps.traceIdProvider();
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "xlsx_import_blocked_by_failsafe",
        basis: "REQ-029",
        detail: { owner, repo },
        at: new Date().toISOString(),
      });
      return c.json({ error: "failsafe active" }, 503);
    }

    await auditSubmittedFile(deps, body.traceId, "execute", body.buffer);
    const importRunId = body.traceId;
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
