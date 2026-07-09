import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "../src/auditLog.js";
import {
  buildStandardReportPayload,
  countChars,
  generateReportSlots,
  parseReportSlots,
  renderEvidenceHeader,
  standardReportSlotMaxChars,
  truncateReportSlots,
  validateStandardReportPayload,
  type ReportStructuredClient,
  type StandardReportSlots,
} from "../src/index.js";
import type { StructuredCallOptions, StructuredCallResult } from "../src/clients/anthropicClient.js";

class StubReportClient implements ReportStructuredClient {
  private calls = 0;
  constructor(private readonly outputs: StandardReportSlots[]) {}

  async call<T>(_opts: StructuredCallOptions<T>): Promise<StructuredCallResult<T>> {
    const value = this.outputs[Math.min(this.calls, this.outputs.length - 1)];
    this.calls += 1;
    return {
      value: value as T,
      model: "test-model",
      attempts: 1,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
  }

  get callCount(): number {
    return this.calls;
  }
}

const validSlots: StandardReportSlots = {
  conclusion: "進捗は計画内です。",
  riskSummary: "重大な新規リスクはありません。",
  nextActions: "未完了レビューを確認します。",
};

describe("standard report schema validation [REQ-040, SPEC-INT-067, SPEC-INT-082]", () => {
  it("根拠IDヘッダと固定スロットを検証する [AC-040-1, AC-032a]", () => {
    const payload = buildStandardReportPayload(
      {
        evidenceIds: ["REQ-040", "SPEC-INT-067"],
        periodLabel: "2026-W28",
        metrics: { completed: 3, blocked: 1 },
      },
      validSlots,
      "2026-07-09T16:00:00+09:00",
    );
    expect(validateStandardReportPayload(payload)).toEqual({ ok: true, errors: [] });
    expect(renderEvidenceHeader(payload.evidenceIds)).toContain("REQ-040");
  });

  it("スロット文字数超過を検出し、切詰めできる [SPEC-INT-067]", () => {
    const overLimit = {
      ...validSlots,
      conclusion: "あ".repeat(standardReportSlotMaxChars("conclusion") + 5),
    };
    const payload = buildStandardReportPayload(
      { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: { completed: 1 } },
      overLimit,
      "now",
    );
    expect(validateStandardReportPayload(payload).ok).toBe(false);
    const truncated = truncateReportSlots(overLimit);
    expect(truncated.truncatedKeys).toEqual(["conclusion"]);
    expect(countChars(truncated.slots.conclusion)).toBeLessThanOrEqual(standardReportSlotMaxChars("conclusion"));
  });

  it("LLMラッパーは1回リトライ後も超過なら切詰めを監査ログへ記録する [SPEC-INT-067, SPEC-INT-082]", async () => {
    const tooLong = {
      ...validSlots,
      riskSummary: "リスク".repeat(100),
    };
    const client = new StubReportClient([tooLong, tooLong]);
    const auditLog = new InMemoryAuditLog();
    const result = await generateReportSlots({
      traceId: "trace-rpt-1",
      actor: "AGT-04",
      client,
      auditLog,
      evidenceIds: ["REQ-040", "SPEC-INT-082"],
      periodLabel: "2026-W28",
      metrics: { completed: 5 },
    });

    expect(client.callCount).toBe(2);
    expect(result.truncatedKeys).toEqual(["riskSummary"]);
    const auditRecords = await auditLog.readAll();
    expect(auditRecords.map((record) => record.action)).toEqual([
      "report_slot_validation_retry",
      "report_slot_truncated",
    ]);
  });

  it("parseReportSlotsは必須スロット欠落を拒否する [AC-040-1]", () => {
    expect(() => parseReportSlots({ conclusion: "ok" })).toThrow(/E-RPT01/);
  });

  it("manager-weekly / investor-quarterly reportTypeを許可する [REQ-039, SPEC-INT-066]", () => {
    for (const reportType of ["manager-weekly", "investor-quarterly"] as const) {
      const payload = buildStandardReportPayload(
        { evidenceIds: ["REQ-039"], periodLabel: "2026-Q3", metrics: { value: 1 }, reportType },
        validSlots,
        "2026-07-09T16:00:00+09:00",
      );
      expect(validateStandardReportPayload(payload)).toEqual({ ok: true, errors: [] });
    }
  });
});
