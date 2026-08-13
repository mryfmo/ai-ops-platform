// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
import { describe, expect, it } from "vitest";

import { buildIdempotencyKey, parseIdempotencyKey } from "../src/lib/idempotency.js";

describe("FinalArch:FR-CP-001 idempotency key の決定的構築（TMP-003 基盤）", () => {
  it("同一入力からは常に同一 key", () => {
    const a = buildIdempotencyKey("coding-task/PR-42", "createPullRequest", 0);
    const b = buildIdempotencyKey("coding-task/PR-42", "createPullRequest", 0);
    expect(a).toBe(b);
    expect(a).toBe("coding-task/PR-42#createPullRequest#0");
  });

  it("workflowId / activity / sequence のいずれかが違えば key も違う", () => {
    const base = buildIdempotencyKey("coding-task/PR-42", "createPullRequest", 0);
    expect(buildIdempotencyKey("coding-task/PR-43", "createPullRequest", 0)).not.toBe(base);
    expect(buildIdempotencyKey("coding-task/PR-42", "createIssue", 0)).not.toBe(base);
    expect(buildIdempotencyKey("coding-task/PR-42", "createPullRequest", 1)).not.toBe(base);
  });

  it("parse は build の逆関数（workflowId に区切り文字 / を含む場合も）", () => {
    const key = buildIdempotencyKey("incident/INC-2026.08:13", "postComment", 7);
    expect(parseIdempotencyKey(key)).toEqual({
      workflowId: "incident/INC-2026.08:13",
      activityName: "postComment",
      sequence: 7,
    });
  });

  it("境界: 不正な workflowId / activity / sequence は RangeError", () => {
    expect(() => buildIdempotencyKey("", "a", 0)).toThrow(RangeError);
    expect(() => buildIdempotencyKey("wf#1", "a", 0)).toThrow(RangeError);
    expect(() => buildIdempotencyKey("wf", "1abc", 0)).toThrow(RangeError);
    expect(() => buildIdempotencyKey("wf", "a b", 0)).toThrow(RangeError);
    expect(() => buildIdempotencyKey("wf", "a", -1)).toThrow(RangeError);
    expect(() => buildIdempotencyKey("wf", "a", 1.5)).toThrow(RangeError);
    expect(() => buildIdempotencyKey("wf", "a", Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("境界: 不正な key 文字列の parse は RangeError", () => {
    for (const bad of ["", "abc", "a#b", "#a#0", "wf##0", "wf#a#", "wf#a#x", "wf#a#-1"]) {
      expect(() => parseIdempotencyKey(bad), bad).toThrow(RangeError);
    }
  });
});
