import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import {
  appendImportMarker,
  buildXlsxImportTemplateBuffer,
  executeXlsxImport,
  parseXlsxImport,
  type ImportLedger,
  type ImportLedgerEntry,
  type XlsxImportGithubClient,
} from "../src/index.js";

async function workbookBuffer(setup: (workbook: ExcelJS.Workbook) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const name of ["issues", "project_items", "milestones"]) workbook.addWorksheet(name);
  setup(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function addHeaders(sheet: ExcelJS.Worksheet, headers: string[]): void {
  sheet.addRow(headers);
}

class MemoryLedger implements ImportLedger {
  entries = new Map<string, ImportLedgerEntry>();

  async findBySourceKey(sourceKey: string): Promise<ImportLedgerEntry | null> {
    return this.entries.get(sourceKey) ?? null;
  }

  async insert(entry: ImportLedgerEntry): Promise<void> {
    this.entries.set(entry.sourceKey, entry);
  }
}

function githubStub(): XlsxImportGithubClient {
  return {
    createIssue: vi.fn(async () => ({ number: 1, htmlUrl: "https://example.invalid/issues/1", nodeId: "I_1" })),
    createMilestone: vi.fn(async () => ({ number: 2, htmlUrl: "https://example.invalid/milestones/2", nodeId: "M_2" })),
    addProjectV2ItemById: vi.fn(async () => ({ itemNodeId: "PVTI_1" })),
    updateProjectV2ItemFieldValue: vi.fn(async () => {}),
    getGraphqlRateLimit: vi.fn(async () => ({ remaining: 1000, resetAt: "2026-07-09T00:00:00Z" })),
  };
}

describe("xlsx import parser [REQ-037, SPEC-INT-063, AC-037-1]", () => {
  it("テンプレートxlsxを生成してパースできる", async () => {
    const parsed = await parseXlsxImport(await buildXlsxImportTemplateBuffer());
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.map((row) => row.kind)).toEqual(["issue", "project_item", "milestone"]);
  });

  it("未知列・必須欠落・source_key重複を全件レポートし、行を返さない", async () => {
    const buffer = await workbookBuffer((workbook) => {
      const issues = workbook.getWorksheet("issues")!;
      addHeaders(issues, ["source_key", "title", "body", "unknown"]);
      issues.addRow(["DUP-1", "", "body", "x"]);
      const projectItems = workbook.getWorksheet("project_items")!;
      addHeaders(projectItems, [
        "source_key",
        "project_node_id",
        "content_node_id",
        "field_node_id",
        "field_type",
        "value",
      ]);
      projectItems.addRow(["DUP-1", "P", "I", "F", "text", "Ready"]);
      const milestones = workbook.getWorksheet("milestones")!;
      addHeaders(milestones, ["source_key", "title", "due_on", "description"]);
    });

    const parsed = await parseXlsxImport(buffer);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining(["unknown column", "required value missing"]),
    );
    expect(parsed.errors.some((error) => error.message.includes("duplicate source_key"))).toBe(true);
  });

  it("入力テキストの既知シークレットをサニタイズする", async () => {
    const buffer = await workbookBuffer((workbook) => {
      const issues = workbook.getWorksheet("issues")!;
      addHeaders(issues, ["source_key", "title", "body", "labels", "milestone"]);
      issues.addRow(["ISS-1", "token", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz", "", ""]);
      addHeaders(workbook.getWorksheet("project_items")!, [
        "source_key",
        "project_node_id",
        "content_node_id",
        "field_node_id",
        "field_type",
        "value",
      ]);
      addHeaders(workbook.getWorksheet("milestones")!, ["source_key", "title", "due_on", "description"]);
    });
    const parsed = await parseXlsxImport(buffer);
    expect(parsed.rows[0]?.kind).toBe("issue");
    expect(JSON.stringify(parsed.rows[0])).toContain("***REDACTED:authorization_header***");
  });
});

describe("executeXlsxImport [REQ-037, SPEC-INT-063]", () => {
  it("既存source_keyをスキップし、issue bodyへimport markerを付ける", async () => {
    const ledger = new MemoryLedger();
    await ledger.insert({
      sourceKey: "SKIP-1",
      targetKind: "milestone",
      githubId: "M_0",
      importRunId: "run-0",
      status: "imported",
    });
    const github = githubStub();
    const result = await executeXlsxImport({
      owner: "acme",
      repo: "widget",
      importRunId: "run-1",
      ledger,
      github,
      throttleMs: 0,
      rows: [
        { kind: "milestone", sourceKey: "SKIP-1", title: "v0", description: "" },
        { kind: "issue", sourceKey: "ISS-1", title: "Issue", body: "Body", labels: [] },
      ],
    });
    expect(result).toMatchObject({ imported: 1, skipped: 1, failed: 0 });
    expect(vi.mocked(github.createIssue).mock.calls[0]?.[0].body).toContain("<!-- import:ISS-1 -->");
  });

  it("Project v2はadd→updateの2段GraphQL相当を直列スロットリングする", async () => {
    const github = githubStub();
    const sleep = vi.fn(async () => {});
    await executeXlsxImport({
      owner: "acme",
      repo: "widget",
      importRunId: "run-1",
      ledger: new MemoryLedger(),
      github,
      throttleMs: 1000,
      sleep,
      rows: [
        { kind: "issue", sourceKey: "ISS-1", title: "Issue", body: "Body", labels: [] },
        {
          kind: "project_item",
          sourceKey: "PVI-1",
          projectNodeId: "P",
          contentNodeId: "I",
          fieldNodeId: "F",
          fieldType: "text",
          value: "Ready",
        },
      ],
    });
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(vi.mocked(github.addProjectV2ItemById).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(github.updateProjectV2ItemFieldValue).mock.invocationCallOrder[0]!,
    );
  });

  it("appendImportMarkerは同一markerを重複追加しない", () => {
    expect(appendImportMarker("body\n\n<!-- import:ISS-1 -->", "ISS-1").match(/import:ISS-1/g)).toHaveLength(1);
  });
});
