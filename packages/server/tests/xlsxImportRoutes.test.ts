import { describe, it, expect, vi } from "vitest";
import { InMemoryAuditLog, buildXlsxImportTemplateBuffer, type XlsxImportGithubClient } from "@aiops/shared";
import { buildApp, type AppDependencies } from "../src/http/app.js";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";
import type { PgQueryable } from "@aiops/shared";
import { ImportLedgerRepo } from "../src/db/importLedgerRepo.js";

function githubStub(): XlsxImportGithubClient {
  return {
    createIssue: vi.fn(async () => ({ number: 1, htmlUrl: "https://example.invalid/issues/1", nodeId: "I_1" })),
    createMilestone: vi.fn(async () => ({ number: 2, htmlUrl: "https://example.invalid/milestones/2", nodeId: "M_2" })),
    addProjectV2ItemById: vi.fn(async () => ({ itemNodeId: "PVTI_1" })),
    updateProjectV2ItemFieldValue: vi.fn(async () => {}),
    getGraphqlRateLimit: vi.fn(async () => ({ remaining: 100, resetAt: "2026-07-09T00:00:00Z" })),
  };
}

function deps(): AppDependencies {
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
    const res = await app.request("/xlsx-import/dry-run", {
      method: "POST",
      body: await buildXlsxImportTemplateBuffer(),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, rowCount: 3 });
    expect(d.xlsxImport.githubClient.createIssue).not.toHaveBeenCalled();
  });

  it("executeは確認ヘッダ必須", async () => {
    const app = buildApp(deps());
    const res = await app.request("/xlsx-import/execute?owner=acme&repo=widget", {
      method: "POST",
      body: await buildXlsxImportTemplateBuffer(),
    });
    expect(res.status).toBe(409);
  });

  it("executeは確認後にGitHubモックへ書き込み、監査ログを追記する", async () => {
    const d = deps();
    const app = buildApp(d);
    const res = await app.request("/xlsx-import/execute?owner=acme&repo=widget", {
      method: "POST",
      headers: { "x-confirm-import": "yes" },
      body: await buildXlsxImportTemplateBuffer(),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: { imported: number } };
    expect(json.result.imported).toBe(3);
    expect(d.xlsxImport.githubClient.createIssue).toHaveBeenCalled();
    expect((await d.auditLog.readAll()).some((record) => record.action === "xlsx_import_executed")).toBe(true);
  });
});
