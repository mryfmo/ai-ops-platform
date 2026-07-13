import { describe, it, expect, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import ExcelJS from "exceljs";
import {
  InMemoryAuditLog,
  buildXlsxImportTemplateBuffer,
  XLSX_IMPORT_METADATA_SHEET,
  type XlsxImportGithubClient,
} from "@aiops/shared";
import { buildApp, type AppDependencies } from "../src/http/app.js";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";
import type { PgQueryable } from "@aiops/shared";
import { ImportLedgerRepo } from "../src/db/importLedgerRepo.js";
import { XLSX_IMPORT_MAX_BYTES } from "../src/http/routes/xlsxImport.js";

const XLSX_IMPORT_SECRET = "xlsx-import-secret-32-bytes-minimum";

function signedHeaders(body: Buffer, extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...extra,
    "x-aiops-signature-256": "sha256=" + createHmac("sha256", XLSX_IMPORT_SECRET).update(body).digest("hex"),
  };
}

function githubStub(): XlsxImportGithubClient {
  return {
    createIssue: vi.fn(async () => ({ number: 1, htmlUrl: "https://example.invalid/issues/1", nodeId: "I_1" })),
    createMilestone: vi.fn(async () => ({ number: 2, htmlUrl: "https://example.invalid/milestones/2", nodeId: "M_2" })),
    addProjectV2ItemById: vi.fn(async () => ({ itemNodeId: "PVTI_1" })),
    updateProjectV2ItemFieldValue: vi.fn(async () => {}),
    getGraphqlRateLimit: vi.fn(async () => ({ remaining: 100, resetAt: "2026-07-09T00:00:00Z" })),
  };
}

async function editedTemplate(edit: (workbook: ExcelJS.Workbook) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildXlsxImportTemplateBuffer());
  edit(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

type TestDependencies = AppDependencies & { dbQuery: ReturnType<typeof vi.fn> };

function deps(
  options: { importSecret?: string; allowedRepos?: string[]; failsafe?: boolean } = {
    importSecret: XLSX_IMPORT_SECRET,
    allowedRepos: ["acme/widget"],
  },
): TestDependencies {
  const auditLog = new InMemoryAuditLog();
  const dbQuery = vi.fn(async () => ({ rows: [] }));
  const mockDb: PgQueryable = { query: dbQuery };
  return {
    dbQuery,
    auditLog,
    readiness: { isReady: async () => true },
    graph: {
      clientState: "expected-client-state-16chars",
      auditLog,
      enqueueInboundEvent: async () => {},
      traceIdProvider: () => "trace-graph",
    },
    github: {
      webhookSecret: "secret",
      auditLog,
      enqueueGithubEvent: async () => {},
      traceIdProvider: () => "trace-gh",
    },
    codingTasks: {
      codingTasksRepo: new CodingTasksRepo(mockDb),
      githubClient: { dispatchWorkflow: async () => {} },
      auditLog,
      confirmTokenSecret: "confirm-secret",
      callbackSecret: "callback-secret",
      resolveRepoForProject: async () => null,
      traceIdProvider: () => "trace-code",
    },
    xlsxImport: {
      ledger: new ImportLedgerRepo(mockDb),
      githubClient: githubStub(),
      auditLog,
      traceIdProvider: () => "00000000-0000-4000-8000-000000000008",
      importSecret: options.importSecret,
      allowedRepos: options.allowedRepos,
      isFailsafeActive: () => options.failsafe ?? false,
    },
  };
}

describe("xlsx import routes [REQ-037, SPEC-INT-063, AC-037-1]", () => {
  it("GET /xlsx-import/template はxlsxを返す", async () => {
    const app = buildApp(deps());
    const res = await app.request("/xlsx-import/template", { headers: signedHeaders(Buffer.alloc(0)) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
  });

  it("GET /xlsx-import/template は未署名アクセスを401で拒否する", async () => {
    const app = buildApp(deps());
    expect((await app.request("/xlsx-import/template")).status).toBe(401);
  });

  it("dry-runは検証結果を返し、GitHubへ書き込まない", async () => {
    const d = deps();
    const app = buildApp(d);
    const body = await buildXlsxImportTemplateBuffer();
    const res = await app.request("/xlsx-import/dry-run", {
      method: "POST",
      headers: signedHeaders(body),
      body,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      rowCount: 3,
      summary: "Dry-run accepted: 3 row(s); no validation errors.",
    });
    expect(d.xlsxImport.githubClient.createIssue).not.toHaveBeenCalled();
    expect(
      (await d.auditLog.readAll()).find((record) => record.action === "xlsx_import_file_submitted")?.detail,
    ).toEqual({
      operation: "dry-run",
      sha256: createHash("sha256").update(body).digest("hex"),
    });
    expect((await d.auditLog.readAll()).map((record) => record.action)).toEqual(["xlsx_import_file_submitted"]);
  });

  it("dry-runは署名済みでもテンプレート版セル欠落をE-XLS-001で全件拒否し副作用を起こさない", async () => {
    const d = deps();
    const app = buildApp(d);
    const body = await editedTemplate((workbook) => {
      workbook.removeWorksheet(workbook.getWorksheet(XLSX_IMPORT_METADATA_SHEET)!.id);
    });
    const res = await app.request("/xlsx-import/dry-run", {
      method: "POST",
      headers: signedHeaders(body),
      body,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false, rowCount: 0, errors: [{ code: "E-XLS-001" }] });
    expect((await d.auditLog.readAll()).map((record) => record.action)).toEqual(["xlsx_import_file_submitted"]);
    expect((await d.auditLog.readAll())[0]?.detail).toEqual({
      operation: "dry-run",
      sha256: createHash("sha256").update(body).digest("hex"),
    });
    expect(d.dbQuery).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.createIssue).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.createMilestone).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.addProjectV2ItemById).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.updateProjectV2ItemFieldValue).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.getGraphqlRateLimit).not.toHaveBeenCalled();
  });

  it("executeは署名済みでもテンプレート版不一致を確認・台帳・GitHubより先にE-XLS-001で拒否する", async () => {
    const d = deps({
      importSecret: XLSX_IMPORT_SECRET,
      allowedRepos: ["acme/widget"],
      failsafe: true,
    });
    const app = buildApp(d);
    const body = await editedTemplate((workbook) => {
      workbook.getWorksheet(XLSX_IMPORT_METADATA_SHEET)!.getCell("B1").value = "0";
    });
    const res = await app.request("/xlsx-import/execute?owner=acme&repo=widget", {
      method: "POST",
      headers: signedHeaders(body),
      body,
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, rowCount: 0, errors: [{ code: "E-XLS-001" }] });
    expect((await d.auditLog.readAll()).map((record) => record.action)).toEqual(["xlsx_import_file_submitted"]);
    expect((await d.auditLog.readAll())[0]?.detail).toEqual({
      operation: "execute",
      sha256: createHash("sha256").update(body).digest("hex"),
    });
    expect(d.dbQuery).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.createIssue).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.createMilestone).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.addProjectV2ItemById).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.updateProjectV2ItemFieldValue).not.toHaveBeenCalled();
    expect(d.xlsxImport.githubClient.getGraphqlRateLimit).not.toHaveBeenCalled();
  });

  it("Content-Lengthが上限超過ならbody読取・認証・監査より先に413を返す", async () => {
    const d = deps();
    const app = buildApp(d);
    const res = await app.request("/xlsx-import/dry-run", {
      method: "POST",
      headers: { "content-length": String(XLSX_IMPORT_MAX_BYTES + 1) },
      body: "x",
    });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "payload too large", maxBytes: XLSX_IMPORT_MAX_BYTES });
    expect(await d.auditLog.readAll()).toEqual([]);
  });

  it("Content-Lengthなしのchunked bodyもストリーム読取中に上限超過を413で拒否する", async () => {
    const d = deps();
    const app = buildApp(d);
    const chunk = new Uint8Array(Math.floor(XLSX_IMPORT_MAX_BYTES / 2) + 1);
    const request = new Request("http://localhost/xlsx-import/dry-run", {
      method: "POST",
      headers: { "transfer-encoding": "chunked" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const res = await app.request(request);

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "payload too large", maxBytes: XLSX_IMPORT_MAX_BYTES });
    expect(await d.auditLog.readAll()).toEqual([]);
  });

  it("dry-runは署名なしを401で拒否する", async () => {
    const app = buildApp(deps());
    const res = await app.request("/xlsx-import/dry-run", {
      method: "POST",
      body: await buildXlsxImportTemplateBuffer(),
    });
    expect(res.status).toBe(401);
  });

  it("dry-runは不正署名を401で拒否する", async () => {
    const body = await buildXlsxImportTemplateBuffer();
    const app = buildApp(deps());
    const res = await app.request("/xlsx-import/dry-run", {
      method: "POST",
      headers: { "x-aiops-signature-256": "sha256=deadbeef" },
      body,
    });
    expect(res.status).toBe(401);
  });

  it("dry-runは署名済みの壊れたxlsxもSHA-256を監査する", async () => {
    const d = deps();
    const app = buildApp(d);
    const body = Buffer.from("not-an-xlsx");
    const res = await app.request("/xlsx-import/dry-run", {
      method: "POST",
      headers: signedHeaders(body),
      body,
    });

    expect(res.status).toBe(500);
    expect((await d.auditLog.readAll())[0]?.detail).toEqual({
      operation: "dry-run",
      sha256: createHash("sha256").update(body).digest("hex"),
    });
  });

  it("dry-runはシークレット未設定時に503と監査ログを返す", async () => {
    const d = deps({ importSecret: undefined, allowedRepos: ["acme/widget"] });
    const app = buildApp(d);
    const res = await app.request("/xlsx-import/dry-run", {
      method: "POST",
      body: await buildXlsxImportTemplateBuffer(),
    });
    expect(res.status).toBe(503);
    expect((await d.auditLog.readAll()).some((record) => record.action === "xlsx_import_disabled")).toBe(true);
  });

  it("executeは確認ヘッダ必須", async () => {
    const d = deps();
    const app = buildApp(d);
    const body = await buildXlsxImportTemplateBuffer();
    const res = await app.request("/xlsx-import/execute?owner=acme&repo=widget", {
      method: "POST",
      headers: signedHeaders(body),
      body,
    });
    expect(res.status).toBe(409);
    expect((await d.auditLog.readAll())[0]?.detail).toEqual({
      operation: "execute",
      sha256: createHash("sha256").update(body).digest("hex"),
    });
  });

  it("executeはallowlist外リポジトリを403で拒否して監査ログを残す", async () => {
    const d = deps();
    const app = buildApp(d);
    const body = await buildXlsxImportTemplateBuffer();
    const res = await app.request("/xlsx-import/execute?owner=evil&repo=repo", {
      method: "POST",
      headers: signedHeaders(body, { "x-confirm-import": "yes" }),
      body,
    });
    expect(res.status).toBe(403);
    expect(d.xlsxImport.githubClient.createIssue).not.toHaveBeenCalled();
    expect((await d.auditLog.readAll()).map((record) => record.action)).toEqual([
      "xlsx_import_file_submitted",
      "xlsx_import_repo_rejected",
    ]);
    expect((await d.auditLog.readAll())[0]?.detail).toEqual({
      operation: "execute",
      sha256: createHash("sha256").update(body).digest("hex"),
    });
  });

  it("executeは確認後にGitHubモックへ書き込み、監査ログを追記する", async () => {
    const d = deps();
    const app = buildApp(d);
    const body = await buildXlsxImportTemplateBuffer();
    const res = await app.request("/xlsx-import/execute?owner=acme&repo=widget", {
      method: "POST",
      headers: signedHeaders(body, { "x-confirm-import": "yes" }),
      body,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: { imported: number } };
    expect(json.result.imported).toBe(3);
    expect(json).toMatchObject({
      result: { summary: "Execute completed: imported=3, skipped=0, failed=0." },
    });
    expect(d.xlsxImport.githubClient.createIssue).toHaveBeenCalled();
    expect((await d.auditLog.readAll()).some((record) => record.action === "xlsx_import_executed")).toBe(true);
    expect(
      (await d.auditLog.readAll()).find((record) => record.action === "xlsx_import_file_submitted")?.detail,
    ).toEqual({
      operation: "execute",
      sha256: createHash("sha256").update(body).digest("hex"),
    });
    expect((await d.auditLog.readAll()).map((record) => record.action)).toEqual([
      "xlsx_import_file_submitted",
      "xlsx_import_executed",
    ]);
  });

  it("executeはフェイルセーフ中にGitHub書き込みを呼ばず503と監査ログを返す", async () => {
    const d = deps({ importSecret: XLSX_IMPORT_SECRET, allowedRepos: ["acme/widget"], failsafe: true });
    const app = buildApp(d);
    const body = await buildXlsxImportTemplateBuffer();
    const res = await app.request("/xlsx-import/execute?owner=acme&repo=widget", {
      method: "POST",
      headers: signedHeaders(body, { "x-confirm-import": "yes" }),
      body,
    });
    expect(res.status).toBe(503);
    expect(d.xlsxImport.githubClient.createIssue).not.toHaveBeenCalled();
    expect((await d.auditLog.readAll()).map((record) => record.action)).toEqual([
      "xlsx_import_file_submitted",
      "xlsx_import_blocked_by_failsafe",
    ]);
    expect((await d.auditLog.readAll())[0]?.detail).toEqual({
      operation: "execute",
      sha256: createHash("sha256").update(body).digest("hex"),
    });
  });
});
