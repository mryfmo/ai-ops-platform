// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0006
// CodingTaskWorkflow の状態機械 matrix（TMP-003/TMP-004 の純粋判定側）。
// callback replay safe: dispatch 束縛・exact replay のみ duplicate・別 identity は
// conflicting・malformed は wedge しない。review の完了権威は DB 正本の read。

import { describe, expect, it } from "vitest";

import {
  assertCodingTaskRequest,
  evaluateCallbackSignal,
  evaluateReviewDecision,
  evaluateReviewSignal,
  phaseAfterCallback,
} from "../src/lib/codingTaskState.js";

const TASK_ID = "3f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a90";
const DISPATCH_ID = `dispatch:${TASK_ID}`;
const RUNNING = { taskId: TASK_ID, phase: "running" as const, dispatchId: DISPATCH_ID, accepted: null };
const VALID_CALLBACK = {
  taskId: TASK_ID,
  dispatchId: DISPATCH_ID,
  outcome: "pr_created",
  runId: "run-1",
  prNumber: 41,
};

describe("ADR-0006 callback signal は dispatch 束縛で replay/duplicate safe", () => {
  it("running phase + taskId/dispatchId 一致 + 正典 outcome のみ受理される", () => {
    for (const outcome of ["pr_created", "no_change", "failed"] as const) {
      expect(evaluateCallbackSignal(RUNNING, { ...VALID_CALLBACK, outcome })).toEqual({
        accepted: true,
        callback: { outcome, runId: "run-1", prNumber: 41 },
      });
    }
    expect(evaluateCallbackSignal(RUNNING, { ...VALID_CALLBACK, prNumber: undefined })).toEqual({
      accepted: true,
      callback: { outcome: "pr_created", runId: "run-1", prNumber: null },
    });
  });

  it("P3-T04-002: dispatchId 不一致・dispatch 前（null）の callback は拒否される", () => {
    expect(evaluateCallbackSignal(RUNNING, { ...VALID_CALLBACK, dispatchId: "dispatch:forged" })).toEqual({
      accepted: false,
      reason: "dispatch-mismatch",
    });
    expect(evaluateCallbackSignal({ ...RUNNING, phase: "approval_pending", dispatchId: null }, VALID_CALLBACK)).toEqual(
      { accepted: false, reason: "dispatch-mismatch" },
    );
  });

  it("P3-T04-002: 決定後は (runId, outcome, prNumber) 完全一致のみ duplicate、別 identity は conflicting", () => {
    const accepted = { outcome: "pr_created" as const, runId: "run-1", prNumber: 41 };
    const decided = { ...RUNNING, accepted };
    expect(evaluateCallbackSignal(decided, VALID_CALLBACK)).toEqual({
      accepted: false,
      reason: "duplicate-callback",
    });
    for (const different of [
      { ...VALID_CALLBACK, runId: "run-2" },
      { ...VALID_CALLBACK, prNumber: 42 },
      { ...VALID_CALLBACK, prNumber: undefined },
      { ...VALID_CALLBACK, outcome: "failed" },
    ]) {
      expect(evaluateCallbackSignal(decided, different), JSON.stringify(different)).toEqual({
        accepted: false,
        reason: "conflicting-callback",
      });
    }
  });

  it("malformed payload（null/非 object/欠損/不正 outcome/空 runId/不正 prNumber/欠損 dispatchId）は throw せず拒否", () => {
    for (const malformed of [
      null,
      undefined,
      "pr_created",
      [],
      {},
      { taskId: TASK_ID },
      { ...VALID_CALLBACK, dispatchId: undefined },
      { ...VALID_CALLBACK, dispatchId: "  " },
      { ...VALID_CALLBACK, outcome: "merged" },
      { ...VALID_CALLBACK, runId: "  " },
      { ...VALID_CALLBACK, runId: 42 },
      { ...VALID_CALLBACK, prNumber: 0 },
      { ...VALID_CALLBACK, prNumber: 1.5 },
    ]) {
      expect(evaluateCallbackSignal(RUNNING, malformed), JSON.stringify(malformed) ?? "undefined").toEqual({
        accepted: false,
        reason: "malformed-payload",
      });
    }
  });

  it("taskId 不一致・queued/running 以外の phase は拒否", () => {
    expect(
      evaluateCallbackSignal(RUNNING, { ...VALID_CALLBACK, taskId: "11111111-2222-4333-8444-555555555555" }),
    ).toEqual({ accepted: false, reason: "task-id-mismatch" });
    for (const phase of ["requested", "approval_pending", "review_pending", "complete"] as const) {
      expect(evaluateCallbackSignal({ ...RUNNING, phase }, VALID_CALLBACK)).toEqual({
        accepted: false,
        reason: "wrong-phase",
      });
    }
  });

  it("P3-T04-005: dispatch in-flight（queued + 相関確定済み）中の正規 callback は受理される", () => {
    expect(evaluateCallbackSignal({ ...RUNNING, phase: "queued" }, VALID_CALLBACK)).toEqual({
      accepted: true,
      callback: { outcome: "pr_created", runId: "run-1", prNumber: 41 },
    });
  });

  it("callback outcome → phase は正典の分岐（failed のみ failed 終端）", () => {
    expect(phaseAfterCallback("pr_created")).toBe("pr_created");
    expect(phaseAfterCallback("no_change")).toBe("no_change");
    expect(phaseAfterCallback("failed")).toBe("failed");
  });
});

describe("ADR-0006 review signal は wake 専用、完了権威は DB 正本の read", () => {
  const REVIEW_PENDING = { taskId: TASK_ID, phase: "review_pending" as const };
  const VALID_REVIEW = { taskId: TASK_ID, verdict: "complete", reviewerObjectId: "reviewer-1" };

  it("review_pending + 一致 taskId + 記名 reviewer の signal は wake として受理", () => {
    expect(evaluateReviewSignal(REVIEW_PENDING, VALID_REVIEW)).toEqual({ accepted: true });
  });

  it("malformed / id 不一致 / 無記名 / phase 不一致の signal は拒否", () => {
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

  it("P3-T04-001: 完了は authoritative read の complete 確認のみ — 名前だけの signal では完了しない", () => {
    expect(evaluateReviewDecision(TASK_ID, { taskId: TASK_ID, status: "complete", reviewerObjectId: "r-1" })).toEqual({
      accepted: true,
      reviewerObjectId: "r-1",
    });
    for (const unconfirmed of [
      null,
      undefined,
      "complete",
      [],
      {},
      { taskId: TASK_ID, status: "pending", reviewerObjectId: "r-1" },
      { taskId: TASK_ID, status: "complete", reviewerObjectId: "  " },
      { taskId: "11111111-2222-4333-8444-555555555555", status: "complete", reviewerObjectId: "r-1" },
    ]) {
      expect(evaluateReviewDecision(TASK_ID, unconfirmed), JSON.stringify(unconfirmed) ?? "undefined").toEqual({
        accepted: false,
        reason: "unconfirmed-review",
      });
    }
  });
});

describe("境界: 不正な CodingTask 要求（封筒含む）は E-CP-CONTRACT 相当の RangeError", () => {
  const VALID = {
    schemaVersion: 1,
    payload: {
      taskId: TASK_ID,
      approvalId: "0f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a9f",
      approvalVersion: 1,
      approvalExpiryMs: 1,
      callbackTimeoutMs: 1,
      repository: { owner: "mryfmo", repo: "ai-ops-platform", ref: "main" },
      requestedBy: "user-1",
    },
  };

  it("正しい要求は通る", () => {
    expect(() => assertCodingTaskRequest(VALID)).not.toThrow();
  });

  it("P3-T04-004: 封筒・repository・requestedBy の runtime 不正は RangeError", () => {
    const cases: unknown[] = [
      null,
      undefined,
      [],
      "request",
      { ...VALID, schemaVersion: 2 },
      { schemaVersion: 1 },
      { schemaVersion: 1, payload: null },
      { schemaVersion: 1, payload: { ...VALID.payload, taskId: "x" } },
      { schemaVersion: 1, payload: { ...VALID.payload, approvalId: "x" } },
      { schemaVersion: 1, payload: { ...VALID.payload, approvalVersion: 0 } },
      { schemaVersion: 1, payload: { ...VALID.payload, approvalExpiryMs: 0 } },
      { schemaVersion: 1, payload: { ...VALID.payload, callbackTimeoutMs: 1.5 } },
      { schemaVersion: 1, payload: { ...VALID.payload, repository: undefined } },
      { schemaVersion: 1, payload: { ...VALID.payload, repository: { owner: "", repo: "r", ref: "main" } } },
      { schemaVersion: 1, payload: { ...VALID.payload, repository: { owner: "o", repo: "  ", ref: "main" } } },
      { schemaVersion: 1, payload: { ...VALID.payload, repository: { owner: "o", repo: "r" } } },
      { schemaVersion: 1, payload: { ...VALID.payload, requestedBy: "" } },
      { schemaVersion: 1, payload: { ...VALID.payload, requestedBy: 42 } },
    ];
    for (const invalid of cases) {
      expect(() => assertCodingTaskRequest(invalid), JSON.stringify(invalid) ?? "undefined").toThrow(RangeError);
    }
  });
});
