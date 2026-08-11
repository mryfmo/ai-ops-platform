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

  /** 新版を追加し、同一対応の旧版を非活性化する（1 トランザクションは呼び出し側）。 */
  async addVersion(mapping: IdMapping): Promise<void> {
    await this.db.query(
      `UPDATE id_mappings SET active = false, updated_at = now()
        WHERE source_system = $1 AND source_object_id = $2
          AND target_system = $3 AND active = true`,
      [mapping.sourceSystem, mapping.sourceObjectId, mapping.targetSystem],
    );
    await this.db.query(
      `INSERT INTO id_mappings (
         project_id, source_system, source_object_id, target_system, target_object_id,
         mapping_version, provenance, active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
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
    sourceSystem: string,
    sourceObjectId: string,
    targetSystem: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.db.query(
      `SELECT * FROM id_mappings
        WHERE source_system = $1 AND source_object_id = $2 AND target_system = $3 AND active = true
        ORDER BY mapping_version DESC LIMIT 1`,
      [sourceSystem, sourceObjectId, targetSystem],
    );
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }
}
