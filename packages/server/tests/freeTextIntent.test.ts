/**
 * packages/server/tests/freeTextIntent.test.ts
 *
 * 根拠: SPEC-INT-033（定型コマンド不一致の自由文に対するLLM意図解釈フォールバック）
 */
import { describe, it, expect } from "vitest";
import type { AnthropicStructuredClient, StructuredCallOptions, StructuredCallResult } from "@aiops/shared";
import { interpretFreeTextIntent } from "../src/lib/freeTextIntent.js";

function makeMockLlmClient(rawResponse: unknown): {
  client: AnthropicStructuredClient;
  calls: StructuredCallOptions<unknown>[];
} {
  const calls: StructuredCallOptions<unknown>[] = [];
  const client = {
    call: async <T>(opts: StructuredCallOptions<T>): Promise<StructuredCallResult<T>> => {
      calls.push(opts as StructuredCallOptions<unknown>);
      const value = opts.parse(rawResponse);
      return { value, model: "claude-sonnet-4-6", attempts: 1, usage: { input_tokens: 10, output_tokens: 5 } };
    },
  } as unknown as AnthropicStructuredClient;
  return { client, calls };
}

describe("interpretFreeTextIntent (SPEC-INT-033)", () => {
  it("gh_pr_list意図を分類する", async () => {
    const { client } = makeMockLlmClient({
      intent: "gh_pr_list",
      projectId: "PJ-001",
      title: null,
      body: null,
      instruction: null,
    });
    const result = await interpretFreeTextIntent(client, "PJ-001のPR一覧見せて");
    expect(result.intent).toBe("gh_pr_list");
    expect(result.projectId).toBe("PJ-001");
  });

  it("gh_issue_create意図はtitle/bodyを含む", async () => {
    const { client } = makeMockLlmClient({
      intent: "gh_issue_create",
      projectId: "PJ-002",
      title: "バグ報告",
      body: "詳細です",
      instruction: null,
    });
    const result = await interpretFreeTextIntent(client, "PJ-002でバグ報告のIssue作って、詳細です");
    expect(result.intent).toBe("gh_issue_create");
    expect(result.title).toBe("バグ報告");
    expect(result.body).toBe("詳細です");
  });

  it("該当しない自由文はunknownを返す", async () => {
    const { client } = makeMockLlmClient({
      intent: "unknown",
      projectId: null,
      title: null,
      body: null,
      instruction: null,
    });
    const result = await interpretFreeTextIntent(client, "おはようございます");
    expect(result.intent).toBe("unknown");
  });

  it("LLM入力はsanitizeForLlmInputを経由する（シークレットパターンがLLMへ渡らない）", async () => {
    const { client, calls } = makeMockLlmClient({
      intent: "unknown",
      projectId: null,
      title: null,
      body: null,
      instruction: null,
    });
    await interpretFreeTextIntent(client, "token: ghp_abcdefghijklmnopqrst0123 です");
    expect(calls[0]!.user).not.toContain("ghp_abcdefghijklmnopqrst0123");
    expect(calls[0]!.user).toContain("***REDACTED:github_pat***");
  });

  it("zodスキーマに不適合な応答はエラーになる", async () => {
    const { client } = makeMockLlmClient({
      intent: "not_a_valid_intent",
      projectId: null,
      title: null,
      body: null,
      instruction: null,
    });
    await expect(interpretFreeTextIntent(client, "x")).rejects.toThrow();
  });
});
