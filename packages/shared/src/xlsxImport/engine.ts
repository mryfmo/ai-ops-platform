import { appendImportMarker, type ImportTargetKind } from "./template.js";
import type { XlsxImportRow } from "./parser.js";

export interface ImportLedgerEntry {
  sourceKey: string;
  targetKind: ImportTargetKind;
  githubId: string;
  importRunId: string;
  status: "imported" | "skipped" | "failed";
}

export interface ImportLedger {
  findBySourceKey(sourceKey: string): Promise<ImportLedgerEntry | null>;
  insert(entry: ImportLedgerEntry): Promise<void>;
}

export interface XlsxImportGithubClient {
  createIssue(input: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    labels: string[];
    milestone?: string;
  }): Promise<{ number: number; htmlUrl: string; nodeId?: string }>;
  createMilestone(input: {
    owner: string;
    repo: string;
    title: string;
    dueOn?: string;
    description?: string;
  }): Promise<{ number: number; htmlUrl: string; nodeId?: string }>;
  addProjectV2ItemById(input: { projectNodeId: string; contentNodeId: string }): Promise<{ itemNodeId: string }>;
  updateProjectV2ItemFieldValue(input: {
    projectNodeId: string;
    itemNodeId: string;
    fieldNodeId: string;
    fieldType: string;
    value: string;
  }): Promise<void>;
  getGraphqlRateLimit(): Promise<{ remaining: number; resetAt: string }>;
}

export interface ExecuteXlsxImportOptions {
  owner: string;
  repo: string;
  importRunId: string;
  rows: XlsxImportRow[];
  ledger: ImportLedger;
  github: XlsxImportGithubClient;
  throttleMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface ExecuteXlsxImportResult {
  importRunId: string;
  imported: number;
  skipped: number;
  failed: number;
  progress: Array<{ sourceKey: string; kind: ImportTargetKind; status: "imported" | "skipped" | "failed" }>;
}

function rowKind(row: XlsxImportRow): ImportTargetKind {
  return row.kind;
}

async function waitForWrite(index: number, throttleMs: number, sleep: (ms: number) => Promise<void>): Promise<void> {
  if (index > 0 && throttleMs > 0) await sleep(throttleMs);
}

export async function executeXlsxImport(opts: ExecuteXlsxImportOptions): Promise<ExecuteXlsxImportResult> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const throttleMs = opts.throttleMs ?? 1000;
  const progress: ExecuteXlsxImportResult["progress"] = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let writeIndex = 0;

  for (const row of opts.rows) {
    const existing = await opts.ledger.findBySourceKey(row.sourceKey);
    if (existing) {
      skipped += 1;
      progress.push({ sourceKey: row.sourceKey, kind: rowKind(row), status: "skipped" });
      continue;
    }

    await waitForWrite(writeIndex, throttleMs, sleep);
    await opts.github.getGraphqlRateLimit();
    writeIndex += 1;

    try {
      if (row.kind === "issue") {
        const created = await opts.github.createIssue({
          owner: opts.owner,
          repo: opts.repo,
          title: row.title,
          body: appendImportMarker(row.body, row.sourceKey),
          labels: row.labels,
          milestone: row.milestone,
        });
        await opts.ledger.insert({
          sourceKey: row.sourceKey,
          targetKind: row.kind,
          githubId: created.nodeId ?? String(created.number),
          importRunId: opts.importRunId,
          status: "imported",
        });
      } else if (row.kind === "milestone") {
        const created = await opts.github.createMilestone({
          owner: opts.owner,
          repo: opts.repo,
          title: row.title,
          dueOn: row.dueOn,
          description: row.description,
        });
        await opts.ledger.insert({
          sourceKey: row.sourceKey,
          targetKind: row.kind,
          githubId: created.nodeId ?? String(created.number),
          importRunId: opts.importRunId,
          status: "imported",
        });
      } else {
        const added = await opts.github.addProjectV2ItemById({
          projectNodeId: row.projectNodeId,
          contentNodeId: row.contentNodeId,
        });
        await opts.github.updateProjectV2ItemFieldValue({
          projectNodeId: row.projectNodeId,
          itemNodeId: added.itemNodeId,
          fieldNodeId: row.fieldNodeId,
          fieldType: row.fieldType,
          value: row.value,
        });
        await opts.ledger.insert({
          sourceKey: row.sourceKey,
          targetKind: row.kind,
          githubId: added.itemNodeId,
          importRunId: opts.importRunId,
          status: "imported",
        });
      }
      imported += 1;
      progress.push({ sourceKey: row.sourceKey, kind: rowKind(row), status: "imported" });
    } catch {
      failed += 1;
      progress.push({ sourceKey: row.sourceKey, kind: rowKind(row), status: "failed" });
    }
  }

  return { importRunId: opts.importRunId, imported, skipped, failed, progress };
}
