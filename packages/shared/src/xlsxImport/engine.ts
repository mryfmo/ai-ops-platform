/**
 * packages/shared/src/xlsxImport/engine.ts
 *
 * 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。
 * Excelインポート行をGitHub Issue / Project v2 / Milestoneへ反映し、source_key台帳で冪等化する。
 */
import { appendImportMarker, type ImportTargetKind } from "./template.js";
import type { XlsxImportRow } from "./parser.js";

export interface ImportLedgerEntry {
  sourceKey: string;
  targetKind: ImportTargetKind;
  githubId: string;
  importRunId: string;
  status: "pending" | "imported" | "skipped" | "failed";
  error?: string;
}

export interface ImportLedger {
  findBySourceKey(sourceKey: string): Promise<ImportLedgerEntry | null>;
  insert(entry: ImportLedgerEntry): Promise<void>;
  markImported?(sourceKey: string, githubId: string): Promise<void>;
  markFailed?(sourceKey: string, error: string): Promise<void>;
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
  minGraphqlRemaining?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface ExecuteXlsxImportResult {
  importRunId: string;
  imported: number;
  skipped: number;
  failed: number;
  progress: Array<{
    sourceKey: string;
    kind: ImportTargetKind;
    status: "imported" | "skipped" | "failed";
    error?: string;
  }>;
}

function rowKind(row: XlsxImportRow): ImportTargetKind {
  return row.kind;
}

async function waitForWrite(index: number, throttleMs: number, sleep: (ms: number) => Promise<void>): Promise<void> {
  if (index > 0 && throttleMs > 0) await sleep(throttleMs);
}

async function waitForRateLimit(
  github: XlsxImportGithubClient,
  minRemaining: number,
  sleep: (ms: number) => Promise<void>,
  now: () => Date,
): Promise<void> {
  const rateLimit = await github.getGraphqlRateLimit();
  if (rateLimit.remaining > minRemaining) return;
  const resetDelayMs = Date.parse(rateLimit.resetAt) - now().getTime();
  if (resetDelayMs > 0) await sleep(resetDelayMs);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function markImported(
  ledger: ImportLedger,
  row: XlsxImportRow,
  importRunId: string,
  githubId: string,
): Promise<void> {
  if (ledger.markImported) {
    await ledger.markImported(row.sourceKey, githubId);
    return;
  }
  await ledger.insert({
    sourceKey: row.sourceKey,
    targetKind: rowKind(row),
    githubId,
    importRunId,
    status: "imported",
  });
}

async function markFailed(ledger: ImportLedger, sourceKey: string, error: string): Promise<void> {
  await ledger.markFailed?.(sourceKey, error);
}

export async function executeXlsxImport(opts: ExecuteXlsxImportOptions): Promise<ExecuteXlsxImportResult> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const throttleMs = opts.throttleMs ?? 1000;
  const minGraphqlRemaining = opts.minGraphqlRemaining ?? 50;
  const now = opts.now ?? (() => new Date());
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

    try {
      await opts.ledger.insert({
        sourceKey: row.sourceKey,
        targetKind: rowKind(row),
        githubId: "pending",
        importRunId: opts.importRunId,
        status: "pending",
      });
    } catch (err) {
      failed += 1;
      progress.push({ sourceKey: row.sourceKey, kind: rowKind(row), status: "failed", error: errorMessage(err) });
      continue;
    }

    try {
      await waitForWrite(writeIndex, throttleMs, sleep);
      await waitForRateLimit(opts.github, minGraphqlRemaining, sleep, now);
      writeIndex += 1;

      let githubId: string;
      if (row.kind === "issue") {
        const created = await opts.github.createIssue({
          owner: opts.owner,
          repo: opts.repo,
          title: row.title,
          body: appendImportMarker(row.body, row.sourceKey),
          labels: row.labels,
          milestone: row.milestone,
        });
        githubId = created.nodeId ?? String(created.number);
      } else if (row.kind === "milestone") {
        const created = await opts.github.createMilestone({
          owner: opts.owner,
          repo: opts.repo,
          title: row.title,
          dueOn: row.dueOn,
          description: row.description,
        });
        githubId = created.nodeId ?? String(created.number);
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
        githubId = added.itemNodeId;
      }
      await markImported(opts.ledger, row, opts.importRunId, githubId);
      imported += 1;
      progress.push({ sourceKey: row.sourceKey, kind: rowKind(row), status: "imported" });
    } catch (err) {
      const error = errorMessage(err);
      await markFailed(opts.ledger, row.sourceKey, error);
      failed += 1;
      progress.push({ sourceKey: row.sourceKey, kind: rowKind(row), status: "failed", error });
    }
  }

  return { importRunId: opts.importRunId, imported, skipped, failed, progress };
}
