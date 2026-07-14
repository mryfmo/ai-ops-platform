import { describe, it, expect, vi } from "vitest";
import { InMemoryAuditLog, validateReasonRequirement, findTraceChain } from "../src/auditLog.js";
import { PgAuditLog } from "../src/clients/pgAuditLog.js";

describe("InMemoryAuditLog [PrjOps:REQ-020, PrjOps:SPEC-INT-053/056]", () => {
  it("追記した順にlog_idが採番される", async () => {
    const log = new InMemoryAuditLog();
    const r1 = await log.append({
      trace_id: "t1",
      actor: "AGT-02",
      action: "ingest",
      basis: "REQ-004",
      detail: { a: 1 },
      at: "2026-07-06T09:00:00+09:00",
    });
    const r2 = await log.append({
      trace_id: "t1",
      actor: "AGT-03",
      action: "judge",
      basis: "REQ-007",
      detail: { color: "green" },
      at: "2026-07-06T09:01:00+09:00",
    });
    expect(r1.log_id).toBe(1);
    expect(r2.log_id).toBe(2);
  });

  it("readAllは追記された全レコードを返す（改変不可・追記のみ）", async () => {
    const log = new InMemoryAuditLog();
    await log.append({ trace_id: "t1", actor: "AGT-02", action: "ingest", basis: "REQ-004", detail: {}, at: "x" });
    const all = await log.readAll();
    expect(all).toHaveLength(1);
    // AuditLogWriterには update/delete に相当するメソッドが型上存在しない
    expect((log as unknown as { update?: unknown }).update).toBeUndefined();
    expect((log as unknown as { delete?: unknown }).delete).toBeUndefined();
  });

  it("シークレットを含む詳細情報は書き込み拒否される（REQ-032連携）", async () => {
    const log = new InMemoryAuditLog();
    await expect(
      log.append({
        trace_id: "t1",
        actor: "AGT-BLD",
        action: "log_analysis",
        basis: "SPEC-INT-011",
        detail: { excerpt: "token=ghp_" + "a".repeat(36) },
        at: "x",
      }),
    ).rejects.toThrow(/E-AUD02/);
  });
});

describe("PgAuditLog PostgreSQL boundary [REQ-028, SPEC-INT-056]", () => {
  it("passes a valid UUID trace_id to the INSERT boundary [REQ-028 / SPEC-INT-056]", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ log_id: "7" }] });
    const traceId = "123e4567-e89b-42d3-a456-426614174000";
    await new PgAuditLog({ query }, "prjops_5y").append({
      trace_id: traceId,
      actor: "AGT-04",
      action: "llm_unknown_model_pricing_fallback",
      basis: "PrjOps:SPEC-INT-060",
      detail: { model: "unknown" },
      at: "2026-07-13T00:00:00Z",
    });
    expect(query.mock.calls[0]![1]![1]).toBe(traceId);
    expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("validateReasonRequirement [PrjOps:REQ-021 AC-021-1]", () => {
  it("status_overrideは理由必須", () => {
    expect(() => validateReasonRequirement("status_override", undefined)).toThrow(/E-AUD01/);
    expect(() => validateReasonRequirement("status_override", "")).toThrow(/E-AUD01/);
    expect(() => validateReasonRequirement("status_override", "計画変更のため")).not.toThrow();
  });
  it("理由不要な操作はチェックされない", () => {
    expect(() => validateReasonRequirement("ingest", undefined)).not.toThrow();
  });
});

describe("findTraceChain [AC-020-1: 数値の根拠まで遡れる]", () => {
  it("同一trace_idのレコードをlog_id順に返す", async () => {
    const log = new InMemoryAuditLog();
    await log.append({ trace_id: "t1", actor: "AGT-02", action: "ingest", basis: "REQ-004", detail: {}, at: "x" });
    await log.append({ trace_id: "t2", actor: "AGT-03", action: "judge", basis: "REQ-007", detail: {}, at: "y" });
    await log.append({ trace_id: "t1", actor: "AGT-04", action: "generate", basis: "PrjOps:REQ-010", detail: {}, at: "z" });
    const all = await log.readAll();
    const chain = findTraceChain(all, "t1");
    expect(chain.map((r) => r.action)).toEqual(["ingest", "generate"]);
  });
});
