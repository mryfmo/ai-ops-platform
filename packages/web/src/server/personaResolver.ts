/**
 * packages/web/src/server/personaResolver.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：ペルソナ別表示切替の起点）。
 *   - DevOps側: packages/devops/src/lib/reportPermissionFilter.ts の Profile
 *     （PRF-M/L/G）・DevOpsVisibilityContext・RecipientRecord・isActiveRecipient を用いる。
 *     recipientsテーブル（packages/devops/src/db/schema.sql）を **リクエスト毎に** 照会する
 *     （CLAUDE.md設計原則6: recipientsのactive判定はリクエスト毎、キャッシュ禁止）。
 *   - PrjOps側: packages/prjops/src/lib/reportPermissionFilter.ts の Profile
 *     （PRF-01〜05）・ProjectVisibilityContext を用いる。ステークホルダーマスタは
 *     本リポジトリ外（prjops-dataリポジトリのYAML）にあるため、StakeholderMasterProvider
 *     インターフェースで抽象化する。
 *
 * 残課題: StakeholderMasterProvider の本番実装（prjops-dataリポジトリからのYAML取得）は
 *   本タスクでは行わない。InMemoryStakeholderMasterProvider は開発/テスト用フィクスチャに限る。
 *   本番運用前に YamlStakeholderMasterProvider 等の実装を別タスクで追加すること。
 *
 * DB接続は @aiops/shared の PgQueryable（pg.Pool / pg.Client と構造的に互換な最小
 * クエリインターフェース）を注入する形にし、web パッケージのユニットテストは
 * ネットワーク・実DBなしで実行できるようにする（既存 FetchLike パターン踏襲）。
 */
import type { PgQueryable } from "@aiops/shared";
import type { Profile as DevopsProfile, DevOpsVisibilityContext } from "@aiops/devops";
import type { Profile as PrjopsProfile, ProjectVisibilityContext } from "@aiops/prjops";

export type ResolvedPersona =
  | { domain: "prjops"; profile: PrjopsProfile; visibility: ProjectVisibilityContext }
  | { domain: "devops"; profile: DevopsProfile; visibility: DevOpsVisibilityContext };

export interface PersonaResolver {
  resolveByEmail(email: string): Promise<ResolvedPersona[]>;
}

/**
 * DevOps recipients テーブルからペルソナを解決する。
 * REQ-024 AC-024a（配信名簿から外れた宛先には配信しない）と同じ制約をWebUIでも維持するため、
 * active=false のレコードは除外する。呼び出しの都度DBへ問い合わせ、結果をフィールドに
 * キャッシュしない（recipientsの状態は運用中に変わりうるため）。
 */
export class DevopsPersonaSource {
  constructor(private readonly db: PgQueryable) {}

  async resolveByEmail(email: string): Promise<ResolvedPersona[]> {
    const res = await this.db.query("SELECT user_id, profile, projects, active FROM recipients WHERE email = $1", [
      email,
    ]);
    const personas: ResolvedPersona[] = [];
    for (const row of res.rows) {
      if (row["active"] !== true) continue;
      const profile = row["profile"] as DevopsProfile;
      const projects = Array.isArray(row["projects"]) ? (row["projects"] as string[]) : [];
      const visibility: DevOpsVisibilityContext = {
        recipientUserId: String(row["user_id"]),
        recipientAssignedProjectIds: projects,
      };
      personas.push({ domain: "devops", profile, visibility });
    }
    return personas;
  }
}

/** PrjOpsステークホルダーマスタの1レコード（prjops-dataリポジトリのYAML相当） */
export interface StakeholderRecord {
  stakeholderId: string;
  email: string;
  profile: PrjopsProfile;
  managedProjectIds: string[];
  assignedProjectIds: string[];
  participatingProjectIds: string[];
  investedProjectIds: string[];
}

/**
 * PrjOpsステークホルダーマスタへのアクセスを抽象化するインターフェース。
 * 本番実装（prjops-dataリポジトリのYAML取得）は残課題であり、本タスクでは実装しない。
 */
export interface StakeholderMasterProvider {
  findByEmail(email: string): Promise<StakeholderRecord[]>;
}

/**
 * 開発/テスト用のインメモリ実装。
 * 残課題: 本番運用では prjops-data リポジトリのYAMLを取得する実装
 * （例: YamlStakeholderMasterProvider）に差し替える必要がある。
 */
export class InMemoryStakeholderMasterProvider implements StakeholderMasterProvider {
  constructor(private readonly records: StakeholderRecord[] = []) {}

  async findByEmail(email: string): Promise<StakeholderRecord[]> {
    return this.records.filter((r) => r.email === email);
  }
}

/** PrjOps側のペルソナ解決（StakeholderMasterProvider経由） */
export class PrjopsPersonaSource {
  constructor(private readonly provider: StakeholderMasterProvider) {}

  async resolveByEmail(email: string): Promise<ResolvedPersona[]> {
    const records = await this.provider.findByEmail(email);
    return records.map((r) => {
      const visibility: ProjectVisibilityContext = {
        recipientStakeholderId: r.stakeholderId,
        recipientManagedProjectIds: r.managedProjectIds,
        recipientAssignedProjectIds: r.assignedProjectIds,
        recipientParticipatingProjectIds: r.participatingProjectIds,
        investedProjectIds: r.investedProjectIds,
      };
      return { domain: "prjops", profile: r.profile, visibility } as ResolvedPersona;
    });
  }
}

/**
 * DevOps/PrjOps両ドメインのペルソナ解決を束ねる合成リゾルバ。
 * 該当ペルソナが1件もない場合は空配列を返す。
 */
export class CompositePersonaResolver implements PersonaResolver {
  constructor(
    private readonly devopsSource: DevopsPersonaSource,
    private readonly prjopsSource: PrjopsPersonaSource,
  ) {}

  async resolveByEmail(email: string): Promise<ResolvedPersona[]> {
    const [devopsPersonas, prjopsPersonas] = await Promise.all([
      this.devopsSource.resolveByEmail(email),
      this.prjopsSource.resolveByEmail(email),
    ]);
    return [...prjopsPersonas, ...devopsPersonas];
  }
}
