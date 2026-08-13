// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
import { describe, expect, it } from "vitest";

import { WORKFLOW_KINDS, type OperationClass } from "../src/contracts/index.js";
import { retryPolicyFor, toTemporalRetryPolicy } from "../src/lib/retryPolicies.js";

const ALL_CLASSES: readonly OperationClass[] = ["read", "idempotent-write", "external-side-effect", "approval"];

describe("FinalArch:FR-CP-001 operation class ごとの固定 retry policy", () => {
  it("全 operation class に policy が定義されている", () => {
    for (const operationClass of ALL_CLASSES) {
      const policy = retryPolicyFor(operationClass);
      expect(policy.maximumAttempts).toBeGreaterThanOrEqual(1);
      expect(policy.initialIntervalMs).toBeGreaterThan(0);
      expect(policy.backoffCoefficient).toBeGreaterThanOrEqual(1);
      expect(policy.maximumIntervalMs).toBeGreaterThanOrEqual(policy.initialIntervalMs);
    }
  });

  it("TMP-003: external-side-effect は single-attempt（maximumAttempts=1）", () => {
    expect(retryPolicyFor("external-side-effect").maximumAttempts).toBe(1);
  });

  it("read / idempotent-write は再試行する（attempts > 1）", () => {
    expect(retryPolicyFor("read").maximumAttempts).toBeGreaterThan(1);
    expect(retryPolicyFor("idempotent-write").maximumAttempts).toBeGreaterThan(1);
  });

  it("入力不正（RangeError/TypeError/E-CP-CONTRACT）はどの class でも non-retryable", () => {
    for (const operationClass of ALL_CLASSES) {
      expect(retryPolicyFor(operationClass).nonRetryableErrorTypes).toEqual(
        expect.arrayContaining(["RangeError", "TypeError", "E-CP-CONTRACT"]),
      );
    }
  });

  it("policy は凍結され呼び出し側から改変できない", () => {
    const policy = retryPolicyFor("external-side-effect");
    expect(Object.isFrozen(policy)).toBe(true);
    expect(() => {
      (policy as { maximumAttempts: number }).maximumAttempts = 5;
    }).toThrow(TypeError);
  });

  it("toTemporalRetryPolicy は SDK 形へ同値変換する", () => {
    const fixed = retryPolicyFor("read");
    const sdk = toTemporalRetryPolicy("read");
    expect(sdk).toEqual({
      initialInterval: fixed.initialIntervalMs,
      backoffCoefficient: fixed.backoffCoefficient,
      maximumInterval: fixed.maximumIntervalMs,
      maximumAttempts: fixed.maximumAttempts,
      nonRetryableErrorTypes: fixed.nonRetryableErrorTypes,
    });
  });

  it("契約の前提: workflow kinds は 7 種（policy 表の適用対象）", () => {
    expect(WORKFLOW_KINDS).toHaveLength(7);
  });
});
