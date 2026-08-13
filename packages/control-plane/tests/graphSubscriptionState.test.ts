// 根拠: FinalArch:FR-CP-001 / FinalArch:FR-CP-004 / FinalArch:FR-CP-005 / ADR-0021
import { describe, expect, it } from "vitest";

import {
  GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RECONCILE_INTERVAL_MS,
  GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS,
  assertGraphSubscriptionRequest,
  graphSubscriptionScheduleDelayMs,
  parseGraphSubscriptionReceipt,
} from "../src/lib/graphSubscriptionState.js";
import { buildGraphSubscriptionWorkflowId } from "../src/workflows/graphSubscription.js";

describe("FinalArch:FR-CP-004 Graph subscription schedule policy", () => {
  it("workflow ID は graph-subscription/<business-key> 規約で決定的に構築する", () => {
    expect(buildGraphSubscriptionWorkflowId("subscription-1", "renewal", 2)).toBe(
      "graph-subscription/renewal:subscription-1:2",
    );
  });

  it("renewal は期限の6時間前まで durable wait する", () => {
    expect(
      graphSubscriptionScheduleDelayMs(
        {
          subscriptionId: "subscription-1",
          operation: "renewal",
          executionMode: "active",
          sequence: 0,
          observedAtMs: 1_000,
          expiresAtMs: 1_000 + GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS + 30 * 60_000,
        },
        1_000,
      ),
    ).toBe(30 * 60_000);
  });

  it("worker 遅延で deadline を過ぎていれば追加待機しない", () => {
    expect(
      graphSubscriptionScheduleDelayMs(
        {
          subscriptionId: "subscription-1",
          operation: "renewal",
          executionMode: "active",
          sequence: 0,
          observedAtMs: 1_000,
          expiresAtMs: 1_000 + GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS + 30 * 60_000,
        },
        1_000 + 40 * 60_000,
      ),
    ).toBe(0);
  });

  it("schedule clock の不正値を拒否する", () => {
    expect(() =>
      graphSubscriptionScheduleDelayMs(
        {
          subscriptionId: "subscription-1",
          operation: "delta",
          executionMode: "active",
          sequence: 0,
          observedAtMs: 1_000,
        },
        -1,
      ),
    ).toThrow(RangeError);
  });

  it("delta と reconcile は旧 scheduler と同じ5分周期を保つ", () => {
    expect(
      graphSubscriptionScheduleDelayMs(
        {
          subscriptionId: "subscription-1",
          operation: "delta",
          executionMode: "active",
          sequence: 0,
          observedAtMs: 1_000,
        },
        1_000,
      ),
    ).toBe(GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS);
    expect(
      graphSubscriptionScheduleDelayMs(
        {
          subscriptionId: "subscription-1",
          operation: "reconcile",
          executionMode: "active",
          sequence: 0,
          observedAtMs: 1_000,
        },
        1_000,
      ),
    ).toBe(GRAPH_SUBSCRIPTION_RECONCILE_INTERVAL_MS);
  });
});

describe("FinalArch:FR-CP-005 Graph subscription transport boundary", () => {
  it("workflow request の全 operation を検証する", () => {
    expect(() =>
      assertGraphSubscriptionRequest({
        schemaVersion: 1,
        payload: {
          subscriptionId: "subscription-1",
          operation: "delta",
          executionMode: "active",
          sequence: 0,
          observedAtMs: 10,
        },
      }),
    ).not.toThrow();
    expect(() =>
      assertGraphSubscriptionRequest({
        schemaVersion: 1,
        payload: {
          subscriptionId: "subscription-1",
          operation: "renewal",
          executionMode: "active",
          sequence: 0,
          observedAtMs: 10,
          expiresAtMs: 20,
        },
      }),
    ).not.toThrow();
  });

  it.each([
    null,
    { schemaVersion: 2, payload: {} },
    {
      schemaVersion: 1,
      payload: { subscriptionId: "", operation: "delta", executionMode: "active", sequence: 0, observedAtMs: 0 },
    },
    {
      schemaVersion: 1,
      payload: {
        subscriptionId: "subscription-1",
        operation: "unknown",
        executionMode: "active",
        sequence: 0,
        observedAtMs: 0,
      },
    },
    {
      schemaVersion: 1,
      payload: {
        subscriptionId: "subscription-1",
        operation: "delta",
        executionMode: "active",
        sequence: -1,
        observedAtMs: 0,
      },
    },
    {
      schemaVersion: 1,
      payload: {
        subscriptionId: "subscription-1",
        operation: "renewal",
        executionMode: "active",
        sequence: 0,
        observedAtMs: 30,
        expiresAtMs: 20,
      },
    },
  ])("malformed request を拒否する: %j", (input) => {
    expect(() => assertGraphSubscriptionRequest(input)).toThrow(RangeError);
  });

  it("最大 workflow business key に収まらない subscription ID を拒否する", () => {
    const request = (subscriptionId: string) => ({
      schemaVersion: 1,
      payload: {
        subscriptionId,
        operation: "delta",
        executionMode: "active",
        sequence: Number.MAX_SAFE_INTEGER,
        observedAtMs: 0,
      },
    });
    expect(() => assertGraphSubscriptionRequest(request(`a${"b".repeat(172)}`))).not.toThrow();
    expect(() => assertGraphSubscriptionRequest(request(`a${"b".repeat(173)}`))).toThrow(RangeError);
  });

  it("activity の unknown receipt を operation と subscription に束縛する", () => {
    expect(
      parseGraphSubscriptionReceipt(
        {
          schemaVersion: 1,
          payload: { subscriptionId: "subscription-1", operation: "renewal", checkpoint: "etag-1" },
        },
        "subscription-1",
        "renewal",
      ),
    ).toEqual({ subscriptionId: "subscription-1", operation: "renewal", checkpoint: "etag-1" });
    expect(() => parseGraphSubscriptionReceipt(null, "subscription-1", "renewal")).toThrow(RangeError);
    expect(() =>
      parseGraphSubscriptionReceipt(
        {
          schemaVersion: 1,
          payload: { subscriptionId: "subscription-2", operation: "renewal", checkpoint: "etag-1" },
        },
        "subscription-1",
        "renewal",
      ),
    ).toThrow(RangeError);
    expect(() =>
      parseGraphSubscriptionReceipt(
        { subscriptionId: "subscription-1", operation: "renewal", checkpoint: "etag-1" },
        "subscription-1",
        "renewal",
      ),
    ).toThrow(RangeError);
  });
});
