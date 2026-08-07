/**
 * packages/devops/src/types/pg.d.ts
 *
 * 根拠: ADR-0001（DevOps の正本データストアは PostgreSQL とする）/ ADR-0003（DevOps は常駐
 *   サービスとして稼働し、状態はすべてデータストアに置く）/ ADR-0004（pnpm の厳密解決により
 *   phantom dependency を排除する。@aiops/devops は `@types/pg` を依存に持たない）/
 *   DevOps:SPEC-INT-050（events/deployments/incidents/grants 等のテーブル）。
 *
 * db/migrate.ts とリポジトリ層が使う Pool / PoolClient の最小面だけを宣言する型シムであり、
 * 仕様上の判定を担わない。@types/pg を devops へ足すと ADR-0004 の依存境界が崩れるため置く。
 */
declare module "pg" {
  export interface PoolClient {
    query(
      text: string,
      params?: unknown[],
    ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
    release(err?: Error): void;
  }

  export class Pool {
    constructor(config: { connectionString: string });
    query(
      text: string,
      params?: unknown[],
    ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
