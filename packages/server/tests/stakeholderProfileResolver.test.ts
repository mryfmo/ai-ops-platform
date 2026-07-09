/**
 * packages/server/tests/stakeholderProfileResolver.test.ts
 *
 * 根拠: ADR-0005 / REQ-002（Teams authorAadIdを関係者マスタのteams_user_idとproject assignmentへ突合）
 */
import { describe, expect, it } from "vitest";
import { resolveCallerProfileFromStakeholders } from "../src/lib/stakeholderProfileResolver.js";

const stakeholders = [
  {
    id: "ST-010",
    name: "山田太郎",
    organization_id: "ORG-001",
    assignments: [
      { project_id: "PJ-001", profile: "PRF-02" as const },
      { project_id: "PJ-002", profile: "PRF-01" as const },
    ],
    email: "yamada@example.com",
    teams_user_id: "29:1a2b3c-example-teams-id",
    preferred_language: "ja" as const,
    timezone: "Asia/Tokyo",
  },
];

describe("resolveCallerProfileFromStakeholders (ADR-0005 / REQ-002)", () => {
  it("teams_user_idとproject assignmentからprofileを解決する", () => {
    expect(resolveCallerProfileFromStakeholders(stakeholders, "29:1a2b3c-example-teams-id", "PJ-001")).toEqual({
      profile: "PRF-02",
      reason: "matched",
    });
  });

  it("project assignmentが無いauthorは拒否理由を返す", () => {
    expect(resolveCallerProfileFromStakeholders(stakeholders, "29:1a2b3c-example-teams-id", "PJ-999")).toEqual({
      profile: null,
      reason: "project_assignment_not_found",
    });
  });

  it("authorAadIdが無い場合は拒否理由を返す", () => {
    expect(resolveCallerProfileFromStakeholders(stakeholders, null, "PJ-001")).toEqual({
      profile: null,
      reason: "missing_author_aad_id",
    });
  });
});
