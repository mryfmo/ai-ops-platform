import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import {
  AnthropicRefusalError,
  AnthropicStructuredClient,
  estimateCostUsd,
  InMemoryCostGuard,
  MAX_PRICING_JSON_BYTES,
  MAX_PRICING_MODEL_COUNT,
  parseModelPricingUsdPerMtokJson,
  resolveModelPrice,
  shouldSendTemperature,
  validateModelPricingUsdPerMtok,
} from "../src/clients/anthropicClient.js";
import { InMemoryAuditLog } from "../src/auditLog.js";

const schema = {
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
};
const clientOptions = {
  defaultModel: "claude-sonnet-4-6",
  escalationModel: "claude-opus-4-8",
  pricingUsdPerMtok: {
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-opus-4-8": { input: 5, output: 25 },
  },
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

describe("AnthropicStructuredClient parameter handling [SPEC-INT-001 / SPEC-INT-030]", () => {
  it("configured escalation capability omits temperature without model-name inference [SPEC-INT-001 / SPEC-INT-030]", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(response([{ type: "text", text: "not a tool" }], "end_turn"))
      .mockResolvedValueOnce(response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }]));
    const client = new AnthropicStructuredClient(
      { messages: { create } } as unknown as Anthropic,
      new InMemoryCostGuard(),
      {
        defaultModel: "model-opus-looking",
        escalationModel: "tier-critical",
        pricingUsdPerMtok: {
          "model-opus-looking": { input: 3, output: 15 },
          "tier-critical": { input: 5, output: 25 },
        },
      },
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
    expect(create.mock.calls[0]![0]).toMatchObject({ model: "model-opus-looking", temperature: 0 });
    expect(create.mock.calls[1]![0]).toMatchObject({ model: "tier-critical" });
    expect(create.mock.calls[1]![0]).not.toHaveProperty("temperature");
    expect(shouldSendTemperature("model-opus-looking", "tier-critical")).toBe(true);
    expect(shouldSendTemperature("tier-critical", "tier-critical")).toBe(false);
  });

  it("stop_reason=refusal is surfaced as AnthropicRefusalError, not E-ING03 [SPEC-INT-030]", async () => {
    const create = vi.fn().mockResolvedValue(response([], "refusal"));
    const client = new AnthropicStructuredClient(
      { messages: { create } } as unknown as Anthropic,
      new InMemoryCostGuard(),
      clientOptions,
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

  it("failed attempts reconcile their reservation to zero before retrying [SPEC-INT-030 / SPEC-INT-060]", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }]));
    const costGuard = new InMemoryCostGuard();
    const client = new AnthropicStructuredClient(
      { messages: { create } } as unknown as Anthropic,
      costGuard,
      clientOptions,
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
        maxAttempts: 2,
      }),
    ).resolves.toMatchObject({ value: { value: "ok" } });

    const records = costGuard.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0]!.estimated_cost_usd).toBe(0);
    expect(records[1]!.input_tokens).toBe(10);
    expect(records[1]!.output_tokens).toBe(5);
  });
});

describe("AnthropicStructuredClient configured pricing [SPEC-INT-001 / SPEC-INT-060]", () => {
  it("uses custom rates without auditing a known model [SPEC-INT-001 / SPEC-INT-060]", async () => {
    const create = vi
      .fn()
      .mockResolvedValue(response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }]));
    const guard = new InMemoryCostGuard();
    const auditLog = new InMemoryAuditLog();
    const client = new AnthropicStructuredClient({ messages: { create } } as unknown as Anthropic, guard, {
      defaultModel: "custom-sonnet",
      escalationModel: "custom-opus",
      pricingUsdPerMtok: { "custom-sonnet": { input: 2, output: 10 } },
      auditLog,
      traceIdProvider: () => "123e4567-e89b-42d3-a456-426614174000",
    });

    await client.call({
      agent: "AGT-04",
      purpose: "standard_report_slots",
      system: "Return a tool.",
      user: "hello",
      toolName: "emit",
      toolDescription: "emit value",
      inputSchema: schema,
      parse: (raw) => raw as { value: string },
      maxAttempts: 1,
    });

    expect(guard.getRecords()[0]?.estimated_cost_usd).toBe(0.00007);
    expect(await auditLog.readAll()).toEqual([]);
  });

  it("uses highest configured price and warn audit for an unknown model [SPEC-INT-060]", async () => {
    const create = vi
      .fn()
      .mockResolvedValue(response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }]));
    const guard = new InMemoryCostGuard();
    const auditLog = new InMemoryAuditLog();
    const client = new AnthropicStructuredClient({ messages: { create } } as unknown as Anthropic, guard, {
      defaultModel: "unknown-model",
      escalationModel: "custom-opus",
      pricingUsdPerMtok: { low: { input: 1, output: 5 }, high: { input: 7, output: 35 } },
      auditLog,
      traceIdProvider: () => "123e4567-e89b-42d3-a456-426614174001",
    });
    await client.call({
      agent: "AGT-03",
      purpose: "reason",
      system: "Return a tool.",
      user: "hello",
      toolName: "emit",
      toolDescription: "emit",
      inputSchema: schema,
      parse: (raw) => raw as { value: string },
      maxAttempts: 1,
    });
    expect((await auditLog.readAll())[0]).toMatchObject({
      action: "llm_unknown_model_pricing_fallback",
      detail: { severity: "warn", model: "unknown-model", applied_price_usd_per_mtok: { input: 7, output: 35 } },
    });
  });

  it("fails before reservation or model call when unknown fallback has no audit sink [SPEC-INT-060]", async () => {
    const create = vi.fn();
    const guard = new InMemoryCostGuard();
    const client = new AnthropicStructuredClient({ messages: { create } } as unknown as Anthropic, guard, {
      defaultModel: "unknown-model",
      escalationModel: "known-model",
      pricingUsdPerMtok: { "known-model": { input: 1, output: 2 } },
    });

    await expect(
      client.call({
        agent: "AGT-03",
        purpose: "reason",
        system: "Return a tool.",
        user: "hello",
        toolName: "emit",
        toolDescription: "emit",
        inputSchema: schema,
        parse: (raw) => raw,
        maxAttempts: 1,
      }),
    ).rejects.toThrow("E-CFG04");
    expect(create).not.toHaveBeenCalled();
    expect(guard.getRecords()).toEqual([]);
  });

  it("fails before reservation or model call when unknown audit append fails [SPEC-INT-060]", async () => {
    const create = vi.fn();
    const guard = new InMemoryCostGuard();
    const append = vi.fn().mockRejectedValue(new Error("audit unavailable"));
    const client = new AnthropicStructuredClient({ messages: { create } } as unknown as Anthropic, guard, {
      defaultModel: "unknown-model",
      escalationModel: "known-model",
      pricingUsdPerMtok: { "known-model": { input: 1, output: 2 } },
      auditLog: { append, readAll: vi.fn() },
      traceIdProvider: () => "123e4567-e89b-42d3-a456-426614174001",
    });

    await expect(
      client.call({
        agent: "AGT-03",
        purpose: "reason",
        system: "Return a tool.",
        user: "hello",
        toolName: "emit",
        toolDescription: "emit",
        inputSchema: schema,
        parse: (raw) => raw,
        maxAttempts: 1,
      }),
    ).rejects.toThrow("audit unavailable");
    expect(append).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
    expect(guard.getRecords()).toEqual([]);
  });

  it("audits an unknown model once across retries [SPEC-INT-060]", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(response([{ type: "tool_use", id: "tu_1", name: "emit", input: { value: "ok" } }]));
    const auditLog = new InMemoryAuditLog();
    const client = new AnthropicStructuredClient(
      { messages: { create } } as unknown as Anthropic,
      new InMemoryCostGuard(),
      {
        defaultModel: "unknown-model",
        escalationModel: "known-model",
        pricingUsdPerMtok: { "known-model": { input: 1, output: 2 } },
        auditLog,
        traceIdProvider: () => "123e4567-e89b-42d3-a456-426614174001",
      },
    );

    await client.call({
      agent: "AGT-03",
      purpose: "reason",
      system: "Return a tool.",
      user: "hello",
      toolName: "emit",
      toolDescription: "emit",
      inputSchema: schema,
      parse: (raw) => raw,
      maxAttempts: 2,
    });
    expect(await auditLog.readAll()).toHaveLength(1);
  });
});

describe("LLM pricing and token validation [SPEC-INT-060]", () => {
  const pricing = validateModelPricingUsdPerMtok({ exact: { input: 2, output: 10 }, high: { input: 7, output: 35 } });

  it("resolves exact and unknown models deterministically [SPEC-INT-060]", () => {
    expect(resolveModelPrice("exact", pricing)).toEqual({ price: { input: 2, output: 10 }, usedFallback: false });
    expect(resolveModelPrice("unknown", pricing)).toEqual({ price: { input: 7, output: 35 }, usedFallback: true });
    expect(resolveModelPrice("constructor", pricing)).toEqual({ price: { input: 7, output: 35 }, usedFallback: true });
  });

  it.each([
    ["empty", {}],
    ["zero", { model: { input: 0, output: 1 } }],
    ["negative", { model: { input: -1, output: 1 } }],
    ["NaN", { model: { input: Number.NaN, output: 1 } }],
    ["Infinity", { model: { input: 1, output: Number.POSITIVE_INFINITY } }],
    ["surrounding model whitespace", { " model": { input: 1, output: 1 } }],
    ["unknown field", { model: { input: 1, output: 1, cached: 1 } }],
  ])("rejects %s pricing [SPEC-INT-060]", (_name, value) => {
    expect(() => validateModelPricingUsdPerMtok(value)).toThrow("E-CFG03");
  });

  it.each([
    ["negative input", -1, 0],
    ["fractional output", 0, 0.5],
    ["NaN input", Number.NaN, 0],
    ["Infinity output", 0, Number.POSITIVE_INFINITY],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1, 0],
  ])("rejects invalid token count: %s [SPEC-INT-060]", (_name, input, output) => {
    expect(() => estimateCostUsd("exact", input, output, pricing)).toThrow("E-COST02");
  });

  it("rejects duplicate keys, oversized JSON, and excessive model count [SPEC-INT-060]", () => {
    for (const raw of [
      '{"model":{"input":1,"input":2,"output":3}}',
      '{"model":{"input":1,"output":2},"model":{"input":3,"output":4}}',
    ]) {
      expect(() => parseModelPricingUsdPerMtokJson(raw)).toThrow("E-CFG03");
    }
    expect(() =>
      parseModelPricingUsdPerMtokJson(`{"model":{"input":1,"output":2}}${" ".repeat(MAX_PRICING_JSON_BYTES)}`),
    ).toThrow("E-CFG03");
    expect(() =>
      parseModelPricingUsdPerMtokJson(`{"model":{"input":1,"output":2,"note":"${"価".repeat(22_000)}"}}`),
    ).toThrow("bytes");
    const tooMany = Object.fromEntries(
      Array.from({ length: MAX_PRICING_MODEL_COUNT + 1 }, (_, index) => [`model-${index}`, { input: 1, output: 2 }]),
    );
    expect(() => parseModelPricingUsdPerMtokJson(JSON.stringify(tooMany))).toThrow("E-CFG03");
  });

  it("parses and deeply freezes a valid table once at the config boundary [SPEC-INT-060]", () => {
    const parsed = parseModelPricingUsdPerMtokJson('{"model":{"input":1,"output":2}}');
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed["model"])).toBe(true);
  });

  it("fails closed when arithmetic would produce a non-finite cost [SPEC-INT-060]", () => {
    const extreme = validateModelPricingUsdPerMtok({ model: { input: Number.MAX_VALUE, output: 1 } });
    expect(() => estimateCostUsd("model", Number.MAX_SAFE_INTEGER, 0, extreme)).toThrow("E-COST02");
    const underflow = validateModelPricingUsdPerMtok({ model: { input: Number.MIN_VALUE, output: Number.MIN_VALUE } });
    expect(() => estimateCostUsd("model", 1, 1, underflow)).toThrow("E-COST02");
  });

  it("rejects an invalid call model before audit or reservation [SPEC-INT-060]", async () => {
    const auditLog = new InMemoryAuditLog();
    const guard = new InMemoryCostGuard();
    const client = new AnthropicStructuredClient({ messages: { create: vi.fn() } } as unknown as Anthropic, guard, {
      ...clientOptions,
      auditLog,
      traceIdProvider: () => "123e4567-e89b-42d3-a456-426614174000",
    });
    await expect(
      client.call({
        agent: "AGT-04",
        purpose: "test",
        system: "system",
        user: "user",
        toolName: "emit",
        toolDescription: "emit",
        inputSchema: schema,
        parse: (raw) => raw,
        model: "   ",
      }),
    ).rejects.toThrow("E-CFG03");
    expect(guard.getRecords()).toEqual([]);
    expect(await auditLog.readAll()).toEqual([]);
  });

  it("rejects invalid constructor pricing before audit or reservation [SPEC-INT-060]", async () => {
    const auditLog = new InMemoryAuditLog();
    const guard = new InMemoryCostGuard();
    expect(
      () =>
        new AnthropicStructuredClient({ messages: { create: vi.fn() } } as unknown as Anthropic, guard, {
          ...clientOptions,
          pricingUsdPerMtok: { invalid: { input: -1, output: 1 } },
          auditLog,
          traceIdProvider: () => "123e4567-e89b-42d3-a456-426614174000",
        }),
    ).toThrow("E-CFG03");
    expect(guard.getRecords()).toEqual([]);
    expect(await auditLog.readAll()).toEqual([]);
  });

  it("rejects one-sided audit configuration [SPEC-INT-060]", () => {
    expect(
      () =>
        new AnthropicStructuredClient(
          { messages: { create: vi.fn() } } as unknown as Anthropic,
          new InMemoryCostGuard(),
          {
            ...clientOptions,
            traceIdProvider: () => "123e4567-e89b-42d3-a456-426614174000",
          },
        ),
    ).toThrow("E-CFG04");
  });
});
