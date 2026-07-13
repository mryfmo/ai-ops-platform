import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import {
  AnthropicRefusalError,
  AnthropicStructuredClient,
  estimateCostUsd,
  InMemoryCostGuard,
  shouldSendTemperature,
} from "../src/clients/anthropicClient.js";

const schema = {
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
};

function response(
  content: unknown[],
  stopReason = "tool_use",
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number | null;
    cache_read_input_tokens: number | null;
  } = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage,
  };
}

function mockAnthropic(create: ReturnType<typeof vi.fn>): Anthropic {
  return { beta: { promptCaching: { messages: { create } } } } as unknown as Anthropic;
}

describe("AnthropicStructuredClient parameter handling [T26]", () => {
  it("claude-opus-4-8 escalation omits temperature while the default model keeps temperature 0", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(response([{ type: "text", text: "not a tool" }], "end_turn"))
      .mockResolvedValueOnce(response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }]));
    const client = new AnthropicStructuredClient(mockAnthropic(create), new InMemoryCostGuard());

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
    const client = new AnthropicStructuredClient(mockAnthropic(create), new InMemoryCostGuard());

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

  it("failed attempts reconcile their reservation to zero before retrying [T26-R1b]", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }]));
    const costGuard = new InMemoryCostGuard();
    const client = new AnthropicStructuredClient(mockAnthropic(create), costGuard);

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
        maxAttempts: 2,
      }),
    ).resolves.toMatchObject({ value: { value: "ok" } });

    const records = costGuard.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0]!.estimated_cost_usd).toBe(0);
    expect(records[1]!.input_tokens).toBe(10);
    expect(records[1]!.output_tokens).toBe(5);
  });

  it("SPEC-INT-060 / AUD-REL-004: stable system/tool blocks are cached and cache usage is reconciled", async () => {
    const create = vi.fn().mockResolvedValue(
      response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }], "tool_use", {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 120,
        cache_read_input_tokens: 80,
      }),
    );
    const costGuard = new InMemoryCostGuard();
    const client = new AnthropicStructuredClient(mockAnthropic(create), costGuard);

    const result = await client.call({
      agent: "AGT-04",
      purpose: "standard_report_slots",
      system: "Return a tool.",
      user: "dynamic user input",
      toolName: "emit",
      toolDescription: "emit value",
      inputSchema: schema,
      parse: (raw) => raw as { value: string },
      maxAttempts: 1,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: [{ type: "text", text: "Return a tool.", cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: "dynamic user input" }],
        tools: [expect.objectContaining({ cache_control: { type: "ephemeral" } })],
      }),
    );
    expect(result.usage).toMatchObject({ cache_creation_input_tokens: 120, cache_read_input_tokens: 80 });
    expect(costGuard.getRecords()[0]).toMatchObject({
      cache_creation_input_tokens: 120,
      cache_read_input_tokens: 80,
      estimated_cost_usd: 0.000579,
    });
    expect(estimateCostUsd("claude-sonnet-4-6", 10, 5, 120, 80)).toBe(0.000579);
  });

  it("SPEC-INT-060 / AUD-REL-004: null cache usage means no cache tokens and reconciles both fields as zero", async () => {
    const create = vi.fn().mockResolvedValue(
      response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }], "tool_use", {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      }),
    );
    const costGuard = new InMemoryCostGuard();
    const client = new AnthropicStructuredClient(mockAnthropic(create), costGuard);

    const result = await client.call({
      agent: "AGT-04",
      purpose: "standard_report_slots",
      system: "Return a tool.",
      user: "dynamic user input",
      toolName: "emit",
      toolDescription: "emit value",
      inputSchema: schema,
      parse: (raw) => raw as { value: string },
      maxAttempts: 1,
    });

    expect(result.usage).toMatchObject({ cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });
    expect(costGuard.getRecords()[0]).toMatchObject({
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      estimated_cost_usd: 0.000105,
    });
  });
});
