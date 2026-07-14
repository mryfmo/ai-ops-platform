import { describe, it, expect } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { ReportDeliveryLogRepo } from "../src/db/reportDeliveryLogRepo.js";

interface Call {
  text: string;
  params: unknown[] | undefined;
}

function makeMockDb(rows: Array<Record<string, unknown>> = []) {
  const calls: Call[] = [];
  const db: PgQueryable = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return { rows };
    },
  };
  return { db, calls };
}

describe("ReportDeliveryLogRepo [PrjOps:REQ-018, PrjOps:SPEC-INT-052]", () => {
  it("existsはsentのみを配信済み扱いにする", async () => {
    const { db, calls } = makeMockDb([{ 1: 1 }]);
    const repo = new ReportDeliveryLogRepo(db);
    expect(await repo.exists("RPT-1", "ST-1")).toBe(true);
    expect(calls[0]!.text).toContain("status = 'sent'");
  });

  it("recordはpending/sentステータスを保存する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new ReportDeliveryLogRepo(db);
    await repo.record({
      reportId: "RPT-1",
      recipientId: "ST-1",
      deliveredAt: "2026-07-09T00:00:00.000Z",
      status: "pending",
    });
    expect(calls[0]!.text).toContain("ON CONFLICT");
    expect(calls[0]!.params).toEqual(["RPT-1", "ST-1", "2026-07-09T00:00:00.000Z", "pending"]);
  });

  it("markSentはsentへ確定する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new ReportDeliveryLogRepo(db);
    await repo.markSent("RPT-1", "ST-1", "2026-07-09T00:00:00.000Z");
    expect(calls[0]!.text).toContain("status = 'sent'");
    expect(calls[0]!.params).toEqual(["RPT-1", "ST-1", "2026-07-09T00:00:00.000Z"]);
  });
});
