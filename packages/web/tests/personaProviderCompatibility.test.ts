/**
 * 根拠: PrjOps:REQ-002, SPEC-INT-022
 */
import { YamlStakeholderMasterProvider } from "@aiops/prjops";
import { describe, expect, it } from "vitest";
import type { StakeholderMasterProvider } from "../src/server/personaResolver.js";

describe("YamlStakeholderMasterProvider compatibility [PrjOps:REQ-002, SPEC-INT-022]", () => {
  it("Webの実StakeholderMasterProvider contractへ代入できる [PrjOps:REQ-002, SPEC-INT-022]", () => {
    const provider: StakeholderMasterProvider = new YamlStakeholderMasterProvider("/stakeholders");
    expect(provider).toBeInstanceOf(YamlStakeholderMasterProvider);
  });
});
