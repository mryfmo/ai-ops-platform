import { describe, it, expect } from "vitest";
import {
  canTransitionReport,
  assertReportTransition,
  requiresApproval,
  detectPreApprovalDelivery,
} from "../src/lib/reportJobStateMachine.js";

describe("requiresApproval [ASM-004]", () => {
  it("PRF-04/05は承認必須", () => {
    expect(requiresApproval("PRF-04")).toBe(true);
    expect(requiresApproval("PRF-05")).toBe(true);
  });
  it("PRF-01/02/03は承認不要", () => {
    expect(requiresApproval("PRF-01")).toBe(false);
    expect(requiresApproval("PRF-02")).toBe(false);
    expect(requiresApproval("PRF-03")).toBe(false);
  });
});

describe("canTransitionReport [SPEC-INT-026 状態遷移]", () => {
  it("PRF-02: verified -> delivered は許可される（承認不要）", () => {
    expect(canTransitionReport("verified", "delivered", "PRF-02")).toBe(true);
  });
  it("PRF-04: verified -> delivered は許可されない（承認をスキップするため）", () => {
    expect(canTransitionReport("verified", "delivered", "PRF-04")).toBe(false);
  });
  it("PRF-04: verified -> pending_approval は許可される", () => {
    expect(canTransitionReport("verified", "pending_approval", "PRF-04")).toBe(true);
  });
  it("pending_approval -> approved / rejected は許可される", () => {
    expect(canTransitionReport("pending_approval", "approved", "PRF-05")).toBe(true);
    expect(canTransitionReport("pending_approval", "rejected", "PRF-05")).toBe(true);
  });
  it("approved -> delivered は許可される", () => {
    expect(canTransitionReport("approved", "delivered", "PRF-05")).toBe(true);
  });
  it("generated -> delivered のような飛び越しは許可されない", () => {
    expect(canTransitionReport("generated", "delivered", "PRF-02")).toBe(false);
  });
  it("delivered/rejected/failedは終端状態で以後の遷移がない", () => {
    expect(canTransitionReport("delivered", "generated", "PRF-02")).toBe(false);
    expect(canTransitionReport("rejected", "approved", "PRF-04")).toBe(false);
    expect(canTransitionReport("failed", "verified", "PRF-02")).toBe(false);
  });
});

describe("assertReportTransition [PrjOps:REQ-017 AC-017-1]", () => {
  it("不正な遷移は例外を投げる", () => {
    expect(() => assertReportTransition("generated", "delivered", "PRF-04")).toThrow(/E-RPT01/);
  });
  it("正しい遷移は例外を投げない", () => {
    expect(() => assertReportTransition("generated", "verified", "PRF-04")).not.toThrow();
  });
});

describe("detectPreApprovalDelivery [AC-017-1 監査ログからの機械検証]", () => {
  it("承認前配信があれば検出する", () => {
    const log: Array<"generated" | "verified" | "pending_approval" | "approved" | "delivered" | "rejected" | "failed"> =
      ["generated", "verified", "pending_approval", "delivered"];
    expect(detectPreApprovalDelivery(log, "PRF-04")).toBe(true);
  });
  it("正常な順序なら検出しない", () => {
    const log: Array<"generated" | "verified" | "pending_approval" | "approved" | "delivered"> = [
      "generated",
      "verified",
      "pending_approval",
      "approved",
      "delivered",
    ];
    expect(detectPreApprovalDelivery(log, "PRF-04")).toBe(false);
  });
  it("承認不要プロファイルには適用しない", () => {
    const log: Array<"generated" | "verified" | "delivered"> = ["generated", "verified", "delivered"];
    expect(detectPreApprovalDelivery(log, "PRF-02")).toBe(false);
  });
});
