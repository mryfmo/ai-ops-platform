/** 根拠: REQ-007, REQ-008, SPEC-INT-001, SPEC-INT-032, AC-008-1 */
import { describe, expect, it } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import type { AnthropicStructuredClient, StructuredCallOptions } from "@aiops/shared/clients/anthropicClient.js";
import {
  analyzeProjectStatus,
  proposeEscalationIfNeeded,
  type AnalyzerDependencies,
} from "../src/agents/AGT03_analyzer.js";

function depsRaw(raw: unknown): AnalyzerDependencies & { calls: StructuredCallOptions<unknown>[] } {
  const calls: StructuredCallOptions<unknown>[] = [];
  return {
    llmClient: {
      call: async (options: StructuredCallOptions<unknown>) => {
        calls.push(options);
        return {
          value: options.parse(raw),
          model: "mock",
          attempts: 1,
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      },
    } as unknown as AnthropicStructuredClient,
    auditLog: new InMemoryAuditLog(),
    traceId: "trace-agt03",
    calls,
  };
}

function deps(reason_ja: unknown, reason_en: unknown) {
  return depsRaw({ reason_ja, reason_en });
}

const trigger = {
  currentSeverity: "medium" as const,
  impactDescription: "納期遅延のおそれがある",
  affectedOrganizationIds: ["ORG-A", "ORG-B"],
};

describe("AGT-03 DI結線 [REQ-007, REQ-008, SPEC-INT-001]", () => {
  it("SPEC-INT-032: ステータス数値は決定的コードだけで算出する", () => {
    expect(
      analyzeProjectStatus({
        projectId: "PJ-101",
        selfStatus: "green",
        startDate: "2026-01-01",
        endDate: "2026-01-11",
        asOfDate: "2026-01-06",
        progressPct: 35,
        highSeverityOpenIssueCount: 0,
        overdueActionCount: 0,
      }),
    ).toEqual({
      projectId: "PJ-101",
      machineColor: "red",
      selfColor: "green",
      diverges: true,
      planLinePct: 50,
      gapPoints: -15,
    });
  });

  it("REQ-008: トリガー非該当ならLLMを呼ばず提案しない", async () => {
    const dependencies = deps("unused", "unused");

    await expect(
      proposeEscalationIfNeeded({ ...trigger, affectedOrganizationIds: ["ORG-A"] }, "ISS-001", dependencies),
    ).resolves.toEqual({ proposed: false });
    expect(await dependencies.auditLog.readAll()).toHaveLength(0);
  });

  it("AC-008-1: 理由文だけをLLMから採用し、根拠付きで追記監査する", async () => {
    const dependencies = deps(
      "複数組織の納期に影響するためです。",
      "The delivery schedule affects multiple organizations.",
    );

    await expect(proposeEscalationIfNeeded(trigger, "ISS-001", dependencies)).resolves.toEqual({
      proposed: true,
      reasonJa: "複数組織の納期に影響するためです。",
      reasonEn: "The delivery schedule affects multiple organizations.",
    });
    expect(await dependencies.auditLog.readAll()).toEqual([
      expect.objectContaining({
        trace_id: "trace-agt03",
        actor: "AGT-03",
        action: "propose_escalation",
        basis: "REQ-008 AC-008-1",
        detail: expect.objectContaining({ issueId: "ISS-001", reason_ja: "複数組織の納期に影響するためです。" }),
      }),
    ]);
    expect(dependencies.calls[0]).toMatchObject({
      agent: "AGT-03",
      purpose: "severity_escalation_reason",
      maxAttempts: 2,
      user: expect.stringContaining("納期遅延のおそれがある"),
      inputSchema: expect.objectContaining({ required: ["reason_ja", "reason_en"] }),
    });
    expect(dependencies.calls[0]).not.toHaveProperty("allowEscalation", true);
  });

  it("SPEC-INT-001: LLMが架空数値だけを返しても理由文にも監査ログにも採用しない", async () => {
    const dependencies = deps("影響額は９９９億円です。", "The impact is 999 billion dollars.");
    const outcome = await proposeEscalationIfNeeded(trigger, "ISS-001", dependencies);

    expect(outcome.proposed).toBe(true);
    expect(outcome.reasonJa).toBe("影響記述が重要度引き上げ条件に合致し、複数組織への影響が確認されたためです。");
    expect(outcome.reasonEn).toBe(
      "The described impact meets the escalation condition and affects multiple organizations.",
    );
    const audit = await dependencies.auditLog.readAll();
    expect(audit[0]?.detail).toMatchObject({
      fallbackApplied: true,
      affectsMultipleOrganizations: true,
      matchedKeywords: expect.any(Array),
      reason_ja: outcome.reasonJa,
    });
    expect(JSON.stringify(audit)).not.toContain("９９９");
    expect(JSON.stringify(audit)).not.toContain("999");
  });

  it("SPEC-INT-001: 漢数字数量表現を返却・監査から除去する", async () => {
    const quantities = "懸念は一つです。課題は四つです。四つの対応があります。四箇所に影響します。";
    const dependencies = deps(`${quantities}安全な理由です。`, "Safe reason.");

    const outcome = await proposeEscalationIfNeeded(trigger, "ISS-CJK-NUM", dependencies);
    const audit = JSON.stringify(await dependencies.auditLog.readAll());

    expect(outcome.reasonJa).toBe("安全な理由です。");
    for (const quantity of ["一つ", "四つ", "四つの", "四箇所"]) {
      expect(JSON.stringify(outcome)).not.toContain(quantity);
      expect(audit).not.toContain(quantity);
    }
  });

  it("SPEC-INT-001: 助数詞付き漢数字を返却・監査から除去し、通常語は保持する", async () => {
    const quantities =
      "遅延は二週間です。第三段階です。一度確認します。三冊あります。二部署です。四チームです。一秒です。";
    const safeTerms = "一時的な対応で一件落着し、一人前として四日市との調整を進めます。";
    const dependencies = deps(`${quantities}${safeTerms}`, "Safe reason.");

    const outcome = await proposeEscalationIfNeeded(trigger, "ISS-CJK-COUNTERS", dependencies);
    const audit = JSON.stringify(await dependencies.auditLog.readAll());

    expect(outcome.reasonJa).toBe(safeTerms);
    for (const quantity of ["二週間", "第三段階", "一度", "三冊", "二部署", "四チーム", "一秒"]) {
      expect(JSON.stringify(outcome)).not.toContain(quantity);
      expect(audit).not.toContain(quantity);
    }
  });

  it("SPEC-INT-001: 月・序数・比較を含む漢数字数量を返却・監査から除去する", async () => {
    const quantities =
      "三ヶ月継続します。三か月必要です。三箇月です。二十営業日です。第五四半期です。第三号です。二点です。三種類です。四以上です。三番目です。三ページです。三拠点です。三ほどです。十分が経過しました。一人前を用意します。所要時間は十分です。料理は約一人前です。卌件です。弌件です。";
    const safeTerms =
      "一方で十分かつ万全な体制を整え、万一に備えて八百屋と一時的に調整し、一件落着後は一人前として四日市との調整を担当します。";
    const dependencies = deps(`${quantities}${safeTerms}`, "Safe reason.");

    const outcome = await proposeEscalationIfNeeded(trigger, "ISS-CJK-EXTENDED", dependencies);
    const audit = JSON.stringify(await dependencies.auditLog.readAll());

    expect(outcome.reasonJa).toBe(safeTerms);
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
      expect(JSON.stringify(outcome)).not.toContain(quantity);
      expect(audit).not.toContain(quantity);
    }
  });

  it("REQ-032 / SPEC-INT-001: secret形状の影響記述とLLM出力を送信・返却・監査しない", async () => {
    const inputSecret = `sk-ant-${"a".repeat(24)}`;
    const outputSecret = `ghp_${"b".repeat(24)}`;
    const dependencies = deps(`安全な理由です。${outputSecret}`, `Safe reason. ${outputSecret}`);
    const outcome = await proposeEscalationIfNeeded(
      { ...trigger, impactDescription: `納期遅延のおそれ。${inputSecret}` },
      "ISS-SECRET",
      dependencies,
    );

    expect(dependencies.calls[0]?.user).not.toContain(inputSecret);
    expect(dependencies.calls[0]?.user).toContain("***REDACTED:anthropic_api_key***");
    expect(JSON.stringify(outcome)).not.toContain(outputSecret);
    expect(JSON.stringify(await dependencies.auditLog.readAll())).not.toContain(outputSecret);
    expect(JSON.stringify(await dependencies.auditLog.readAll())).not.toContain(inputSecret);
  });

  it("REQ-032 / SPEC-INT-001: compatibility secretの正規形も送信・返却・監査せず監査を完了する", async () => {
    const inputSecret = `ｓｋ－ａｎｔ－${"a".repeat(24)}`;
    const outputSecret = `ｇｈｐ＿${"b".repeat(24)}`;
    const dependencies = deps(`安全な理由です。${outputSecret}`, `Safe reason. ${outputSecret}`);

    const outcome = await proposeEscalationIfNeeded(
      { ...trigger, impactDescription: `納期遅延のおそれ。${inputSecret}` },
      "ISS-COMPAT-SECRET",
      dependencies,
    );

    const inputCanonical = inputSecret.normalize("NFKC");
    const outputCanonical = outputSecret.normalize("NFKC");
    expect(dependencies.calls[0]?.user).not.toContain(inputSecret);
    expect(dependencies.calls[0]?.user).not.toContain(inputCanonical);
    expect(dependencies.calls[0]?.user).toContain("***REDACTED:anthropic_api_key***");
    expect(JSON.stringify(outcome)).not.toContain(outputSecret);
    expect(JSON.stringify(outcome)).not.toContain(outputCanonical);
    const audit = JSON.stringify(await dependencies.auditLog.readAll());
    expect(audit).not.toContain(inputSecret);
    expect(audit).not.toContain(inputCanonical);
    expect(audit).not.toContain(outputSecret);
    expect(audit).not.toContain(outputCanonical);
  });

  it.each([
    ["nonobject", null],
    ["array", [{ reason_ja: "安全です。", reason_en: "Safe." }]],
  ])("SPEC-INT-001 / REQ-008: %s理由出力をruntime parserで拒否する", async (_name, raw) => {
    const dependencies = depsRaw(raw);
    await expect(proposeEscalationIfNeeded(trigger, "ISS-001", dependencies)).rejects.toThrow("E-GEN01");
    expect(await dependencies.auditLog.readAll()).toEqual([]);
  });

  it("SPEC-INT-001 / REQ-008: malformed理由出力はruntime parseでfail closedにする", async () => {
    const dependencies = deps("安全な理由です。", null);
    await expect(proposeEscalationIfNeeded(trigger, "ISS-001", dependencies)).rejects.toThrow("E-GEN01");
    expect(await dependencies.auditLog.readAll()).toEqual([]);
  });
});
