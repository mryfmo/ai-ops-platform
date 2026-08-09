/** 根拠: PrjOps:REQ-010..016 / PrjOps:SPEC-INT-031 / DEC-SPEC-007 */
import { describe, expect, it } from "vitest";
import {
  NARRATIVE_SLOTS_BY_PROFILE,
  parseProfileNarrativeSlots,
  type NarrativeProfile,
} from "../src/reporting/profileNarrativeContract.js";

const expectedSlots = {
  "PRF-01": ["own_progress_summary", "own_next_action"],
  "PRF-02": ["project_health_summary", "delivery_risk_summary"],
  "PRF-03": ["portfolio_summary", "escalation_summary"],
  "PRF-04": ["executive_summary", "decision_request_summary"],
  "PRF-05": ["investor_highlight", "investor_risk_outlook"],
} as const;

describe("profile narrative contract [PrjOps:REQ-010..016 / DEC-SPEC-007]", () => {
  it("PRF-01..05ごとのexact 10 slotsを保持する", () => {
    expect(NARRATIVE_SLOTS_BY_PROFILE).toEqual(expectedSlots);
  });

  it.each(Object.entries(expectedSlots))("%sは定義済みの2 slotsだけを受理する", (profile, slots) => {
    const raw = { [slots[0]]: "状況は安定しています。", [slots[1]]: "対応を継続します。" };
    expect(parseProfileNarrativeSlots(raw, profile as NarrativeProfile)).toEqual(raw);
    expect(() => parseProfileNarrativeSlots({ [slots[0]]: "不足です。" }, profile as NarrativeProfile)).toThrow(
      "E-RPC01",
    );
    expect(() => parseProfileNarrativeSlots({ ...raw, extra: "禁止" }, profile as NarrativeProfile)).toThrow("E-RPC01");
  });

  it("slot値がstring以外ならfail closedにする", () => {
    expect(() =>
      parseProfileNarrativeSlots({ own_progress_summary: "安定しています。", own_next_action: 1 }, "PRF-01"),
    ).toThrow("E-RPC01");
  });

  it("未知profileもcontract errorとしてfail closedにする", () => {
    expect(() => parseProfileNarrativeSlots({}, "PRF-99" as NarrativeProfile)).toThrow("E-RPC01");
  });
});
