// 根拠: FinalArch:CON-004, FinalArch:CON-005, ADR-0023
import { describe, expect, it } from "vitest";

import { isRiskLevel, RISK_LEVELS } from "../src/index.js";

describe("policy contracts [FinalArch:CON-004, FinalArch:CON-005]", () => {
  it("represents every canonical risk level from L0 through L6", () => {
    expect(RISK_LEVELS).toEqual(["L0", "L1", "L2", "L3", "L4", "L5", "L6"]);
  });

  it("rejects an unknown risk level at the TypeScript boundary", () => {
    expect(isRiskLevel("L6")).toBe(true);
    expect(isRiskLevel("L7")).toBe(false);
    expect(isRiskLevel(1)).toBe(false);
  });
});
