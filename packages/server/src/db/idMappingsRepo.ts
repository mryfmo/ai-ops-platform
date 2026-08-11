/**
 * packages/server/src/db/idMappingsRepo.ts
 *
 * 根拠: FinalArch:CON-002 / ADR-0020。SoR 間 ID 対応の versioned mapping。
 * 版は追記で増やし、旧版は active=false で無効化する（削除しない）。
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
   * 新版を 1 文の CTE で原子的に追加する（単調 version CAS）。
   * 現 active 行の version >= 新 version の場合は何もせず false（stale 置換の拒否 —
   * 現行 active は非活性化されない）。並行競合は idx_id_mappings_one_active が直列化。
   * 旧版は削除しない。
   */
  async addVersion(mapping: IdMapping): Promise<boolean> {
    // 並行 addVersion は partial unique（idx_id_mappings_one_active）に敗れた側が
    // 23505 を受ける。snapshot を取り直して再試行し、より高い版が既に入っていれば
    // stale として false に収束する（呼び出し側リトライへ依存しない）。
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.addVersionOnce(mapping);
      } catch (error) {
        const pgError = error as { code?: string; constraint?: string };
        const isActiveRace = pgError.code === "23505" && pgError.constraint === "idx_id_mappings_one_active";
        if (!isActiveRace || attempt >= 3) throw error;
      }
    }
  }

  private async addVersionOnce(mapping: IdMapping): Promise<boolean> {
    const result = await this.db.query(
      `WITH current AS (
         SELECT mapping_id, mapping_version FROM id_mappings
          WHERE project_id = $1 AND source_system = $2 AND source_object_id = $3
            AND target_system = $4 AND active = true
       ),
       deactivated AS (
         UPDATE id_mappings m SET active = false, updated_at = now()
           FROM current c
          WHERE m.mapping_id = c.mapping_id AND c.mapping_version < $6
          RETURNING 1
       )
       INSERT INTO id_mappings (
         project_id, source_system, source_object_id, target_system, target_object_id,
         mapping_version, provenance, active
       )
       SELECT $1, $2, $3, $4, $5, $6, $7, true
        WHERE NOT EXISTS (SELECT 1 FROM current WHERE mapping_version >= $6)
          AND (SELECT count(*) FROM deactivated) IS NOT NULL`,
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
      `SELECT * FROM id_mappings
        WHERE project_id = $1 AND source_system = $2 AND source_object_id = $3
          AND target_system = $4 AND active = true`,
      [projectId, sourceSystem, sourceObjectId, targetSystem],
    );
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }
}
