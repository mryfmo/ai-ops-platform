import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { InMemoryAuditLog, buildXlsxImportTemplateBuffer, type XlsxImportGithubClient } from "@aiops/shared";
import { buildApp, type AppDependencies } from "../src/http/app.js";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";
import type { PgQueryable } from "@aiops/shared";
import { ImportLedgerRepo } from "../src/db/importLedgerRepo.js";

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

function deps(
  options: { importSecret?: string; allowedRepos?: string[]; failsafe?: boolean } = {
    importSecret: XLSX_IMPORT_SECRET,
    allowedRepos: ["acme/widget"],
  },
): AppDependencies {
  const auditLog = new InMemoryAuditLog();
  const mockDb: PgQueryable = { query: async () => ({ rows: [] }) };
  return {
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
    const res = await app.request("/xlsx-import/template");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
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
    expect(await res.json()).toMatchObject({ ok: true, rowCount: 3 });
    expect(d.xlsxImport.githubClient.createIssue).not.toHaveBeenCalled();
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
    const app = buildApp(deps());
    const body = await buildXlsxImportTemplateBuffer();
    const res = await app.request("/xlsx-import/execute?owner=acme&repo=widget", {
      method: "POST",
      headers: signedHeaders(body),
      body,
    });
    expect(res.status).toBe(409);
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
    expect((await d.auditLog.readAll()).some((record) => record.action === "xlsx_import_repo_rejected")).toBe(true);
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
    expect(d.xlsxImport.githubClient.createIssue).toHaveBeenCalled();
    expect((await d.auditLog.readAll()).some((record) => record.action === "xlsx_import_executed")).toBe(true);
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
    expect((await d.auditLog.readAll()).some((record) => record.action === "xlsx_import_blocked_by_failsafe")).toBe(
      true,
    );
  });
});
