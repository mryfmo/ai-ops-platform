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
import { PgAuditLog, PgCostGuard, type PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../../src/server/personaResolver";
import { handleChat, type ChatHandlerDeps } from "../../src/server/chat/chatHandler";
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

const devopsManager: ResolvedPersona = {
  domain: "devops",
  profile: "PRF-G",
  visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
};

const testModelConfig = {
  modelName: "claude-sonnet-4-6",
  pricingUsdPerMtok: { "claude-sonnet-4-6": { input: 3, output: 15 } },
};

function handleTestChat(
  deps: Omit<ChatHandlerDeps, "modelName" | "pricingUsdPerMtok"> &
    Partial<Pick<ChatHandlerDeps, "modelName" | "pricingUsdPerMtok">>,
): Promise<Response> {
  return handleChat({ ...testModelConfig, ...deps });
}
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
    const res = await handleTestChat({
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
    const res = await handleTestChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([]),
      languageModel: mockTextModel("hello"),
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });
    expect(res.status).toBe(403);
  });

  it("改ざんした選択ペルソナを403にする [REQ-041 / SPEC-INT-068]", async () => {
    const res = await handleTestChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      selectedPersona: "devops:PRF-G",
      languageModel: mockTextModel("hello"),
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });
    expect(res.status).toBe(403);
  });
});

describe("handleChat（ANTHROPIC_API_KEY未設定時503）", () => {
  it("languageModelがundefinedの場合503とチャット利用不可メッセージを返す", async () => {
    const res = await handleTestChat({
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
    const res = await handleTestChat({
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
  it("ダッシュボードと同じ選択ペルソナをchat promptへ反映する [REQ-041 / SPEC-INT-068]", async () => {
    let prompt = "";
    const model = new MockLanguageModelV2({
      doStream: async (options) => {
        prompt = JSON.stringify(options.prompt);
        return mockTextModel("ok").doStream(options);
      },
    });
    const res = await handleTestChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive, devopsManager]),
      selectedPersona: "devops:PRF-G",
      languageModel: model,
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });
    await res.text();
    expect(prompt).toContain("DevOps PRF-G");
    expect(prompt).not.toContain("PrjOps PRF-04");
  });

  it("PRF-04ペルソナでテキスト応答をストリーミングする（200・本文にUIMessageストリームを含む）", async () => {
    const res = await handleTestChat({
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

    const res = await handleTestChat({
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
    const res = await handleTestChat({
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

describe("handleChat costGuard reservation and configured pricing [SPEC-INT-060]", () => {
  it("unknown fallbackはaudit sink未注入なら予約前にfail-closedする [SPEC-INT-060]", async () => {
    const query = vi.fn();
    const res = await handleTestChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: mockTextModel("unused"),
      costGuard: new PgCostGuard({ query }),
      pricingUsdPerMtok: { "known-model": { input: 7, output: 35 } },
      messages: userMessage("こんにちは"),
      modelName: "unknown-model",
    });

    expect(res.status).toBe(500);
    expect(query).not.toHaveBeenCalled();
  });

  it("unknown fallbackはaudit append失敗時も予約前にfail-closedする [SPEC-INT-060]", async () => {
    const query = vi.fn();
    const append = vi.fn().mockRejectedValue(new Error("audit unavailable"));
    const res = await handleTestChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: mockTextModel("unused"),
      costGuard: new PgCostGuard({ query }),
      auditLog: { append, readAll: vi.fn() },
      traceIdProvider: () => "550e8400-e29b-41d4-a716-446655440000",
      pricingUsdPerMtok: { "known-model": { input: 7, output: 35 } },
      messages: userMessage("こんにちは"),
      modelName: "unknown-model",
    });

    expect(res.status).toBe(500);
    expect(append).toHaveBeenCalledOnce();
    expect(query).not.toHaveBeenCalled();
  });

  it("未知モデルの保守的料金をwarn監査し、実UUIDをPostgreSQL境界へ渡す [SPEC-INT-060]", async () => {
    const traceId = "550e8400-e29b-41d4-a716-446655440000";
    const queries: Array<{ text: string; params: unknown[] | undefined }> = [];
    const db: PgQueryable = {
      query: vi.fn(async (text: string, params?: unknown[]) => {
        queries.push({ text, params });
        if (text.includes("RETURNING log_id")) return { rows: [{ log_id: "7" }] };
        if (text.includes("RETURNING usage_id")) return { rows: [{ usage_id: "99" }] };
        return { rows: [{ total: 0 }] };
      }),
    };

    const res = await handleTestChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([devopsManager]),
      selectedPersona: "devops:PRF-G",
      languageModel: mockTextModel("表示を切り替えました。"),
      costGuard: new PgCostGuard(db),
      auditLogForDomain: (domain) => new PgAuditLog(db, domain === "devops" ? "devops_1y" : "prjops_5y"),
      traceIdProvider: () => traceId,
      pricingUsdPerMtok: { "known-model": { input: 7, output: 35 } },
      messages: userMessage("こんにちは"),
      modelName: "unknown-model",
    });
    expect(res.status).toBe(200);
    await res.text();

    const auditCall = queries.find((q) => q.text.includes("INSERT INTO audit_log"));
    expect(auditCall?.params?.[0]).toBe("devops_1y");
    expect(auditCall?.params?.[1]).toBe(traceId);
    expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(auditCall?.params?.[3]).toBe("llm_unknown_model_pricing_fallback");
    expect(JSON.parse(String(auditCall?.params?.[5]))).toMatchObject({
      severity: "warn",
      model: "unknown-model",
      applied_price_usd_per_mtok: { input: 7, output: 35 },
    });
  });

  it("known modelは監査せず、ストリーミング前予約と完了後照合を行う [SPEC-INT-060]", async () => {
    const queries: Array<{ text: string; params: unknown[] | undefined }> = [];
    const db: PgQueryable = {
      query: vi.fn(async (text: string, params?: unknown[]) => {
        queries.push({ text, params });
        if (text.includes("RETURNING usage_id")) return { rows: [{ usage_id: "99" }] };
        return { rows: [{ total: 0 }] };
      }),
    };
    const res = await handleTestChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: mockTextModel("表示を切り替えました。"),
      costGuard: new PgCostGuard(db),
      auditLog: new PgAuditLog(db, "prjops_5y"),
      traceIdProvider: () => "550e8400-e29b-41d4-a716-446655440001",
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
      0,
      0,
    ]);
    const updateCall = queries.find((q) => q.text.includes("UPDATE llm_usage"));
    expect(updateCall!.params).toEqual([
      "99",
      "WEB-CHAT",
      "view_switching",
      "claude-sonnet-4-6",
      expect.any(Number),
      0,
      0,
      expect.any(String),
    ]);
    expect(queries.some((q) => q.text.includes("INSERT INTO audit_log"))).toBe(false);
  });

  it("ストリーム途中エラーでも予約行を残し、未記録にしない [SPEC-INT-060]", async () => {
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

    const res = await handleTestChat({
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

  it("refusal相当のfinishReasonを通常完了として扱わない [SPEC-INT-060]", async () => {
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

    const res = await handleTestChat({
      getSession: sessionWithEmail,
      resolver: resolverWith([prjopsExecutive]),
      languageModel: model,
      costGuard: new PgCostGuard(emptyCostDb()),
      messages: userMessage("こんにちは"),
    });

    await expect(res.text()).rejects.toThrow("E-LLM-REFUSAL");
  });
});
