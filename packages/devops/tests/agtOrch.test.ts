import { describe, it, expect } from "vitest";
import { evaluateFailsafe, isOperationAllowedDuringFailsafe, decideOnSchemaViolation } from "../src/agents/AGT_ORCH.js";

describe("evaluateFailsafe [REQ-029]", () => {
  it("2回連続失敗ではフェイルセーフ発動しない", () => {
    expect(evaluateFailsafe({ consecutiveFailures: 2 })).toBe("none");
  });
  it("3回連続失敗でフェイルセーフ発動", () => {
    expect(evaluateFailsafe({ consecutiveFailures: 3 })).toBe("activate_failsafe");
  });
});

describe("isOperationAllowedDuringFailsafe [REQ-029(a)]", () => {
  it("権限剥奪(revoke)は継続許可される（安全側操作）", () => {
    expect(isOperationAllowedDuringFailsafe("revoke_permission")).toBe(true);
  });
  it("通知送信は許可される", () => {
    expect(isOperationAllowedDuringFailsafe("send_notification")).toBe(true);
  });
  it("自動デプロイは停止される", () => {
    expect(isOperationAllowedDuringFailsafe("auto_deploy")).toBe(false);
  });
  it("権限付与(grant)は停止される", () => {
    expect(isOperationAllowedDuringFailsafe("grant_permission")).toBe(false);
  });
  it("自動クローズは停止される", () => {
    expect(isOperationAllowedDuringFailsafe("auto_close_incident")).toBe(false);
  });
});

describe("decideOnSchemaViolation [逸脱監視: 最大2回リトライ]", () => {
  it("1回目・2回目はretry", () => {
    expect(decideOnSchemaViolation({ attemptNumber: 1 })).toBe("retry");
    expect(decideOnSchemaViolation({ attemptNumber: 2 })).toBe("retry");
  });
  it("3回目でescalate_to_human", () => {
    expect(decideOnSchemaViolation({ attemptNumber: 3 })).toBe("escalate_to_human");
  });
});
