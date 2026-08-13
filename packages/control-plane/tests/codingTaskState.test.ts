// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0006
// CodingTaskWorkflow の状態機械 matrix（TMP-003/TMP-004 の純粋判定側）。
// callback replay safe: 重複は冪等・競合は先勝ち・malformed は wedge しない。

import { describe, expect, it } from "vitest";

import {
  assertCodingTaskRequest,
  evaluateCallbackSignal,
  evaluateReviewSignal,
  phaseAfterCallback,
} from "../src/lib/codingTaskState.js";

const TASK_ID = "3f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a9f";
const RUNNING = { taskId: TASK_ID, phase: "running" as const, decidedOutcome: null };
const VALID_CALLBACK = { taskId: TASK_ID, outcome: "pr_created", runId: "run-1" };

describe("ADR-0006 callback signal は replay/duplicate safe", () => {
  it("running phase の一致 taskId + 正典 outcome のみ受理される", () => {
    for (const outcome of ["pr_created", "no_change", "failed"] as const) {
      expect(evaluateCallbackSignal(RUNNING, { ...VALID_CALLBACK, outcome })).toEqual({ accepted: true, outcome });
    }
  });

  it("決定後の同一 outcome 再送は duplicate（状態不変）、異なる outcome は conflicting（先勝ち）", () => {
    const decided = { ...RUNNING, decidedOutcome: "pr_created" as const };
    expect(evaluateCallbackSignal(decided, VALID_CALLBACK)).toEqual({
      accepted: false,
      reason: "duplicate-callback",
    });
    expect(evaluateCallbackSignal(decided, { ...VALID_CALLBACK, outcome: "failed" })).toEqual({
      accepted: false,
      reason: "conflicting-callback",
    });
  });

  it("malformed payload（null/非 object/欠損/不正 outcome/空 runId）は throw せず拒否", () => {
    for (const malformed of [
      null,
      undefined,
      "pr_created",
      [],
      {},
      { taskId: TASK_ID },
      { ...VALID_CALLBACK, outcome: "merged" },
      { ...VALID_CALLBACK, runId: "  " },
      { ...VALID_CALLBACK, runId: 42 },
    ]) {
      expect(evaluateCallbackSignal(RUNNING, malformed), JSON.stringify(malformed) ?? "undefined").toEqual({
        accepted: false,
        reason: "malformed-payload",
      });
    }
  });

  it("taskId 不一致・running 以外の phase は拒否", () => {
    expect(
      evaluateCallbackSignal(RUNNING, { ...VALID_CALLBACK, taskId: "11111111-2222-4333-8444-555555555555" }),
    ).toEqual({ accepted: false, reason: "task-id-mismatch" });
    for (const phase of ["requested", "approval_pending", "queued", "review_pending", "complete"] as const) {
      expect(evaluateCallbackSignal({ ...RUNNING, phase }, VALID_CALLBACK)).toEqual({
        accepted: false,
        reason: "wrong-phase",
      });
    }
  });

  it("callback outcome → phase は正典の分岐（failed のみ failed 終端）", () => {
    expect(phaseAfterCallback("pr_created")).toBe("pr_created");
    expect(phaseAfterCallback("no_change")).toBe("no_change");
    expect(phaseAfterCallback("failed")).toBe("failed");
  });
});

describe("ADR-0006 review signal の受理境界", () => {
  const REVIEW_PENDING = { taskId: TASK_ID, phase: "review_pending" as const };
  const VALID_REVIEW = { taskId: TASK_ID, verdict: "complete", reviewerObjectId: "reviewer-1" };

  it("review_pending + 一致 taskId + 記名 reviewer のみ受理", () => {
    expect(evaluateReviewSignal(REVIEW_PENDING, VALID_REVIEW)).toEqual({ accepted: true });
  });

  it("malformed / id 不一致 / 無記名 / phase 不一致は拒否", () => {
    expect(evaluateReviewSignal(REVIEW_PENDING, null)).toEqual({ accepted: false, reason: "malformed-payload" });
    expect(evaluateReviewSignal(REVIEW_PENDING, { ...VALID_REVIEW, verdict: "approve" })).toEqual({
      accepted: false,
      reason: "malformed-payload",
    });
    expect(
      evaluateReviewSignal(REVIEW_PENDING, { ...VALID_REVIEW, taskId: "11111111-2222-4333-8444-555555555555" }),
    ).toEqual({ accepted: false, reason: "task-id-mismatch" });
    expect(evaluateReviewSignal(REVIEW_PENDING, { ...VALID_REVIEW, reviewerObjectId: " " })).toEqual({
      accepted: false,
      reason: "missing-reviewer",
    });
    expect(evaluateReviewSignal({ ...REVIEW_PENDING, phase: "running" }, VALID_REVIEW)).toEqual({
      accepted: false,
      reason: "wrong-phase",
    });
  });
});

describe("境界: 不正な CodingTask 要求は E-CP-CONTRACT 相当の RangeError", () => {
  const VALID = {
    taskId: TASK_ID,
    approvalId: "0f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a9f",
    approvalVersion: 1,
    approvalExpiryMs: 1,
    callbackTimeoutMs: 1,
    reviewTimeoutMs: 1,
  };

  it("正しい要求は通る", () => {
    expect(() => assertCodingTaskRequest(VALID)).not.toThrow();
  });

  it("uuid/version/期限の不正は RangeError", () => {
    expect(() => assertCodingTaskRequest({ ...VALID, taskId: "x" })).toThrow(RangeError);
    expect(() => assertCodingTaskRequest({ ...VALID, approvalId: "x" })).toThrow(RangeError);
    expect(() => assertCodingTaskRequest({ ...VALID, approvalVersion: 0 })).toThrow(RangeError);
    expect(() => assertCodingTaskRequest({ ...VALID, approvalExpiryMs: 0 })).toThrow(RangeError);
    expect(() => assertCodingTaskRequest({ ...VALID, callbackTimeoutMs: 1.5 })).toThrow(RangeError);
    expect(() => assertCodingTaskRequest({ ...VALID, reviewTimeoutMs: -1 })).toThrow(RangeError);
  });
});
