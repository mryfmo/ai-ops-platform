/**
 * packages/shared/src/clients/pgCostGuard.ts
 *
 * 根拠:
 *   - SPEC-INT-060: LLM日次コスト上限（既定$20、PRF-03が変更可）。
 *   - ADR-0005: 常駐サーバ（WebUIチャット）とバッチエージェントが同一のコスト台帳を共有するため、
 *     プロセス内メモリ（InMemoryCostGuard）ではなくPostgreSQLのllm_usage表を正本とする。
 *     日次判定はJST基準（ASM-003）。agent別サブ上限（例: WEB-CHAT $10）を任意設定できる。
 *
 * 設計: shared パッケージに pg への依存を持ち込まないため、クエリ実行を PgQueryable として注入する。
 *   実運用では pg.Pool をそのまま渡せる（Pool.query は本インターフェースを構造的に満たす）。
 */
import type { CostGuard, LlmUsageRecord } from "./anthropicClient.js";
import { jstDayRange } from "../jst.js";
export { jstDayRange } from "../jst.js";

/**
 * pg.Pool / pg.Client と構造的に互換な最小クエリインターフェース。
 * rowCountは条件付きUPDATE（例: coding_tasks の状態遷移ガード）が実際に更新できたかを
 * 判定するために使用する（packages/server/src/db/codingTasksRepo.ts参照）。
 * pg.Pool.query()の戻り値は元々rowCountを含むため、既存の呼び出し元に影響はない。
 */
export interface PgQueryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

export interface PgClient extends PgQueryable {
  release(err?: Error): void;
}

export interface PgConnectable extends PgQueryable {
  connect(): Promise<PgClient>;
}

export interface PgCostGuardOptions {
  /** 日次上限USD（既定 $20。SPEC-INT-060） */
  dailyLimitUsd?: number;
  /** agent名ごとの日次サブ上限USD（例: { "WEB-CHAT": 10 }）。全体上限とは独立に適用される */
  perAgentDailyLimitUsd?: Record<string, number>;
  /** agent名ごとの1リクエスト上限USD。設定時は予約時に超過を拒否する */
  perAgentRequestLimitUsd?: Record<string, number>;
}

export class PgCostGuard implements CostGuard {
  public dailyLimitUsd: number;
  private readonly perAgentDailyLimitUsd: Record<string, number>;
  private readonly perAgentRequestLimitUsd: Record<string, number>;

  constructor(
    private readonly db: PgQueryable,
    opts: PgCostGuardOptions = {},
    private readonly nowProvider: () => Date = () => new Date(),
  ) {
    this.dailyLimitUsd = opts.dailyLimitUsd ?? 20;
    this.perAgentDailyLimitUsd = opts.perAgentDailyLimitUsd ?? {};
    this.perAgentRequestLimitUsd = opts.perAgentRequestLimitUsd ?? {};
  }

  async getTodaySpendUsd(): Promise<number> {
    const { startIso, endIso } = jstDayRange(this.nowProvider());
    const res = await this.db.query(
      "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM llm_usage WHERE at >= $1 AND at < $2",
      [startIso, endIso],
    );
    return Number(res.rows[0]?.total ?? 0);
  }

  /** agent別の本日消費（サブ上限判定用） */
  async getTodaySpendUsdByAgent(agent: string): Promise<number> {
    const { startIso, endIso } = jstDayRange(this.nowProvider());
    const res = await this.db.query(
      "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM llm_usage WHERE agent = $1 AND at >= $2 AND at < $3",
      [agent, startIso, endIso],
    );
    return Number(res.rows[0]?.total ?? 0);
  }

  async record(usage: LlmUsageRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO llm_usage
         (agent, purpose, model, cost_usd, cache_creation_input_tokens, cache_read_input_tokens, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        usage.agent,
        usage.purpose,
        usage.model,
        usage.estimated_cost_usd,
        usage.cache_creation_input_tokens ?? 0,
        usage.cache_read_input_tokens ?? 0,
        usage.at,
      ],
    );
  }

  async reserve(usage: LlmUsageRecord): Promise<string> {
    const requestLimit = this.perAgentRequestLimitUsd[usage.agent];
    if (requestLimit !== undefined && usage.estimated_cost_usd > requestLimit) {
      throw new Error(
        `E-COST01: per-request LLM budget for agent ${usage.agent} exceeded ($${usage.estimated_cost_usd.toFixed(
          6,
        )} > $${requestLimit})`,
      );
    }

    const { startIso, endIso } = jstDayRange(this.nowProvider());
    const agentLimit = this.perAgentDailyLimitUsd[usage.agent] ?? null;
    const client = hasConnect(this.db) ? await this.db.connect() : null;
    const tx = client ?? this.db;
    let released = false;
    try {
      await tx.query("BEGIN");
      // ponytail: one global lock protects the system-wide daily cap; if concurrency suffers, shorten this critical section or add lock timeouts.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('aiops_llm_usage_budget'))");
      const res = await tx.query(
        `WITH total_spend AS (
         SELECT COALESCE(SUM(cost_usd), 0) AS total
           FROM llm_usage
          WHERE at >= $1 AND at < $2
       ),
       agent_spend AS (
         SELECT COALESCE(SUM(cost_usd), 0) AS total
           FROM llm_usage
          WHERE agent = $3 AND at >= $1 AND at < $2
       )
       INSERT INTO llm_usage
         (agent, purpose, model, cost_usd, cache_creation_input_tokens, cache_read_input_tokens, at)
       SELECT $3, $4, $5, $6, $10, $11, $7
         FROM total_spend, agent_spend
        WHERE (total_spend.total + $6) <= $8
          AND ($9::numeric IS NULL OR (agent_spend.total + $6) <= $9::numeric)
       RETURNING usage_id`,
        [
          startIso,
          endIso,
          usage.agent,
          usage.purpose,
          usage.model,
          usage.estimated_cost_usd,
          usage.at,
          this.dailyLimitUsd,
          agentLimit,
          usage.cache_creation_input_tokens ?? 0,
          usage.cache_read_input_tokens ?? 0,
        ],
      );
      const usageId = res.rows[0]?.usage_id;
      if (usageId === undefined) {
        throw new Error(`E-COST01: daily LLM budget exceeded for agent ${usage.agent}`);
      }
      await tx.query("COMMIT");
      return String(usageId);
    } catch (error) {
      try {
        await tx.query("ROLLBACK");
      } catch (rollbackError) {
        const releaseError = toError(rollbackError);
        client?.release(releaseError);
        released = true;
        throw releaseError;
      }
      throw error;
    } finally {
      if (!released) client?.release();
    }
  }

  async reconcileReservation(reservationId: string, usage: LlmUsageRecord): Promise<void> {
    await this.db.query(
      `UPDATE llm_usage
          SET agent = $2, purpose = $3, model = $4, cost_usd = $5,
              cache_creation_input_tokens = $6, cache_read_input_tokens = $7, at = $8
        WHERE usage_id = $1`,
      [
        reservationId,
        usage.agent,
        usage.purpose,
        usage.model,
        usage.estimated_cost_usd,
        usage.cache_creation_input_tokens ?? 0,
        usage.cache_read_input_tokens ?? 0,
        usage.at,
      ],
    );
  }

  /**
   * 呼び出し前チェック: 全体上限とagent別サブ上限の両方を検査する。
   * 超過時は E-COST01 例外（SPEC-INT-060）。呼び出し側（/api/chat 等）は429に変換する。
   */
  async assertWithinBudget(agent: string): Promise<void> {
    const total = await this.getTodaySpendUsd();
    if (total >= this.dailyLimitUsd) {
      throw new Error(`E-COST01: daily LLM budget exceeded (total $${total.toFixed(2)} >= $${this.dailyLimitUsd})`);
    }
    const agentLimit = this.perAgentDailyLimitUsd[agent];
    if (agentLimit !== undefined) {
      const agentSpend = await this.getTodaySpendUsdByAgent(agent);
      if (agentSpend >= agentLimit) {
        throw new Error(
          `E-COST01: daily LLM budget for agent ${agent} exceeded ($${agentSpend.toFixed(2)} >= $${agentLimit})`,
        );
      }
    }
  }
}

function hasConnect(db: PgQueryable): db is PgConnectable {
  return typeof (db as { connect?: unknown }).connect === "function";
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
