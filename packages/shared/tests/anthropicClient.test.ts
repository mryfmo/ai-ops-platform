import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import {
  AnthropicRefusalError,
  AnthropicStructuredClient,
  InMemoryCostGuard,
  shouldSendTemperature,
} from "../src/clients/anthropicClient.js";

const schema = {
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
};

function response(content: unknown[], stopReason = "tool_use") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

describe("AnthropicStructuredClient parameter handling [T26]", () => {
  it("claude-opus-4-8 escalation omits temperature while the default model keeps temperature 0", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(response([{ type: "text", text: "not a tool" }], "end_turn"))
      .mockResolvedValueOnce(response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }]));
    const client = new AnthropicStructuredClient(
      { messages: { create } } as unknown as Anthropic,
      new InMemoryCostGuard(),
    );

    const result = await client.call({
      agent: "AGT-02",
      purpose: "free_text_structuring",
      system: "Return a tool.",
      user: "hello",
      toolName: "emit",
      toolDescription: "emit value",
      inputSchema: schema,
      parse: (raw) => raw as { value: string },
      maxAttempts: 1,
      allowEscalation: true,
    });

    expect(result.value).toEqual({ value: "ok" });
    expect(create.mock.calls[0]![0]).toMatchObject({ model: "claude-sonnet-4-6", temperature: 0 });
    expect(create.mock.calls[1]![0]).toMatchObject({ model: "claude-opus-4-8" });
    expect(create.mock.calls[1]![0]).not.toHaveProperty("temperature");
    expect(shouldSendTemperature("claude-opus-4-8")).toBe(false);
  });

  it("stop_reason=refusal is surfaced as AnthropicRefusalError, not E-ING03", async () => {
    const create = vi.fn().mockResolvedValue(response([], "refusal"));
    const client = new AnthropicStructuredClient(
      { messages: { create } } as unknown as Anthropic,
      new InMemoryCostGuard(),
    );

    await expect(
      client.call({
        agent: "AGT-04",
        purpose: "standard_report_slots",
        system: "Return a tool.",
        user: "hello",
        toolName: "emit",
        toolDescription: "emit value",
        inputSchema: schema,
        parse: (raw) => raw as { value: string },
        maxAttempts: 1,
      }),
    ).rejects.toBeInstanceOf(AnthropicRefusalError);
  });
});
