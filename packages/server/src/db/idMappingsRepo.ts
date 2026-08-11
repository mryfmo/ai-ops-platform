/**
 * packages/server/src/db/idMappingsRepo.ts
 *
 * 根拠: FinalArch:CON-002 / ADR-0020。
 * SoR 間 ID 対応の versioned mapping。現行値の正本は id_mapping_heads
 * （論理キー PK の単一行）で、単調 version CAS は 1 文の
 * ON CONFLICT DO UPDATE ... WHERE old.version < new.version による。
 * READ COMMITTED の並行実行でも EvalPlanQual が最新行と比較するため、
 * Pool（autocommit）でも explicit transaction の Client でも追加の
 * lock / retry なしで安全。受理された版は id_mappings へ追記専用で残す。
 */
import type { PgQueryable } from "@aiops/shared";

export interface IdMapping {
  projectId: string;
  sourceSystem: string;
  sourceObjectId: string;
  targetSystem: string;
  targetObjectId: string;
  mappingVersion: number;
  provenance: unknown;
}

export class IdMappingsRepo {
  constructor(private readonly db: PgQueryable) {}

  /**
   * 新版の登録。true = 受理（head 更新 + 履歴追記）、false = stale
   * （現行 head の version 以下 — head は不変のまま）。旧版は削除しない。
   */
  async addVersion(mapping: IdMapping): Promise<boolean> {
    const result = await this.db.query(
      `WITH head AS (
         INSERT INTO id_mapping_heads AS h (
           project_id, source_system, source_object_id, target_system, target_object_id,
           mapping_version, provenance, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (project_id, source_system, source_object_id, target_system)
         DO UPDATE SET
           target_object_id = EXCLUDED.target_object_id,
           mapping_version = EXCLUDED.mapping_version,
           provenance = EXCLUDED.provenance,
           updated_at = now()
         WHERE h.mapping_version < EXCLUDED.mapping_version
         RETURNING 1
       )
       INSERT INTO id_mappings (
         project_id, source_system, source_object_id, target_system, target_object_id,
         mapping_version, provenance
       )
       SELECT $1, $2, $3, $4, $5, $6, $7
         FROM head
       ON CONFLICT DO NOTHING`,
      [
        mapping.projectId,
        mapping.sourceSystem,
        mapping.sourceObjectId,
        mapping.targetSystem,
        mapping.targetObjectId,
        mapping.mappingVersion,
        JSON.stringify(mapping.provenance),
      ],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async findActive(
    projectId: string,
    sourceSystem: string,
    sourceObjectId: string,
    targetSystem: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.db.query(
      `SELECT * FROM id_mapping_heads
        WHERE project_id = $1 AND source_system = $2 AND source_object_id = $3 AND target_system = $4`,
      [projectId, sourceSystem, sourceObjectId, targetSystem],
    );
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }
}
