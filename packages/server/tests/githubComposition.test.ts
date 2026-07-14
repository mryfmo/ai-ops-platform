/**
 * packages/server/tests/githubComposition.test.ts
 *
 * 根拠: DevOps:SPEC-INT-061。未認証時のcomposition-level GitHub機能停止判定を検証する。
 */
import { describe, expect, it } from "vitest";
import { githubCompositionPolicy } from "../src/index.js";

describe("GitHub authentication composition [DevOps:SPEC-INT-061]", () => {
  it("disabled modeはGitHub task/PMを無効化し、coding/xlsxの共通停止判定になる", () => {
    const policy = githubCompositionPolicy("disabled");

    expect(policy.enabled).toBe(false);
    expect(policy.blocksWhen(false)).toBe(true);
    expect(policy.blocksWhen(true)).toBe(true);
  });

  it.each(["app", "pat"] as const)("%s modeは通常のfailsafe判定を維持する", (mode) => {
    const policy = githubCompositionPolicy(mode);

    expect(policy.enabled).toBe(true);
    expect(policy.blocksWhen(false)).toBe(false);
    expect(policy.blocksWhen(true)).toBe(true);
  });
});
