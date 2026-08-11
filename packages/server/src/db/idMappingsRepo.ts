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
   * 新版を 1 文の CTE で原子的に追加する（同一 project スコープ論理キーの旧 active を
   * 非活性化してから挿入。並行実行は idx_id_mappings_one_active の partial unique が
   * 直列化し、敗者は unique violation で失敗する）。旧版は削除しない。
   */
  async addVersion(mapping: IdMapping): Promise<void> {
    await this.db.query(
      `WITH deactivated AS (
         UPDATE id_mappings SET active = false, updated_at = now()
          WHERE project_id = $1 AND source_system = $2 AND source_object_id = $3
            AND target_system = $4 AND active = true
          RETURNING 1
       )
       INSERT INTO id_mappings (
         project_id, source_system, source_object_id, target_system, target_object_id,
         mapping_version, provenance, active
       )
       -- CTE を参照して deactivate の完了後に挿入させる（未参照だと実行順が保証されない）
       SELECT $1, $2, $3, $4, $5, $6, $7, true
        WHERE (SELECT count(*) FROM deactivated) IS NOT NULL`,
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
