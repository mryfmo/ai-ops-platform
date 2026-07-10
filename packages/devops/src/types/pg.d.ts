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
