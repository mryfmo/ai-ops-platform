/**
 * packages/server/src/db/grantsRepo.ts
 *
 * 根拠: DevOps SPEC-INT-053（grants台帳）/ SPEC-INT-032（毎分のJIT失効判定の入力・結果反映）。
 *   grantsテーブルの target 列は "owner/repo" 形式で保持し、AGT_SECのGrantRecord
 *   （targetOwner/targetRepo）へ分解して渡す。
 */
import type { PgQueryable } from "@aiops/shared";
import type { GrantRecord } from "@aiops/devops";

export class GrantsRepo {
  constructor(private readonly db: PgQueryable) {}

  /** 未失効の権限を台帳から読み込む（JIT失効ジョブの入力） */
  async loadActiveGrants(): Promise<GrantRecord[]> {
    const res = await this.db.query(
      "SELECT grant_id, subject, target, level, expires_at, revoked_at FROM grants WHERE revoked_at IS NULL",
    );
    return res.rows.map((r) => {
      const target = String(r.target);
      const slash = target.indexOf("/");
      return {
        grantId: String(r.grant_id),
        subject: String(r.subject),
        targetOwner: slash > 0 ? target.slice(0, slash) : target,
        targetRepo: slash > 0 ? target.slice(slash + 1) : "",
        level: r.level as GrantRecord["level"],
        expiresAt: new Date(String(r.expires_at)).toISOString(),
        revokedAt: r.revoked_at ? new Date(String(r.revoked_at)).toISOString() : null,
      };
    });
  }

  /** 失効実行結果を台帳へ反映する（AGT_SEC.revokeExpiredGrantsがGitHub側を剥奪した後に呼ぶ） */
  async markRevoked(grantIds: string[], at: Date): Promise<void> {
    if (grantIds.length === 0) return;
    await this.db.query("UPDATE grants SET revoked_at = $1 WHERE grant_id = ANY($2) AND revoked_at IS NULL", [
      at.toISOString(),
      grantIds,
    ]);
  }
}
