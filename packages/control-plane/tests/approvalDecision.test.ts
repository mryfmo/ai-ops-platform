// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / DevOps:SPEC-EXT-010
// TMP-002「Approval is versioned and stale signal rejected」の signal 判定 matrix。

import { describe, expect, it } from "vitest";

import {
  assertApprovalRequest,
  evaluateDecisionSignal,
  type ApprovalDecisionSignalPayload,
  type ApprovalWaitState,
} from "../src/lib/approvalDecision.js";

const APPROVAL_ID = "0f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a9f";
const WAITING: ApprovalWaitState = { approvalId: APPROVAL_ID, version: 3, decided: false };
const VALID: ApprovalDecisionSignalPayload = {
  approvalId: APPROVAL_ID,
  version: 3,
  decision: "approved",
  approverObjectId: "approver-1",
};

describe("TMP-002 decision signal は version CAS でのみ受理される", () => {
  it("未決 + id/version 一致 + 記名 approver の approved/rejected だけが受理される", () => {
    expect(evaluateDecisionSignal(WAITING, VALID)).toEqual({ accepted: true, decision: "approved" });
    expect(evaluateDecisionSignal(WAITING, { ...VALID, decision: "rejected" })).toEqual({
      accepted: true,
      decision: "rejected",
    });
  });

  it("stale version（新旧いずれ方向も）は拒否される", () => {
    expect(evaluateDecisionSignal(WAITING, { ...VALID, version: 2 })).toEqual({
      accepted: false,
      reason: "stale-version",
    });
    expect(evaluateDecisionSignal(WAITING, { ...VALID, version: 4 })).toEqual({
      accepted: false,
      reason: "stale-version",
    });
  });

  it("決定済み以後の signal は decision 内容に関わらず拒否される（二重決定なし）", () => {
    const decided = { ...WAITING, decided: true };
    expect(evaluateDecisionSignal(decided, VALID)).toEqual({ accepted: false, reason: "already-decided" });
    expect(evaluateDecisionSignal(decided, { ...VALID, decision: "rejected" })).toEqual({
      accepted: false,
      reason: "already-decided",
    });
  });

  it("approvalId 不一致・不正 decision・無記名 approver は拒否される", () => {
    expect(evaluateDecisionSignal(WAITING, { ...VALID, approvalId: "11111111-2222-4333-8444-555555555555" })).toEqual({
      accepted: false,
      reason: "approval-id-mismatch",
    });
    expect(evaluateDecisionSignal(WAITING, { ...VALID, decision: "auto-approve" as never })).toEqual({
      accepted: false,
      reason: "invalid-decision",
    });
    for (const approverObjectId of ["", "   "]) {
      expect(evaluateDecisionSignal(WAITING, { ...VALID, approverObjectId })).toEqual({
        accepted: false,
        reason: "missing-approver",
      });
    }
  });

  it("P3-T03-001: malformed payload（null/非 object/欠損 field）は throw せず理由付き拒否", () => {
    for (const malformed of [
      null,
      undefined,
      "approve",
      42,
      [],
      {},
      { approvalId: APPROVAL_ID },
      { ...VALID, version: "3" },
    ]) {
      expect(evaluateDecisionSignal(WAITING, malformed), JSON.stringify(malformed) ?? "undefined").toEqual({
        accepted: false,
        reason: "malformed-payload",
      });
    }
  });

  it("境界: 不正な approval 要求は E-CP-CONTRACT 相当の RangeError", () => {
    expect(() => assertApprovalRequest({ approvalId: APPROVAL_ID, version: 1, expiryMs: 1 })).not.toThrow();
    expect(() => assertApprovalRequest({ approvalId: "not-a-uuid", version: 1, expiryMs: 1 })).toThrow(RangeError);
    expect(() => assertApprovalRequest({ approvalId: APPROVAL_ID, version: 0, expiryMs: 1 })).toThrow(RangeError);
    expect(() => assertApprovalRequest({ approvalId: APPROVAL_ID, version: 1.5, expiryMs: 1 })).toThrow(RangeError);
    expect(() => assertApprovalRequest({ approvalId: APPROVAL_ID, version: 1, expiryMs: 0 })).toThrow(RangeError);
  });
});
