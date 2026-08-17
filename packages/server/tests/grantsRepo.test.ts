/** 根拠: FinalArch:FR-UI-004 / UX-004 / DevOps:SPEC-INT-053 */
import { describe, expect, it, vi } from "vitest";

import { GrantsRepo, workbenchGrantTarget } from "../src/db/grantsRepo.js";

describe("Workbench grants authority [FinalArch:FR-UI-004 / UX-004]", () => {
  it.each([
    ["project", "PJ-001", "workbench:project:PJ-001"],
    ["repository", "mryfmo/ai-ops-platform", "workbench:repository:mryfmo/ai-ops-platform"],
    ["space", "33333333-3333-4333-8333-333333333333", "workbench:space:33333333-3333-4333-8333-333333333333"],
  ] as const)("builds a canonical %s capability target", (resourceType, resourceId, expected) => {
    expect(workbenchGrantTarget(resourceType, resourceId)).toBe(expected);
  });

  it("rejects an empty or control-character resource identifier", () => {
    expect(() => workbenchGrantTarget("project", "")).toThrow(TypeError);
    expect(() => workbenchGrantTarget("project", "PJ-001\nadmin")).toThrow(TypeError);
  });

  it("keeps Workbench capability rows out of the GitHub JIT revocation feed", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new GrantsRepo({ query }).loadActiveGrants();

    expect(String(query.mock.calls[0]?.[0])).toContain("target NOT LIKE 'workbench:%'");
  });
});
