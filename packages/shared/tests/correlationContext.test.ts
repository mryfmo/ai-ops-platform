// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / FinalArch:FR-OBS-001 / FinalArch:PRD-003 / ADR-0020
import { describe, expect, it } from "vitest";
import {
  CORRELATION_ID_HEADER,
  TRACEPARENT_HEADER,
  createCorrelationContext,
  inheritCorrelationContext,
  parseCorrelationHeaders,
  serializeCorrelationHeaders,
} from "../src/correlationContext.js";

const TRACE_ID = "11111111-1111-4111-8111-111111111111";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";

describe("FinalArch:CON-001/CON-002 correlation context propagation", () => {
  it("generates required IDs and inherits them without mutation [FinalArch:FR-OBS-001]", () => {
    const ids = [TRACE_ID, CORRELATION_ID];
    const parent = createCorrelationContext({ actorId: "actor-1", workflowId: "report/PJ-001" }, () => ids.shift()!);
    const child = inheritCorrelationContext(parent, { projectId: "PJ-001" });

    expect(parent).toEqual({
      traceId: TRACE_ID,
      correlationId: CORRELATION_ID,
      actorId: "actor-1",
      workflowId: "report/PJ-001",
    });
    expect(child).toEqual({ ...parent, projectId: "PJ-001" });
    expect(child).not.toBe(parent);
    expect(inheritCorrelationContext(parent, { actorId: undefined })).toEqual(parent);
  });

  it("serializes and parses W3C version-00 traceparent headers [FinalArch:FR-OBS-001]", () => {
    const context = createCorrelationContext({ traceId: TRACE_ID, correlationId: CORRELATION_ID });
    const headers = serializeCorrelationHeaders(context, "3333333333333333", true);

    expect(headers).toEqual({
      [TRACEPARENT_HEADER]: "00-11111111111141118111111111111111-3333333333333333-01",
      [CORRELATION_ID_HEADER]: CORRELATION_ID,
    });
    expect(parseCorrelationHeaders(headers)).toEqual({ context, parentSpanId: "3333333333333333", sampled: true });
  });

  it("accepts case-insensitive header names and creates only missing IDs [FinalArch:CON-001]", () => {
    const parsed = parseCorrelationHeaders(
      { TraceParent: "00-11111111111141118111111111111111-3333333333333333-00" },
      { sourceSystem: "github" },
    );

    expect(parsed).toEqual({
      context: { traceId: TRACE_ID, correlationId: TRACE_ID, sourceSystem: "github" },
      parentSpanId: "3333333333333333",
      sampled: false,
    });

    expect(parseCorrelationHeaders({ "X-Correlation-ID": CORRELATION_ID }, {}, () => TRACE_ID).context).toEqual({
      traceId: TRACE_ID,
      correlationId: CORRELATION_ID,
    });
  });

  it("rejects malformed or zero W3C identifiers [FinalArch:CON-001]", () => {
    expect(() => createCorrelationContext({ traceId: "trace", correlationId: CORRELATION_ID })).toThrow(/traceId/u);
    expect(() =>
      serializeCorrelationHeaders(
        createCorrelationContext({ traceId: TRACE_ID, correlationId: CORRELATION_ID }),
        "0000000000000000",
      ),
    ).toThrow(/span ID/u);
    expect(() =>
      parseCorrelationHeaders({ traceparent: "00-00000000000000000000000000000000-3333333333333333-01" }),
    ).toThrow(/trace ID/u);
    expect(() =>
      parseCorrelationHeaders({ traceparent: "00-11111111111141118111111111111111-3333333333333333-0A" }),
    ).toThrow(/traceparent/u);
  });

  it("bounds every optional string identifier and rejects unknown fields [FinalArch:CON-002]", () => {
    const boundedFields = [
      "workflowId",
      "runId",
      "actorId",
      "projectId",
      "repository",
      "agentTaskId",
      "meetingId",
      "approvalId",
      "toolId",
      "modelId",
      "sourceSystem",
      "sourceObjectId",
    ] as const;
    for (const field of boundedFields) {
      expect(createCorrelationContext({ [field]: "a".repeat(512) })[field]).toHaveLength(512);
      expect(() => createCorrelationContext({ [field]: "a".repeat(513) })).toThrow(new RegExp(field, "u"));
    }
    expect(() => createCorrelationContext({ pullRequestNumber: 0 })).toThrow(/pullRequestNumber/u);
    expect(() => createCorrelationContext({ content: "free text" } as never)).toThrow(/unknown field/u);
  });

  it("rejects runtime attempts to replace inherited IDs [FinalArch:CON-002]", () => {
    const parent = createCorrelationContext({ traceId: TRACE_ID, correlationId: CORRELATION_ID });
    expect(() => inheritCorrelationContext(parent, { traceId: CORRELATION_ID } as never)).toThrow(
      /cannot be overridden/u,
    );
    expect(() => inheritCorrelationContext(parent, { correlationId: TRACE_ID } as never)).toThrow(
      /cannot be overridden/u,
    );
  });

  it("rejects ambiguous duplicate propagation headers [FinalArch:CON-001]", () => {
    expect(() => parseCorrelationHeaders({ traceparent: "first", TraceParent: "second" })).toThrow(/duplicate header/u);
    expect(
      parseCorrelationHeaders({ Accept: "application/json", accept: "text/plain" }, {}, () => TRACE_ID).context,
    ).toEqual({ traceId: TRACE_ID, correlationId: TRACE_ID });
  });
});
