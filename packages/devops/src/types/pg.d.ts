declare module "pg" {
  export class Pool {
    constructor(config: { connectionString: string });
    query(
      text: string,
      params?: unknown[],
    ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
    end(): Promise<void>;
  }
}
