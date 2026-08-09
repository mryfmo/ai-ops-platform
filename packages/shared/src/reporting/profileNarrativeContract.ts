/**
 * packages/shared/src/reporting/profileNarrativeContract.ts
 *
 * 根拠: PrjOps:REQ-010 / PrjOps:REQ-011 / PrjOps:REQ-012 / PrjOps:REQ-013 /
 * PrjOps:REQ-014 / PrjOps:REQ-015 / PrjOps:REQ-016 / PrjOps:SPEC-INT-031 / DEC-SPEC-007。
 * D-15 の product-scope 判断までは、runtime へ接続せず pure contract として保持する。
 */

export const NARRATIVE_SLOTS_BY_PROFILE = {
  "PRF-01": ["own_progress_summary", "own_next_action"],
  "PRF-02": ["project_health_summary", "delivery_risk_summary"],
  "PRF-03": ["portfolio_summary", "escalation_summary"],
  "PRF-04": ["executive_summary", "decision_request_summary"],
  "PRF-05": ["investor_highlight", "investor_risk_outlook"],
} as const;

export type NarrativeProfile = keyof typeof NARRATIVE_SLOTS_BY_PROFILE;
export type NarrativeSlot = (typeof NARRATIVE_SLOTS_BY_PROFILE)[NarrativeProfile][number];
export type NarrativeSlotsFor<Profile extends NarrativeProfile> = Record<
  (typeof NARRATIVE_SLOTS_BY_PROFILE)[Profile][number],
  string
>;

/** DEC-SPEC-007: profile ごとの2スロット以外を fail closed で拒否する。 */
export function parseProfileNarrativeSlots<Profile extends NarrativeProfile>(
  raw: unknown,
  profile: Profile,
): NarrativeSlotsFor<Profile> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("E-RPC01: invalid profile narrative slots");
  }
  const value = raw as Record<string, unknown>;
  const expected = NARRATIVE_SLOTS_BY_PROFILE[profile] as readonly NarrativeSlot[] | undefined;
  if (!expected) throw new Error("E-RPC01: invalid profile narrative slots");
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    actual.some((slot) => !expected.includes(slot as NarrativeSlot)) ||
    expected.some((slot) => typeof value[slot] !== "string")
  ) {
    throw new Error("E-RPC01: invalid profile narrative slots");
  }
  return value as NarrativeSlotsFor<Profile>;
}
