// 根拠: DevOps:SPEC-INT-032 / DevOps:SPEC-INT-040 / REQ-029 / TH-007 / ADR-0021
import { describe, expect, it } from "vitest";

import {
  HEALTH_EVALUATION_INTERVAL_MS,
  JIT_EXPIRY_INTERVAL_MS,
  assertJitHealthRequest,
  jitHealthScheduleDelayMs,
  parseHealthEvaluationReceipt,
  parseJitRevocationCandidates,
  parseJitRevocationReceipt,
} from "../src/lib/jitHealthState.js";
import { buildHealthEvaluationWorkflowId, buildJitExpiryWorkflowId } from "../src/workflows/jitHealth.js";

const GRANT_ID = "00000000-0000-4000-8000-000000000001";

describe("DevOps:SPEC-INT-032/040 JIT・health schedule policy", () => {
  it("workflow ID を incident namespace で決定的に構築する", () => {
    expect(buildJitExpiryWorkflowId(2)).toBe("incident/jit-expiry:global:2");
    expect(buildHealthEvaluationWorkflowId(3)).toBe("incident/health:global:3");
  });

  it("JIT は毎分、health は30秒の旧 scheduler cadence を保つ", () => {
    expect(
      jitHealthScheduleDelayMs(
        { operation: "jit-expiry", executionMode: "active", sequence: 0, observedAtMs: 1_000 },
        1_000,
      ),
    ).toBe(JIT_EXPIRY_INTERVAL_MS);
    expect(
      jitHealthScheduleDelayMs(
        { operation: "health", executionMode: "active", sequence: 0, observedAtMs: 1_000 },
        1_000,
      ),
    ).toBe(HEALTH_EVALUATION_INTERVAL_MS);
  });

  it("worker 遅延で予定時刻を過ぎていれば追加待機しない", () => {
    expect(
      jitHealthScheduleDelayMs(
        { operation: "jit-expiry", executionMode: "active", sequence: 0, observedAtMs: 1_000 },
        1_000 + JIT_EXPIRY_INTERVAL_MS,
      ),
    ).toBe(0);
  });
});

describe("DevOps:SPEC-INT-032/040 JIT・health transport boundary", () => {
  it.each(["jit-expiry", "health"] as const)("%s request の VersionedPayload 全体を検証する", (operation) => {
    expect(() =>
      assertJitHealthRequest({
        schemaVersion: 1,
        payload: { operation, executionMode: "shadow", sequence: 0, observedAtMs: 10 },
      }),
    ).not.toThrow();
  });

  it.each([
    null,
    { schemaVersion: 2, payload: {} },
    { schemaVersion: 1, payload: { operation: "unknown", executionMode: "active", sequence: 0, observedAtMs: 0 } },
    { schemaVersion: 1, payload: { operation: "health", executionMode: "write", sequence: 0, observedAtMs: 0 } },
    { schemaVersion: 1, payload: { operation: "health", executionMode: "active", sequence: -1, observedAtMs: 0 } },
    {
      schemaVersion: 1,
      payload: { operation: "jit-expiry", executionMode: "active", sequence: 0, observedAtMs: Number.NaN },
    },
  ])("malformed request を参照前に拒否する: %j", (input) => {
    expect(() => assertJitHealthRequest(input)).toThrow(RangeError);
  });

  it("authoritative read の候補を logical time と一意 UUID に束縛する", () => {
    expect(
      parseJitRevocationCandidates(
        { schemaVersion: 1, payload: { evaluatedAtMs: 10, grants: [{ grantId: GRANT_ID }] } },
        10,
      ),
    ).toEqual([{ grantId: GRANT_ID }]);
    expect(() =>
      parseJitRevocationCandidates(
        { schemaVersion: 1, payload: { evaluatedAtMs: 11, grants: [{ grantId: GRANT_ID }] } },
        10,
      ),
    ).toThrow(RangeError);
    expect(() =>
      parseJitRevocationCandidates(
        { schemaVersion: 1, payload: { evaluatedAtMs: 10, grants: [{ grantId: GRANT_ID }, { grantId: GRANT_ID }] } },
        10,
      ),
    ).toThrow(RangeError);
  });

  it("revoke receipt を grant と idempotency key に束縛する", () => {
    const key = "incident/jit-expiry:global:0#revokeExpiredGrant#10";
    expect(
      parseJitRevocationReceipt(
        { schemaVersion: 1, payload: { grantId: GRANT_ID, idempotencyKey: key, revokedAtMs: 10 } },
        GRANT_ID,
        key,
      ),
    ).toEqual({ grantId: GRANT_ID, idempotencyKey: key, revokedAtMs: 10 });
    expect(() =>
      parseJitRevocationReceipt(
        { schemaVersion: 1, payload: { grantId: GRANT_ID, idempotencyKey: "wrong", revokedAtMs: 10 } },
        GRANT_ID,
        key,
      ),
    ).toThrow(RangeError);
  });

  it("health receipt を workflow logical time に束縛する", () => {
    expect(
      parseHealthEvaluationReceipt(
        {
          schemaVersion: 1,
          payload: { observedAtMs: 10, healthy: false, consecutiveFailures: 3, decision: "activate_failsafe" },
        },
        10,
      ),
    ).toEqual({ observedAtMs: 10, healthy: false, consecutiveFailures: 3, decision: "activate_failsafe" });
    expect(() =>
      parseHealthEvaluationReceipt(
        { schemaVersion: 1, payload: { observedAtMs: 11, healthy: true, consecutiveFailures: 0, decision: "none" } },
        10,
      ),
    ).toThrow(RangeError);
  });

  it.each([
    { healthy: false, consecutiveFailures: 0, decision: "none" },
    { healthy: false, consecutiveFailures: 3, decision: "none" },
    { healthy: true, consecutiveFailures: 1, decision: "none" },
  ])("不整合な health state を拒否する: %j", (payload) => {
    expect(() =>
      parseHealthEvaluationReceipt({ schemaVersion: 1, payload: { observedAtMs: 10, ...payload } }, 10),
    ).toThrow(RangeError);
  });
});
