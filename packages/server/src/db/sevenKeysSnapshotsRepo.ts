/**
 * packages/server/src/db/sevenKeysSnapshotsRepo.ts
 *
 * 根拠: ADR-0010 / REQ-038 / SPEC-INT-065 / AC-038-1。
 * Seven Keys月次PDCA snapshotの追記専用repo。
 */
import {
  SEVEN_KEY_DEFINITIONS,
  type ExecutiveProjectSevenKeys,
  type SevenKeyId,
  type SevenKeysMonthlySnapshot,
  type SevenKeysRag,
} from "@aiops/prjops";
import type { PgQueryable } from "@aiops/shared";

export interface SevenKeysSnapshotRecord {
  month: string;
  projectId: string;
  keysRag: Record<SevenKeyId, SevenKeysRag>;
  improvedKeys: SevenKeyId[];
  worsenedKeys: SevenKeyId[];
  nextActions: string[];
  generatedAt: string;
}

function keysRag(snapshot: SevenKeysMonthlySnapshot): Record<SevenKeyId, SevenKeysRag> {
  return Object.fromEntries(snapshot.keys.map((key) => [key.keyId, key.rag])) as Record<SevenKeyId, SevenKeysRag>;
}

function toRecord(row: Record<string, unknown>): SevenKeysSnapshotRecord {
  return {
    month: String(row.month),
    projectId: String(row.project_id),
    keysRag: row.keys_rag as Record<SevenKeyId, SevenKeysRag>,
    improvedKeys: (row.improved_keys as SevenKeyId[]) ?? [],
    worsenedKeys: (row.worsened_keys as SevenKeyId[]) ?? [],
    nextActions: (row.next_actions as string[]) ?? [],
    generatedAt: row.generated_at instanceof Date ? row.generated_at.toISOString() : String(row.generated_at ?? ""),
  };
}

export function toExecutiveSevenKeys(record: SevenKeysSnapshotRecord): ExecutiveProjectSevenKeys {
  return {
    projectId: record.projectId,
    name: record.projectId,
    keys: SEVEN_KEY_DEFINITIONS.map((definition) => ({
      keyId: definition.id,
      title: definition.title,
      rag: record.keysRag[definition.id],
      basis: "previous monthly snapshot",
    })),
  };
}

export class SevenKeysSnapshotsRepo {
  constructor(private readonly db: PgQueryable) {}

  async findByProjectMonth(projectId: string, month: string): Promise<SevenKeysSnapshotRecord | null> {
    const res = await this.db.query(
      `SELECT month, project_id, keys_rag, improved_keys, worsened_keys, next_actions, generated_at
       FROM seven_keys_snapshots WHERE project_id = $1 AND month = $2`,
      [projectId, month],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async findLatestBefore(projectId: string, month: string): Promise<SevenKeysSnapshotRecord | null> {
    const res = await this.db.query(
      `SELECT month, project_id, keys_rag, improved_keys, worsened_keys, next_actions, generated_at
       FROM seven_keys_snapshots WHERE project_id = $1 AND month < $2 ORDER BY month DESC LIMIT 1`,
      [projectId, month],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async insert(snapshot: SevenKeysMonthlySnapshot, generatedAt: string, nextActions: string[]): Promise<boolean> {
    const res = await this.db.query(
      `INSERT INTO seven_keys_snapshots (
         month, project_id, keys_rag, improved_keys, worsened_keys, next_actions, generated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (month, project_id) DO NOTHING`,
      [
        snapshot.month,
        snapshot.projectId,
        JSON.stringify(keysRag(snapshot)),
        snapshot.improvedKeys,
        snapshot.worsenedKeys,
        JSON.stringify(nextActions),
        generatedAt,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
