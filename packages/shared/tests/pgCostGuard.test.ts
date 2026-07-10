/**
 * packages/shared/tests/pgCostGuard.test.ts
 *
 * 根拠: SPEC-INT-060（LLM日次コスト上限$20）/ ADR-0005（llm_usage表をバッチ+Webチャットで共有、
 *   JST基準の日次リセット ASM-003、agent別サブ上限）
 */
import { describe, it, expect } from "vitest";
import { PgCostGuard, jstDayRange, type PgQueryable } from "../src/clients/pgCostGuard.js";

function makeFakeDb() {
  const queries: Array<{ text: string; params: unknown[] }> = [];
  const rows: Array<Record<string, unknown>>[] = [];
  const db: PgQueryable = {
    async query(text, params = []) {
      queries.push({ text, params });
      return { rows: rows.shift() ?? [] };
    },
  };
  return { db, queries, pushRows: (r: Array<Record<string, unknown>>) => rows.push(r) };
}

describe("jstDayRange (ASM-003: JST基準)", () => {
  it("UTC 2026-07-06T20:00Z はJSTでは7/7なので、7/7のJST日境界を返す", () => {
    const { startIso, endIso } = jstDayRange(new Date("2026-07-06T20:00:00Z"));
    expect(startIso).toBe("2026-07-06T15:00:00.000Z"); // = 2026-07-07T00:00 JST
    expect(endIso).toBe("2026-07-07T15:00:00.000Z");
  });

  it("UTC 2026-07-07T10:00Z はJSTでも7/7", () => {
    const { startIso } = jstDayRange(new Date("2026-07-07T10:00:00Z"));
    expect(startIso).toBe("2026-07-06T15:00:00.000Z");
  });
});

describe("PgCostGuard (SPEC-INT-060)", () => {
  it("getTodaySpendUsdはJST当日範囲でSUMする", async () => {
    const { db, queries, pushRows } = makeFakeDb();
    pushRows([{ total: "12.5" }]);
    const guard = new PgCostGuard(db, {}, () => new Date("2026-07-07T01:00:00Z"));
    const total = await guard.getTodaySpendUsd();
    expect(total).toBe(12.5);
    expect(queries[0]!.text).toContain("FROM llm_usage");
    expect(queries[0]!.params[0]).toBe("2026-07-06T15:00:00.000Z");
  });

  it("recordはllm_usageへINSERTする", async () => {
    const { db, queries } = makeFakeDb();
    const guard = new PgCostGuard(db);
    await guard.record({
      at: "2026-07-07T01:00:00Z",
      agent: "WEB-CHAT",
      purpose: "view_switching",
      model: "claude-sonnet-4-6",
      input_tokens: 1000,
      output_tokens: 200,
      estimated_cost_usd: 0.006,
    });
    expect(queries[0]!.text).toContain("INSERT INTO llm_usage");
    expect(queries[0]!.params).toContain("WEB-CHAT");
    expect(queries[0]!.params).toContain(0.006);
  });

  it("全体上限超過でE-COST01", async () => {
    const { db, pushRows } = makeFakeDb();
    pushRows([{ total: "20.0" }]);
    const guard = new PgCostGuard(db, { dailyLimitUsd: 20 });
    await expect(guard.assertWithinBudget("ANY")).rejects.toThrow("E-COST01");
  });

  it("agent別サブ上限超過でE-COST01（全体は未達でも）", async () => {
    const { db, pushRows } = makeFakeDb();
    pushRows([{ total: "11.0" }]); // 全体: $11 < $20
    pushRows([{ total: "10.0" }]); // WEB-CHAT: $10 >= $10
    const guard = new PgCostGuard(db, { dailyLimitUsd: 20, perAgentDailyLimitUsd: { "WEB-CHAT": 10 } });
    await expect(guard.assertWithinBudget("WEB-CHAT")).rejects.toThrow("E-COST01");
  });

  it("上限内なら通過する", async () => {
    const { db, pushRows } = makeFakeDb();
    pushRows([{ total: "5.0" }]);
    pushRows([{ total: "2.0" }]);
    const guard = new PgCostGuard(db, { dailyLimitUsd: 20, perAgentDailyLimitUsd: { "WEB-CHAT": 10 } });
    await expect(guard.assertWithinBudget("WEB-CHAT")).resolves.toBeUndefined();
  });

  it("サブ上限未設定のagentは全体上限のみ判定（agent別クエリを発行しない）", async () => {
    const { db, queries, pushRows } = makeFakeDb();
    pushRows([{ total: "5.0" }]);
    const guard = new PgCostGuard(db, { dailyLimitUsd: 20 });
    await guard.assertWithinBudget("AGT-02");
    expect(queries).toHaveLength(1);
  });

  it("reserveはadvisory lock付きの単一INSERTで見積コストを予約する [C-3b]", async () => {
    const { db, queries, pushRows } = makeFakeDb();
    pushRows([{ usage_id: "42" }]);
    const guard = new PgCostGuard(db, { dailyLimitUsd: 20, perAgentDailyLimitUsd: { "WEB-CHAT": 10 } });

    const reservationId = await guard.reserve({
      at: "2026-07-07T01:00:00Z",
      agent: "WEB-CHAT",
      purpose: "view_switching",
      model: "claude-sonnet-4-6",
      input_tokens: 1000,
      output_tokens: 200,
      estimated_cost_usd: 0.006,
    });

    expect(reservationId).toBe("42");
    expect(queries[0]!.text).toContain("pg_advisory_xact_lock");
    expect(queries[0]!.text).toContain("INSERT INTO llm_usage");
    expect(queries[0]!.text).toContain("RETURNING usage_id");
  });

  it("reserveは日次上限を超える予約をINSERTせずE-COST01にする [C-3b]", async () => {
    const { db, queries, pushRows } = makeFakeDb();
    pushRows([]);
    const guard = new PgCostGuard(db, { dailyLimitUsd: 20 });

    await expect(
      guard.reserve({
        at: "2026-07-07T01:00:00Z",
        agent: "AGT-02",
        purpose: "free_text_structuring",
        model: "claude-sonnet-4-6",
        input_tokens: 1000,
        output_tokens: 200,
        estimated_cost_usd: 0.006,
      }),
    ).rejects.toThrow("E-COST01");
    expect(queries).toHaveLength(1);
  });

  it("reserveはagent別per-request上限をDBアクセス前に拒否する [C-3b]", async () => {
    const { db, queries } = makeFakeDb();
    const guard = new PgCostGuard(db, { perAgentRequestLimitUsd: { "WEB-CHAT": 0.001 } });

    await expect(
      guard.reserve({
        at: "2026-07-07T01:00:00Z",
        agent: "WEB-CHAT",
        purpose: "view_switching",
        model: "claude-sonnet-4-6",
        input_tokens: 1000,
        output_tokens: 200,
        estimated_cost_usd: 0.006,
      }),
    ).rejects.toThrow("per-request LLM budget");
    expect(queries).toHaveLength(0);
  });

  it("reconcileReservationは予約行を実コストへ更新する [C-3b]", async () => {
    const { db, queries } = makeFakeDb();
    const guard = new PgCostGuard(db);

    await guard.reconcileReservation("42", {
      at: "2026-07-07T01:00:05Z",
      agent: "WEB-CHAT",
      purpose: "view_switching",
      model: "claude-sonnet-4-6",
      input_tokens: 10,
      output_tokens: 5,
      estimated_cost_usd: 0.000105,
    });

    expect(queries[0]!.text).toContain("UPDATE llm_usage");
    expect(queries[0]!.params).toEqual([
      "42",
      "WEB-CHAT",
      "view_switching",
      "claude-sonnet-4-6",
      0.000105,
      "2026-07-07T01:00:05Z",
    ]);
  });
});
