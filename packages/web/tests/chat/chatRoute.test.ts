/**
 * packages/web/tests/chat/chatRoute.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）/
 *   ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。POST /api/chat の
 *   handleChat（server/chat/chatHandler.ts）を、ai/test の MockLanguageModelV2 で
 *   tool call合成をモックしてテストする（ネットワーク不要）。
 *   未認証401・権限外403・ANTHROPIC_API_KEY未設定時503・コスト超過429を検証する。
 */
import { describe, it, expect, vi } from "vitest";
import type { Session } from "next-auth";
import { MockLanguageModelV2 } from "ai/test";
import type { UIMessage } from "ai";
import { PgCostGuard, type PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleChat } from "../../src/server/chat/chatHandler";
import { buildSystemPrompt } from "../../src/server/chat/systemPrompt";

function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
  return { resolveByEmail: async () => personas };
}

const sessionWithEmail = async (): Promise<Session | null> =>
  ({ user: { email: "exec@example.com" }, expires: "2099-01-01T00:00:00.000Z" }) as Session;

const prjopsExecutive: ResolvedPersona = {
  domain: "prjops",
  profile: "PRF-04",
  visibility: {
    recipientStakeholderId: "STK-EXEC",
    recipientManagedProjectIds: [],
    recipientAssignedProjectIds: [],
    recipientParticipatingProjectIds: [],
    investedProjectIds: [],
  },
};

function emptyCostDb(): PgQueryable {
  return {
    query: vi.fn(async (text: string) => {
      if (text.includes("RETURNING usage_id")) return { rows: [{ usage_id: "1" }] };
      return { rows: [{ total: 0 }] };
    }),
  };
}

function userMessage(text: string): UIMessage[] {
  return [{ id: "m1", role: "user", parts: [{ type: "text", text }] }];
}

/** テキストのみを返すモックモデル（tool呼び出しなし） */
function mockTextModel(text: string): MockLanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "1" });
          controller.enqueue({ type: "text-delta", id: "1", delta: text });
          controller.enqueue({ type: "text-end", id: "1" });
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          });
          controller.close();
        },
      }),
    }),
  });
}

/** showExecutiveSummary tool callを合成するモックモデル */
function mockToolCallModel(): MockLanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({
            type: "tool-call",
            toolCallId: "call_1",
            toolName: "showExecutiveSummary",
            input: "{}",
          });
          controller.enqueue({
            type: "finish",
            finishReason: "tool-calls",
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          });
          controller.close();
        },
      }),
    }),
  });
}

describe("handleChat（未認証401）", () => {
  it("セッションが無い場合401を返す", async () => {
    const res = await handleChat({
      getSession: async () => null,
      resolver: resolverWith([]),
      languageModel: mockTextModel("hello"),
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });
    expect(res.status).toBe(401);
  });
});

describe("handleChat（権限外403）", () => {
  it("該当ペルソナが無い場合403を返す", async () => {
    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([]),
      languageModel: mockTextModel("hello"),
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });
    expect(res.status).toBe(403);
  });
});

describe("handleChat（ANTHROPIC_API_KEY未設定時503）", () => {
  it("languageModelがundefinedの場合503とチャット利用不可メッセージを返す", async () => {
    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: undefined,
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("経営サマリーを見せて"),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("チャット機能は現在利用できません");
  });
});

describe("handleChat（コスト超過429）", () => {
  it("本日の消費が日次上限以上の場合429を返す", async () => {
    const overBudgetDb: PgQueryable = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: mockTextModel("hello"),
      costGuard: new PgCostGuard(overBudgetDb, { dailyLimitUsd: 20 }),
      messages: userMessage("経営サマリーを見せて"),
    });
    expect(res.status).toBe(429);
  });
});

describe("handleChat（正当なセッション: ストリーミング応答）", () => {
  it("PRF-04ペルソナでテキスト応答をストリーミングする（200・本文にUIMessageストリームを含む）", async () => {
    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: mockTextModel("表示を切り替えました。"),
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });
    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
  });

  it("Reasoning UI用にAnthropic thinking providerOptionsを設定し、sendReasoning付きUI streamを返す [REQ-041 / SPEC-INT-068 / AC-041-1]", async () => {
    let seenProviderOptions: unknown;
    let seenTemperature: unknown;
    const model = new MockLanguageModelV2({
      doStream: async (options) => {
        seenProviderOptions = options.providerOptions;
        seenTemperature = options.temperature;
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({ type: "reasoning-start", id: "r1" });
              controller.enqueue({ type: "reasoning-delta", id: "r1", delta: "考えています" });
              controller.enqueue({ type: "reasoning-end", id: "r1" });
              controller.enqueue({
                type: "finish",
                finishReason: "stop",
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: model,
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("経営サマリーを見せて"),
      maxSteps: 2,
      thinkingBudgetTokens: 2048,
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("reasoning");
    expect(seenProviderOptions).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 2048 } },
    });
    expect(seenTemperature).toBeUndefined();
  });

  it("PRF-04ペルソナでshowExecutiveSummary tool callが合成された応答を200で返す", async () => {
    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: mockToolCallModel(),
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("経営サマリーを見せて"),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("showExecutiveSummary");
  });
});

describe("buildSystemPrompt（ADR-0013: ページコンテキスト注入）", () => {
  it("解決済みpersonaとページ状態を含める [REQ-041 / SPEC-INT-068 / AC-041-1]", () => {
    const prompt = buildSystemPrompt(prjopsExecutive, {
      period: "week",
      baseDate: "2026-07-09",
      projectId: "***REDACTED:generic_api_key_kv***",
      currentView: { kind: "timeseries", period: "week" },
    });
    expect(prompt).toContain("PrjOps PRF-04");
    expect(prompt).toContain('"period":"week"');
    expect(prompt).toContain("***REDACTED");
  });
});

describe("handleChat（T26: costGuard予約・照合）", () => {
  it("ストリーミング開始前にllm_usageへ予約し、完了後に実使用量へ照合する", async () => {
    const queries: Array<{ text: string; params: unknown[] | undefined }> = [];
    const db: PgQueryable = {
      query: vi.fn(async (text: string, params?: unknown[]) => {
        queries.push({ text, params });
        if (text.includes("RETURNING usage_id")) return { rows: [{ usage_id: "99" }] };
        return { rows: [{ total: 0 }] };
      }),
    };
    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: mockTextModel("表示を切り替えました。"),
      costGuard: new PgCostGuard(db),
      messages: userMessage("こんにちは"),
      modelName: "claude-sonnet-4-6",
    });
    expect(res.status).toBe(200);
    // ストリームを最後まで消費しないとonFinishが発火しないため、本文を読み切る
    await res.text();

    const insertCall = queries.find((q) => q.text.includes("INSERT INTO llm_usage"));
    expect(insertCall).toBeDefined();
    expect(insertCall!.params).toEqual([
      expect.any(String),
      expect.any(String),
      "WEB-CHAT",
      "view_switching",
      "claude-sonnet-4-6",
      expect.any(Number),
      expect.any(String),
      20,
      null,
    ]);
    const updateCall = queries.find((q) => q.text.includes("UPDATE llm_usage"));
    expect(updateCall!.params).toEqual([
      "99",
      "WEB-CHAT",
      "view_switching",
      "claude-sonnet-4-6",
      expect.any(Number),
      expect.any(String),
    ]);
  });

  it("ストリーム途中エラーでも予約行を残し、未記録にしない [C-3b]", async () => {
    const queries: Array<{ text: string; params: unknown[] | undefined }> = [];
    const db: PgQueryable = {
      query: vi.fn(async (text: string, params?: unknown[]) => {
        queries.push({ text, params });
        if (text.includes("RETURNING usage_id")) return { rows: [{ usage_id: "100" }] };
        return { rows: [{ total: 0 }] };
      }),
    };
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({ type: "error", error: new Error("boom") });
            controller.close();
          },
        }),
      }),
    });

    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: model,
      costGuard: new PgCostGuard(db),
      messages: userMessage("こんにちは"),
      modelName: "claude-sonnet-4-6",
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"type":"error"');
    expect(text).toContain('"finishReason":"error"');
    expect(queries.some((q) => q.text.includes("INSERT INTO llm_usage"))).toBe(true);
    expect(queries.some((q) => q.text.includes("UPDATE llm_usage"))).toBe(false);
  });

  it("refusal相当のfinishReasonを通常完了として扱わない [C-6]", async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({
              type: "finish",
              finishReason: "content-filter",
              usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
            });
            controller.close();
          },
        }),
      }),
    });

    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: model,
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });

    await expect(res.text()).rejects.toThrow("E-LLM-REFUSAL");
  });

  it("finishReason=errorでもproviderMetadataにrefusalがあれば拒否として扱う [C-6/T26-R3]", async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({
              type: "finish",
              finishReason: "error",
              usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
              providerMetadata: { anthropic: { stop_reason: "refusal" } },
            });
            controller.close();
          },
        }),
      }),
    });

    const res = await handleChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: model,
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });

    await expect(res.text()).rejects.toThrow("E-LLM-REFUSAL");
  });
});
