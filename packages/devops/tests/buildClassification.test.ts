import { describe, it, expect } from "vitest";
import { applyConfidenceGuard, type ClassificationResult } from "../src/lib/buildClassification.js";

const base: ClassificationResult = {
  classification: "test_failure",
  failed_job: "build",
  failed_step: "run tests",
  log_excerpt: "AssertionError: expected true to be false",
  confidence: 0.9,
};

describe("applyConfidenceGuard [SPEC-INT-011 手順6, AC-001c]", () => {
  it("confidence>=0.6ならそのまま", () => {
    expect(applyConfidenceGuard(base).classification).toBe("test_failure");
  });
  it("confidence=0.6ちょうどはそのまま（境界値、閾値未満のみ強制）", () => {
    expect(applyConfidenceGuard({ ...base, confidence: 0.6 }).classification).toBe("test_failure");
  });
  it("confidence<0.6ならunknownへ強制される", () => {
    expect(applyConfidenceGuard({ ...base, confidence: 0.59 }).classification).toBe("unknown");
  });
  it("すでにunknownならそのまま", () => {
    expect(applyConfidenceGuard({ ...base, classification: "unknown", confidence: 0.1 }).classification).toBe(
      "unknown",
    );
  });
});
