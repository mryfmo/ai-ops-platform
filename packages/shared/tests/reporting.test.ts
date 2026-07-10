import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "../src/auditLog.js";
import {
  buildStandardReportPayload,
  countChars,
  findUngroundedSlotNumbers,
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

  it("metricsのNaN/Infinityを拒否する [SPEC-INT-067]", () => {
    const payload = buildStandardReportPayload(
      {
        evidenceIds: ["REQ-040"],
        periodLabel: "2026-W28",
        metrics: { completed: Number.NaN, blocked: Number.POSITIVE_INFINITY },
      },
      validSlots,
      "2026-07-09T16:00:00+09:00",
    );
    expect(validateStandardReportPayload(payload).ok).toBe(false);
  });

  it("文章スロットにmetricsへ存在しない数値が混入したら拒否する [C-1]", () => {
    const slots = {
      ...validSlots,
      conclusion: "完了は3件ですが、未根拠の99件も記載されています。",
    };
    const findings = findUngroundedSlotNumbers(slots, { completed: 3 });
    expect(findings).toEqual([{ slot: "conclusion", value: "99" }]);
    const payload = buildStandardReportPayload(
      { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: { completed: 3 } },
      slots,
      "2026-07-09T16:00:00+09:00",
    );
    expect(validateStandardReportPayload(payload).errors).toContain(
      "slots.conclusion contains ungrounded numeric value 99",
    );
  });

  it("桁区切り数値はmetricsと同じ値として扱う [C-1/T26-R2]", () => {
    const slots = {
      ...validSlots,
      conclusion: "処理対象は1,500件です。",
    };
    expect(findUngroundedSlotNumbers(slots, { processed: 1500 })).toEqual([]);
  });

  it("期間ラベル全体は除外し、同じ桁の単独数値は拒否する [C-1/T26-R6]", () => {
    const payload = buildStandardReportPayload(
      { evidenceIds: ["REQ-040"], periodLabel: "2026-Q3", metrics: { completed: 1 } },
      { ...validSlots, conclusion: "2026-Q3の進捗は安定しています。3件のインシデントがあります。" },
      "2026-07-09T16:00:00+09:00",
    );
    expect(validateStandardReportPayload(payload).errors).toContain(
      "slots.conclusion contains ungrounded numeric value 3",
    );
  });

  it("週ラベルの年・週番号も単独数値の根拠にしない [C-1/T26-R6]", () => {
    const payload = buildStandardReportPayload(
      { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: { completed: 1 } },
      { ...validSlots, conclusion: "2026-W28の状況です。28件と2026件を未根拠で書いています。" },
      "2026-07-09T16:00:00+09:00",
    );
    const errors = validateStandardReportPayload(payload).errors;
    expect(errors).toContain("slots.conclusion contains ungrounded numeric value 28");
    expect(errors).toContain("slots.conclusion contains ungrounded numeric value 2026");
  });

  it("長さ超過があっても未根拠数値チェックをマスクしない [C-1/T26-R2]", () => {
    const payload = buildStandardReportPayload(
      { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: { processed: 1500 } },
      {
        ...validSlots,
        conclusion: `${"長い説明".repeat(80)}未根拠の9,999件を含みます。`,
      },
      "2026-07-09T16:00:00+09:00",
    );
    const errors = validateStandardReportPayload(payload).errors;
    expect(errors).toContain(`slots.conclusion exceeds ${standardReportSlotMaxChars("conclusion")} chars`);
    expect(errors).toContain("slots.conclusion contains ungrounded numeric value 9,999");
  });

  it("文字数と切詰めは書記素クラスタを割らない [SPEC-INT-067]", () => {
    expect(countChars("🇯🇵👨‍👩‍👧‍👦é")).toBe(3);
    const truncated = truncateReportSlots({
      ...validSlots,
      conclusion: "🇯🇵".repeat(standardReportSlotMaxChars("conclusion") + 1),
    });
    expect(countChars(truncated.slots.conclusion)).toBe(standardReportSlotMaxChars("conclusion"));
    expect(truncated.slots.conclusion).not.toContain("\ud83c…");
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

  it("LLMラッパーはリトライ後も未根拠数値が残るスロットを採用しない [C-1]", async () => {
    const invented = {
      ...validSlots,
      riskSummary: "根拠のない99件のリスクが残っています。",
    };
    const client = new StubReportClient([invented, invented]);
    const auditLog = new InMemoryAuditLog();

    await expect(
      generateReportSlots({
        traceId: "trace-rpt-2",
        actor: "AGT-04",
        client,
        auditLog,
        evidenceIds: ["REQ-040"],
        periodLabel: "2026-W28",
        metrics: { completed: 5 },
      }),
    ).rejects.toThrow("E-RPT04");

    const auditRecords = await auditLog.readAll();
    expect(auditRecords.map((record) => record.action)).toEqual([
      "report_slot_validation_retry",
      "report_slot_numeric_rejected",
    ]);
  });

  it("parseReportSlotsは必須スロット欠落を拒否する [AC-040-1]", () => {
    expect(() => parseReportSlots({ conclusion: "ok" })).toThrow(/E-RPT01/);
  });

  it("AC-040-1: 根拠IDヘッダが空ならE-RPT03で拒否する", () => {
    expect(() => renderEvidenceHeader([])).toThrow(/E-RPT03/);
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
