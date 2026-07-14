import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { InMemoryAuditLog } from "../src/auditLog.js";
import {
  buildStandardReportPayload,
  buildStandardReportPayloadFromMetrics,
  countChars,
  createReportSlotsToolSchema,
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
  constructor(private readonly outputs: unknown[]) {}

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

const tsxImport = createRequire(import.meta.url).resolve("tsx");

function runReportingCli(
  script: "calculateReportMetrics.ts" | "finalizeReportJson.ts",
  args: string[] = [],
  env: NodeJS.ProcessEnv = {},
  cwd = process.cwd(),
): string {
  const { REPORT_COMPLETED: _completed, REPORT_BLOCKED: _blocked, ...cleanEnv } = process.env;
  return execFileSync(
    process.execPath,
    ["--import", tsxImport, resolve(process.cwd(), "src/reporting", script), ...args],
    { cwd, env: { ...cleanEnv, ...env }, encoding: "utf8" },
  );
}

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
    expect(payload.schemaVersion).toBe("standard-report.v2");
    expect(payload.metrics.completed).toEqual({
      value: 3,
      source: "code:standard-report-generator:completed",
      as_of: "2026-07-09T16:00:00+09:00",
    });
    expect(renderEvidenceHeader(payload.evidenceIds)).toContain("REQ-040");
  });

  it("measured 0とunavailableを別契約として受理する [DEC-SPEC-007]", () => {
    const base = buildStandardReportPayload(
      { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: { completed: 0 } },
      validSlots,
      "2026-07-09T16:00:00+09:00",
    );
    const unavailable = {
      ...base,
      metrics: {
        completed: {
          value: null,
          unavailable_reason: "missing_current",
          source: "snapshot:completed",
          as_of: "2026-07-09T16:00:00+09:00",
        },
      },
    };

    expect(validateStandardReportPayload(base)).toEqual({ ok: true, errors: [] });
    expect(validateStandardReportPayload(unavailable)).toEqual({ ok: true, errors: [] });
    expect(base.metrics.completed).not.toEqual(unavailable.metrics.completed);
  });

  it.each(["missing_current", "missing_previous", "scope_mismatch", "source_error"] as const)(
    "exact unavailable_reason=%sを受理する [DEC-SPEC-007]",
    (unavailable_reason) => {
      const payload = {
        ...buildStandardReportPayload(
          { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: {} },
          validSlots,
          "2026-07-09T16:00:00Z",
        ),
        metrics: {
          completed: {
            value: null,
            unavailable_reason,
            source: "snapshot:completed",
            as_of: "2026-07-09T16:00:00Z",
          },
        },
      };
      expect(validateStandardReportPayload(payload)).toEqual({ ok: true, errors: [] });
    },
  );

  it.each([
    ["NaN", { value: Number.NaN, source: "snapshot:completed", as_of: "2026-07-09T16:00:00Z" }],
    ["Infinity", { value: Number.POSITIVE_INFINITY, source: "snapshot:completed", as_of: "2026-07-09T16:00:00Z" }],
    ["missing reason", { value: null, source: "snapshot:completed", as_of: "2026-07-09T16:00:00Z" }],
    [
      "invalid reason",
      { value: null, unavailable_reason: "unknown", source: "snapshot:completed", as_of: "2026-07-09T16:00:00Z" },
    ],
    ["missing source", { value: 1, as_of: "2026-07-09T16:00:00Z" }],
    ["blank source", { value: 1, source: " ", as_of: "2026-07-09T16:00:00Z" }],
    ["padded source", { value: 1, source: " snapshot:completed ", as_of: "2026-07-09T16:00:00Z" }],
    ["missing as_of", { value: 1, source: "snapshot:completed" }],
    ["non-ISO as_of", { value: 1, source: "snapshot:completed", as_of: "2026-07-09" }],
    ["invalid ISO calendar date", { value: 1, source: "snapshot:completed", as_of: "2026-02-30T16:00:00Z" }],
    [
      "unknown metric key",
      { value: 1, source: "snapshot:completed", as_of: "2026-07-09T16:00:00Z", label: "not allowed" },
    ],
  ])("invalid metric evidenceを拒否する: %s [DEC-SPEC-007]", (_caseName, metric) => {
    const payload = {
      ...buildStandardReportPayload(
        { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: {} },
        validSlots,
        "2026-07-09T16:00:00Z",
      ),
      metrics: { completed: metric },
    };
    expect(validateStandardReportPayload(payload).ok).toBe(false);
  });

  it("unknown top-level/period keyを拒否する [DEC-SPEC-007]", () => {
    const payload = buildStandardReportPayload(
      { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: { completed: 1 } },
      validSlots,
      "2026-07-09T16:00:00Z",
    );
    expect(validateStandardReportPayload({ ...payload, html: "<b>unsafe</b>" }).ok).toBe(false);
    expect(
      validateStandardReportPayload({ ...payload, period: { ...payload.period, url: "https://invalid" } }).ok,
    ).toBe(false);
  });

  it.each(["not-iso", "2026-07-09", "2026-02-30T16:00:00Z"])(
    "period.generatedAtの非ISO日時を拒否する: %s [DEC-SPEC-007]",
    (generatedAt) => {
      const payload = buildStandardReportPayload(
        { evidenceIds: ["REQ-040"], periodLabel: "2026-W28", metrics: {} },
        validSlots,
        generatedAt,
      );
      expect(validateStandardReportPayload(payload).errors).toContain(
        "period.generatedAt must be an ISO-8601 date-time with timezone",
      );
    },
  );

  it("JSON schemaもperiod.generatedAtをdate-timeに制約する [DEC-SPEC-007]", async () => {
    const { STANDARD_REPORT_JSON_SCHEMA } = await import("../src/reporting/reportSchema.js");
    expect(STANDARD_REPORT_JSON_SCHEMA.properties.period.properties.generatedAt).toMatchObject({
      type: "string",
      format: "date-time",
    });
  });

  it("build pathはコード由来unavailable metricを変更せず保持する [DEC-SPEC-007]", () => {
    const unavailable = {
      value: null,
      unavailable_reason: "missing_current",
      source: "env:REPORT_COMPLETED",
      as_of: "2026-07-09T16:00:00Z",
    } as const;
    const payload = buildStandardReportPayloadFromMetrics(
      {
        evidenceIds: ["REQ-040"],
        periodLabel: "2026-W28",
        metrics: { completed: unavailable },
      },
      validSlots,
      "2026-07-09T16:00:00Z",
    );
    expect(payload.metrics.completed).toEqual(unavailable);
    expect(validateStandardReportPayload(payload)).toEqual({ ok: true, errors: [] });
  });

  it("calculate CLIは欠損値をunavailable、明示0をmeasuredとして出力する [DEC-SPEC-007]", () => {
    const asOf = "2026-07-09T16:00:00Z";
    const missing = JSON.parse(runReportingCli("calculateReportMetrics.ts", [], { REPORT_AS_OF: asOf }));
    expect(missing.completed).toEqual({
      value: null,
      unavailable_reason: "missing_current",
      source: "env:REPORT_COMPLETED",
      as_of: asOf,
    });
    const measured = JSON.parse(
      runReportingCli("calculateReportMetrics.ts", [], { REPORT_COMPLETED: "0", REPORT_AS_OF: asOf }),
    );
    expect(measured.completed).toEqual({
      value: 0,
      source: "env:REPORT_COMPLETED",
      as_of: asOf,
    });
  });

  it("calculate→finalize CLIはunavailable evidenceを保持しLLM slotsからmetricsを受けない [DEC-SPEC-007]", () => {
    const workDir = mkdtempSync(resolve(tmpdir(), "reporting-cli-"));
    try {
      const asOf = "2026-07-09T16:00:00Z";
      const metricsPath = resolve(workDir, "metrics.json");
      const slotsPath = resolve(workDir, "slots.json");
      writeFileSync(metricsPath, runReportingCli("calculateReportMetrics.ts", [], { REPORT_AS_OF: asOf }));
      writeFileSync(slotsPath, JSON.stringify(validSlots));
      const payload = JSON.parse(
        runReportingCli(
          "finalizeReportJson.ts",
          [slotsPath, metricsPath],
          { PERIOD_LABEL: "2026-W28", REPORT_GENERATED_AT: asOf },
          workDir,
        ),
      );
      expect(payload.metrics.completed).toEqual({
        value: null,
        unavailable_reason: "missing_current",
        source: "env:REPORT_COMPLETED",
        as_of: asOf,
      });
      expect(payload.slots).toEqual(validSlots);
      expect(validateStandardReportPayload(payload)).toEqual({ ok: true, errors: [] });
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("finalize CLIはlegacy numeric metricsを証拠付きへ再ラップしない [DEC-SPEC-007]", () => {
    const workDir = mkdtempSync(resolve(tmpdir(), "reporting-cli-legacy-"));
    try {
      const metricsPath = resolve(workDir, "metrics.json");
      const slotsPath = resolve(workDir, "slots.json");
      writeFileSync(metricsPath, JSON.stringify({ completed: 0 }));
      writeFileSync(slotsPath, JSON.stringify(validSlots));
      const result = spawnSync(
        process.execPath,
        ["--import", tsxImport, resolve(process.cwd(), "src/reporting/finalizeReportJson.ts"), slotsPath, metricsPath],
        {
          cwd: workDir,
          env: {
            ...process.env,
            PERIOD_LABEL: "2026-W28",
            REPORT_GENERATED_AT: "2026-07-09T16:00:00Z",
          },
          encoding: "utf8",
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/legacy numeric metric/);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("legacy v1 numeric metricsを推測変換せず明示的に拒否する [DEC-SPEC-007]", () => {
    const legacy = {
      schemaVersion: "standard-report.v1",
      reportType: "weekly-summary",
      evidenceIds: ["REQ-040"],
      period: { label: "2026-W28", generatedAt: "2026-07-09T16:00:00Z" },
      metrics: { completed: 0 },
      slots: validSlots,
    };
    expect(validateStandardReportPayload(legacy)).toEqual({
      ok: false,
      errors: expect.arrayContaining([expect.stringMatching(/legacy.*v1.*unsupported/i)]),
    });
  });

  it("LLM slots境界はmetricsとunknown keyを受理しない [DEC-SPEC-007]", () => {
    expect(createReportSlotsToolSchema()).not.toHaveProperty("properties.metrics");
    expect(() => parseReportSlots({ ...validSlots, metrics: { completed: 99 } })).toThrow(/E-RPT01/);
  });

  it("DI clientがparseを無視してmetricsを返しても両試行後にfail-closedする [DEC-SPEC-007]", async () => {
    const injected = { ...validSlots, metrics: { completed: 99 } };
    const client = new StubReportClient([injected, injected]);
    await expect(
      generateReportSlots({
        traceId: "trace-injected-metrics",
        actor: "AGT-04",
        client,
        evidenceIds: ["REQ-040"],
        periodLabel: "2026-W28",
        metrics: { completed: 1 },
      }),
    ).rejects.toThrow(/E-RPT01|invalid report slots/);
    expect(client.callCount).toBe(2);
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

  it("LLM呼出し前に非finite metricを拒否する [DEC-SPEC-007]", async () => {
    const client = new StubReportClient([validSlots]);
    await expect(
      generateReportSlots({
        traceId: "trace-invalid-metric",
        actor: "AGT-04",
        client,
        evidenceIds: ["REQ-040"],
        periodLabel: "2026-W28",
        metrics: { completed: Number.NaN },
      }),
    ).rejects.toThrow(/E-RPT05/);
    expect(client.callCount).toBe(0);
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
