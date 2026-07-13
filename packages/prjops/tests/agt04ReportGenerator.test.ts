/** 根拠: REQ-010, SPEC-INT-031, AC-010-1 */
import { describe, expect, it } from "vitest";
import type { AnthropicStructuredClient, StructuredCallOptions } from "@aiops/shared/clients/anthropicClient.js";
import { generateExecutiveConclusionLines, generateExecutiveReport } from "../src/agents/AGT04_reportGenerator.js";

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

function llm(lines: unknown) {
  return llmRaw({ lines });
}

const narrativeInput = {
  colorDistribution: { green: 4, yellow: 2, red: 1 },
  topRiskProjectSummaries: ["納期上の懸念あり"],
};

describe("AGT-04 DI結線 [REQ-010, SPEC-INT-031, AC-010-1]", () => {
  it("SPEC-INT-031: 数値を含む文だけを除去し、安全な文章を残す", async () => {
    const result = await generateExecutiveConclusionLines(
      llm(["全体は安定しています。架空の99件があります。", "重点課題を確認します。", "対応を継続します。"]),
      narrativeInput,
    );

    expect(result).toEqual(["全体は安定しています。", "重点課題を確認します。", "対応を継続します。"]);
    expect(JSON.stringify(result)).not.toContain("99");
  });

  it("SPEC-INT-031: 漢数字数量表現を結論返却から除去する", async () => {
    const result = await generateExecutiveConclusionLines(
      llm(["懸念は一つです。安全です。", "課題は四つです。四つの対応があります。", "四箇所に影響します。"]),
      narrativeInput,
    );

    expect(result[0]).toBe("安全です。");
    for (const quantity of ["一つ", "四つ", "四つの", "四箇所"]) {
      expect(result.join("")).not.toContain(quantity);
    }
  });

  it("SPEC-INT-031: 助数詞付き漢数字を結論返却から除去し、通常語は保持する", async () => {
    const safeTerms = "一時的な対応で一件落着し、一人前として四日市との調整を進めます。";
    const result = await generateExecutiveConclusionLines(
      llm([
        `遅延は二週間です。第三段階です。${safeTerms}`,
        "一度確認します。三冊あります。二部署です。",
        "四チームです。一秒です。",
      ]),
      narrativeInput,
    );

    expect(result[0]).toBe(safeTerms);
    for (const quantity of ["二週間", "第三段階", "一度", "三冊", "二部署", "四チーム", "一秒"]) {
      expect(result.join("")).not.toContain(quantity);
    }
  });

  it("SPEC-INT-031: 月・序数・比較を含む漢数字数量を結論返却から除去する", async () => {
    const safeTerms =
      "一方で十分かつ万全な体制を整え、万一に備えて八百屋と一時的に調整し、一件落着後は一人前として四日市との調整を担当します。";
    const result = await generateExecutiveConclusionLines(
      llm([
        `三ヶ月継続します。三か月必要です。三箇月です。${safeTerms}`,
        "二十営業日です。第五四半期です。第三号です。",
        "二点です。三種類です。四以上です。三番目です。三ページです。三拠点です。三ほどです。十分が経過しました。一人前を用意します。所要時間は十分です。料理は約一人前です。卌件です。弌件です。",
      ]),
      narrativeInput,
    );

    expect(result[0]).toBe(safeTerms);
    for (const quantity of [
      "三ヶ月",
      "三か月",
      "三箇月",
      "二十営業日",
      "第五四半期",
      "第三号",
      "二点",
      "三種類",
      "四以上",
      "三番目",
      "三ページ",
      "三拠点",
      "三ほど",
      "十分が経過",
      "一人前を用意",
      "所要時間は十分です",
      "料理は約一人前です",
      "卌件",
      "弌件",
    ]) {
      expect(result.join("")).not.toContain(quantity);
    }
  });

  it("SPEC-INT-031: LLMの行数不足時は固定文で補完する", async () => {
    await expect(generateExecutiveConclusionLines(llm(["懸念を確認しています。"]), narrativeInput)).resolves.toEqual([
      "懸念を確認しています。",
      "重点課題への対応を進めます。",
      "必要な意思決定を適時行います。",
    ]);
  });

  it.each([
    ["all numeric", ["架空の①件です。", "影響は١件です。", "進捗はⅣです。"]],
    ["mixed empty", ["安全な結論です。架空の99件です。", "", "   "]],
    ["under", ["安全な結論です。"]],
    ["over", ["先頭です。", "次です。", "最後です。", "余分です。"]],
  ])("SPEC-INT-031: %s出力も正確に安全な非空三行へ正規化する", async (_name, lines) => {
    const result = await generateExecutiveConclusionLines(llm(lines), narrativeInput);
    expect(result).toHaveLength(3);
    expect(result.every((line) => line.trim().length > 0)).toBe(true);
    expect(result.join("")).not.toMatch(/\p{N}/u);
    if (_name === "over") expect(result).toEqual(["先頭です。", "次です。", "最後です。"]);
  });

  it("SPEC-INT-031 / REQ-010: structured client契約を渡してparseを実行する", async () => {
    const client = llm(["先頭です。", "次です。", "最後です。"]);
    await generateExecutiveConclusionLines(client, narrativeInput);
    expect(client.calls[0]).toMatchObject({
      agent: "AGT-04",
      purpose: "executive_conclusion",
      maxAttempts: 2,
      user: expect.stringContaining("納期上の懸念あり"),
      inputSchema: expect.objectContaining({ required: ["lines"] }),
    });
    expect(client.calls[0]).not.toHaveProperty("allowEscalation", true);
  });

  it("REQ-032 / SPEC-INT-031: secret形状のsummaryとLLM出力を送信・返却しない", async () => {
    const inputSecret = `sk-ant-${"a".repeat(24)}`;
    const outputSecret = `ghp_${"b".repeat(24)}`;
    const client = llm([`安全です。${outputSecret}`, "重点課題を確認します。", "対応を継続します。"]);
    const result = await generateExecutiveConclusionLines(client, {
      ...narrativeInput,
      topRiskProjectSummaries: [`納期懸念。${inputSecret}`],
    });

    expect(client.calls[0]?.user).not.toContain(inputSecret);
    expect(client.calls[0]?.user).toContain("***REDACTED:anthropic_api_key***");
    expect(JSON.stringify(result)).not.toContain(outputSecret);
  });

  it("REQ-032 / SPEC-INT-031: compatibility secretの正規形も送信・返却しない", async () => {
    const inputSecret = `ｓｋ－ａｎｔ－${"a".repeat(24)}`;
    const outputSecret = `ｇｈｐ＿${"b".repeat(24)}`;
    const client = llm([`安全です。${outputSecret}`, "重点課題を確認します。", "対応を継続します。"]);

    const result = await generateExecutiveConclusionLines(client, {
      ...narrativeInput,
      topRiskProjectSummaries: [`納期懸念。${inputSecret}`],
    });

    expect(client.calls[0]?.user).not.toContain(inputSecret);
    expect(client.calls[0]?.user).not.toContain(inputSecret.normalize("NFKC"));
    expect(client.calls[0]?.user).toContain("***REDACTED:anthropic_api_key***");
    expect(JSON.stringify(result)).not.toContain(outputSecret);
    expect(JSON.stringify(result)).not.toContain(outputSecret.normalize("NFKC"));
  });

  it("SPEC-INT-031: summaryが空ならコード定義の安全な入力fallbackを使う", async () => {
    const client = llm(["全体を注視します。", "重点課題を確認します。", "対応を継続します。"]);
    await generateExecutiveConclusionLines(client, { ...narrativeInput, topRiskProjectSummaries: [] });
    expect(client.calls[0]?.user).toBe("Redプロジェクトの状況: 特筆すべき懸念なし");
  });

  it.each([
    ["nonobject", null],
    ["array", [["安全です。", "確認します。", "継続します。"]]],
  ])("SPEC-INT-031 / REQ-010: %s結論出力をruntime parserで拒否する", async (_name, raw) => {
    await expect(generateExecutiveConclusionLines(llmRaw(raw), narrativeInput)).rejects.toThrow("E-GEN01");
  });

  it("SPEC-INT-031 / REQ-010: malformed結論出力はruntime parseでfail closedにする", async () => {
    await expect(generateExecutiveConclusionLines(llm(["安全です。", null]), narrativeInput)).rejects.toThrow(
      "E-GEN01",
    );
  });

  it("AC-010-1: コード算出した色別数値slotをLLM文章から変更させない", async () => {
    const html = await generateExecutiveReport(
      llm(["全体を注視します。架空の999件です。", "対応を継続します。", "課題を確認します。"]),
      {
        reportId: "RPT-PRF-04-2026-M07",
        periodLabel: "2026年7月",
        generatedAtLabel: "2026-07-13",
        dataSnapshotLabel: "2026-07-12",
        lang: "ja",
        contactLine: "PrjOps運用窓口",
      },
      narrativeInput,
      [],
      "前月比は安定",
    );

    expect(html).toContain('data-src="portfolio#color_green_count">4</span>');
    expect(html).toContain('data-src="portfolio#color_yellow_count">2</span>');
    expect(html).toContain('data-src="portfolio#color_red_count">1</span>');
    expect(html).not.toContain("999");
  });
});
