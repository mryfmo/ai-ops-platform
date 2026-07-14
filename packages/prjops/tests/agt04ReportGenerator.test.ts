/** 根拠: PrjOps:REQ-010, PrjOps:SPEC-INT-031, PrjOps:AC-010-1, DEC-SPEC-007 */
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import type { AnthropicStructuredClient, StructuredCallOptions } from "@aiops/shared/clients/anthropicClient.js";
import { describe, expect, it } from "vitest";
import {
  generateExecutiveConclusionLines,
  generateExecutiveReport,
  generateProfileNarratives,
  NARRATIVE_SLOTS_BY_PROFILE,
  type NarrativeProfile,
} from "../src/agents/AGT04_reportGenerator.js";

function llmRaw(raw: unknown): AnthropicStructuredClient & { calls: StructuredCallOptions<unknown>[] } {
  const calls: StructuredCallOptions<unknown>[] = [];
  return {
    call: async (options: StructuredCallOptions<unknown>) => {
      calls.push(options);
      return {
        value: options.parse(raw),
        model: "mock",
        attempts: 1,
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    },
    calls,
  } as unknown as AnthropicStructuredClient & { calls: StructuredCallOptions<unknown>[] };
}

const expectedSlots = {
  "PRF-01": ["own_progress_summary", "own_next_action"],
  "PRF-02": ["project_health_summary", "delivery_risk_summary"],
  "PRF-03": ["portfolio_summary", "escalation_summary"],
  "PRF-04": ["executive_summary", "decision_request_summary"],
  "PRF-05": ["investor_highlight", "investor_risk_outlook"],
} as const;

function audit(traceId: string) {
  return { auditLog: new InMemoryAuditLog(), traceId };
}

describe("AGT-04 profile narrative slots [DEC-SPEC-007]", () => {
  it("DEC-SPEC-007: PRF-01..05のexact 10 slotsをdata tableからschema/runtimeへ適用する", async () => {
    expect(NARRATIVE_SLOTS_BY_PROFILE).toEqual(expectedSlots);

    for (const [profile, slots] of Object.entries(expectedSlots)) {
      const client = llmRaw({ [slots[0]]: "状況は安定しています。", [slots[1]]: "対応を継続します。" });
      const result = await generateProfileNarratives(
        client,
        { profile: profile as NarrativeProfile, sourceSummaries: ["根拠情報"] },
        audit(`trace-${profile}`),
      );

      expect(Object.keys(result.slots)).toEqual(slots);
      expect(result.warnings).toEqual([]);
      expect(client.calls[0]?.inputSchema).toMatchObject({
        additionalProperties: false,
        properties: Object.fromEntries(slots.map((slot) => [slot, { type: "string" }])),
      });
      expect(Object.keys((client.calls[0]?.inputSchema as { properties: object }).properties)).toEqual(slots);
    }
  });

  it("DEC-SPEC-007: 許可外slotをruntimeで拒否し監査へも流さない", async () => {
    const evidence = audit("trace-extra");
    await expect(
      generateProfileNarratives(
        llmRaw({ own_progress_summary: "安定しています。", own_next_action: "継続します。", extra: "禁止" }),
        { profile: "PRF-01", sourceSummaries: [] },
        evidence,
      ),
    ).rejects.toThrow("E-GEN01");
    expect(await evidence.auditLog.readAll()).toEqual([]);
  });

  it.each([
    ["ASCII", "架空の99件です。"],
    ["full-width", "架空の９９件です。"],
    ["Arabic-Indic", "架空の٩件です。"],
    ["circled", "架空の⑨件です。"],
    ["CJK", "懸念は三件です。"],
  ])("DEC-SPEC-007: %s数字を含むslot全体を空にしてwarning evidenceを返す", async (_name, value) => {
    const evidence = audit(`trace-number-${_name}`);
    const result = await generateProfileNarratives(
      llmRaw({ project_health_summary: value, delivery_risk_summary: "対応を継続します。" }),
      { profile: "PRF-02", sourceSummaries: [] },
      evidence,
    );

    expect(result.slots).toEqual({ project_health_summary: "", delivery_risk_summary: "対応を継続します。" });
    expect(result.warnings).toEqual([{ slot: "project_health_summary", reason: "number" }]);
    expect(JSON.stringify(await evidence.auditLog.readAll())).not.toContain(value);
  });

  it("DEC-SPEC-007: 入出力secretを漏らさず、出力slotを空にする", async () => {
    const inputSecret = `sk-ant-${"a".repeat(24)}`;
    const outputSecret = `ｇｈｐ＿${"b".repeat(24)}`;
    const evidence = audit("trace-secret");
    const client = llmRaw({ investor_highlight: `安全です。${outputSecret}`, investor_risk_outlook: "注視します。" });
    const result = await generateProfileNarratives(
      client,
      { profile: "PRF-05", sourceSummaries: [`根拠。${inputSecret}`] },
      evidence,
    );

    expect(client.calls[0]?.user).not.toContain(inputSecret);
    expect(client.calls[0]?.user).toContain("***REDACTED:anthropic_api_key***");
    expect(result.slots.investor_highlight).toBe("");
    expect(result.warnings).toEqual([{ slot: "investor_highlight", reason: "secret" }]);
    const visible = JSON.stringify({ result, audit: await evidence.auditLog.readAll() });
    expect(visible).not.toContain(outputSecret);
    expect(visible).not.toContain(outputSecret.normalize("NFKC"));
  });

  it("DEC-SPEC-007: missing/empty slotを空のまま保持し、両方のwarningを監査へ追記する", async () => {
    const evidence = audit("trace-empty");
    const result = await generateProfileNarratives(
      llmRaw({ portfolio_summary: "  " }),
      { profile: "PRF-03", sourceSummaries: [] },
      evidence,
    );

    expect(result.slots).toEqual({ portfolio_summary: "", escalation_summary: "" });
    expect(result.warnings).toEqual([
      { slot: "portfolio_summary", reason: "empty" },
      { slot: "escalation_summary", reason: "missing" },
    ]);
    expect(await evidence.auditLog.readAll()).toEqual([
      expect.objectContaining({
        action: "narrative_slot_warning",
        basis: "DEC-SPEC-007",
        detail: { profile: "PRF-03", warnings: result.warnings },
      }),
    ]);
  });

  it("DEC-SPEC-007: warning監査に失敗した場合は結果を返さずfail closedにする", async () => {
    await expect(
      generateProfileNarratives(
        llmRaw({ portfolio_summary: "" }),
        { profile: "PRF-03", sourceSummaries: [] },
        {
          traceId: "trace-audit-failure",
          auditLog: {
            append: async () => {
              throw new Error("audit unavailable");
            },
            readAll: async () => [],
          },
        },
      ),
    ).rejects.toThrow("audit unavailable");
  });

  it.each([null, [], "invalid"])("DEC-SPEC-007: non-object tool outputをruntimeで拒否する", async (raw) => {
    await expect(
      generateProfileNarratives(llmRaw(raw), { profile: "PRF-01", sourceSummaries: [] }, audit("trace-invalid")),
    ).rejects.toThrow("E-GEN01");
  });

  it("DEC-SPEC-007: 旧executive入口もlinesを生成せずPRF-04の2 slotsだけを使う", async () => {
    const client = llmRaw({ executive_summary: "全体を注視します。", decision_request_summary: "判断を求めます。" });
    const result = await generateExecutiveConclusionLines(
      client,
      { colorDistribution: { green: 4, yellow: 2, red: 1 }, topRiskProjectSummaries: ["納期上の懸念あり"] },
      audit("trace-executive"),
    );

    expect(result).toEqual({
      conclusionLines: ["全体を注視します。", "判断を求めます。", ""],
      warnings: [],
    });
    expect(Object.keys((client.calls[0]?.inputSchema as { properties: object }).properties)).toEqual(
      expectedSlots["PRF-04"],
    );
    expect(client.calls[0]?.inputSchema).not.toHaveProperty("properties.lines");
  });

  it("PrjOps:AC-010-1: LLMの無効文章を捨て、コード算出した色別数値を維持する", async () => {
    const html = await generateExecutiveReport(
      llmRaw({ executive_summary: "架空の999件です。", decision_request_summary: "判断を求めます。" }),
      {
        reportId: "RPT-PRF-04-2026-M07",
        periodLabel: "2026年7月",
        generatedAtLabel: "2026-07-13",
        dataSnapshotLabel: "2026-07-12",
        lang: "ja",
        contactLine: "PrjOps運用窓口",
      },
      { colorDistribution: { green: 4, yellow: 2, red: 1 }, topRiskProjectSummaries: [] },
      [],
      "前月比は安定",
      audit("trace-report"),
    );

    expect(html).toContain('data-src="portfolio#color_green_count">4</span>');
    expect(html).toContain('data-src="portfolio#color_yellow_count">2</span>');
    expect(html).toContain('data-src="portfolio#color_red_count">1</span>');
    expect(html).not.toContain("999");
  });
});
