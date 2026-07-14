/**
 * packages/server/tests/stakeholderYamlLoader.test.ts
 *
 * 根拠: PrjOps:REQ-002 / AUD-IMP-003（実データの関係者マスタ読込と未設定時の安全な縮退）。
 */
import { describe, expect, it, vi } from "vitest";
import { decideStakeholderMaster } from "../src/lib/stakeholderYamlLoader.js";

describe("stakeholder YAML loader [PrjOps:REQ-002] [AUD-IMP-003]", () => {
  it("未設定時のdecisionはnull resolverと正確な監査intentを返す", () => {
    const decision = decideStakeholderMaster(null);
    expect(decision.resolveCallerProfile("teams-user-101", "PJ-001")).toBeNull();
    expect(decision.auditIntent).toEqual({
      actor: "SERVER",
      action: "stakeholder_master_not_configured",
      basis: "PrjOps:REQ-002 AUD-IMP-003",
      detail: { reason: "STAKEHOLDERS_DIR is not configured" },
    });
  });

  it("設定時はhardened providerへ非同期委譲し、監査intentを返さない", async () => {
    const provider = {
      findProfileByTeamsUserId: vi.fn(async () => "PRF-02" as const),
    };
    const decision = decideStakeholderMaster(provider);
    await expect(decision.resolveCallerProfile("teams-user-101", "PJ-001")).resolves.toBe("PRF-02");
    expect(provider.findProfileByTeamsUserId).toHaveBeenCalledWith("teams-user-101", "PJ-001");
    expect(decision.auditIntent).toBeNull();
  });
});
