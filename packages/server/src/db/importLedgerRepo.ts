/**
 * packages/server/src/db/importLedgerRepo.ts
 *
 * 根拠: REQ-037 / SPEC-INT-063 / ADR-0008。
 * Excelインポートの冪等性をsource_keyで担保する台帳。追記/参照のみで扱う。
 */
import type { ImportLedger, ImportLedgerEntry, PgQueryable } from "@aiops/shared";

function toEntry(row: Record<string, unknown>): ImportLedgerEntry {
  return {
    sourceKey: String(row.source_key),
    targetKind: row.target_kind as ImportLedgerEntry["targetKind"],
    githubId: String(row.github_id),
    importRunId: String(row.import_run_id),
    status: row.status as ImportLedgerEntry["status"],
    error: row.error ? String(row.error) : undefined,
  };
}

export class ImportLedgerRepo implements ImportLedger {
  constructor(private readonly db: PgQueryable) {}

  async findBySourceKey(sourceKey: string): Promise<ImportLedgerEntry | null> {
    const res = await this.db.query(
      `SELECT source_key, target_kind, github_id, import_run_id, status, error
       FROM import_ledger WHERE source_key = $1`,
      [sourceKey],
    );
    return res.rows[0] ? toEntry(res.rows[0]) : null;
  }

  async insert(entry: ImportLedgerEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO import_ledger (source_key, target_kind, github_id, import_run_id, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_key) DO NOTHING`,
      [entry.sourceKey, entry.targetKind, entry.githubId, entry.importRunId, entry.status],
    );
  }

  async markImported(sourceKey: string, githubId: string): Promise<void> {
    await this.db.query(
      `UPDATE import_ledger
       SET status = 'imported', github_id = $2, error = NULL
       WHERE source_key = $1`,
      [sourceKey, githubId],
    );
  }

  async markFailed(sourceKey: string, error: string): Promise<void> {
    await this.db.query(
      `UPDATE import_ledger
       SET status = 'failed', error = $2
       WHERE source_key = $1`,
      [sourceKey, error],
    );
  }
}
