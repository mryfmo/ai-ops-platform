/** 根拠: ADR-0024 / WIQ-001 / WIQ-002 / WIQ-005 */
import { describe, expect, it, vi } from "vitest";

import { WorkIqQueryReceiptsRepo } from "../src/db/workIqQueryReceiptsRepo.js";

const HASH = "a".repeat(64);
const baseReceipt = {
  receiptId: "11111111-1111-4111-8111-111111111111",
  subjectId: "user-a",
  tenantId: "22222222-2222-4222-8222-222222222222",
  tool: "ask" as const,
  questionHash: HASH,
  sourceReferences: [{ system: "outlook", objectId: "message-1" }],
  permissionContext: { scope: "delegated" },
  provenanceComplete: true,
  decisionId: null,
  status: "succeeded" as const,
  errorCode: null,
  traceId: "33333333-3333-4333-8333-333333333333",
};

describe("WorkIqQueryReceiptsRepo [ADR-0024] [WIQ-001] [WIQ-005]", () => {
  it("records only metadata with one parameterized INSERT and deep secret sanitization", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const secret = ["abcdefghijkl", "mnopqrstuvwx"].join("");

    await new WorkIqQueryReceiptsRepo({ query }).record({
      ...baseReceipt,
      sourceReferences: [{ system: "outlook", note: `api_key=${secret}` }],
      permissionContext: { nested: { bearer: `Bearer ${secret}` } },
    });

    const [sql, params] = query.mock.calls[0]! as [string, unknown[]];
    expect(sql).toContain("INSERT INTO work_iq_query_receipts");
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE)\b/u);
    expect(params).toHaveLength(12);
    expect(JSON.stringify(params)).not.toContain(secret);
    expect(JSON.stringify(params)).not.toContain("questionText");
    expect(JSON.stringify(params)).not.toContain("responseText");
  });

  it("accepts a fetch receipt only with a null question hash", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });

    await expect(
      new WorkIqQueryReceiptsRepo({ query }).record({
        ...baseReceipt,
        tool: "fetch",
        questionHash: null,
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    [{ ...baseReceipt, questionHash: null }, "E-WIQ-RECEIPT-INPUT"],
    [{ ...baseReceipt, questionHash: "not-a-sha256" }, "E-WIQ-RECEIPT-INPUT"],
    [{ ...baseReceipt, tool: "fetch", questionHash: HASH }, "E-WIQ-RECEIPT-INPUT"],
    [{ ...baseReceipt, status: "succeeded", errorCode: "E-WIQ-HTTP" }, "E-WIQ-RECEIPT-INPUT"],
    [{ ...baseReceipt, status: "failed", errorCode: null }, "E-WIQ-RECEIPT-INPUT"],
    [{ ...baseReceipt, sourceReferences: {} }, "E-WIQ-RECEIPT-INPUT"],
    [{ ...baseReceipt, provenanceComplete: true, sourceReferences: [] }, "E-WIQ-RECEIPT-INPUT"],
    [{ ...baseReceipt, provenanceComplete: true, permissionContext: null }, "E-WIQ-RECEIPT-INPUT"],
  ])("rejects invalid receipt metadata before querying", async (receipt, error) => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });

    await expect(new WorkIqQueryReceiptsRepo({ query }).record(receipt as never)).rejects.toThrow(error);
    expect(query).not.toHaveBeenCalled();
  });
});
