/**
 * packages/server/tests/stakeholderYamlLoader.test.ts
 *
 * 根拠: REQ-002 / AUD-IMP-003（実データの関係者マスタ読込と未設定時の安全な縮退）。
 */
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { decideStakeholderMaster, loadStakeholdersFromYamlDirectory } from "../src/lib/stakeholderYamlLoader.js";

const validYaml = `
id: ST-101
name: Test User
organization_id: ORG-001
assignments:
  - project_id: PJ-001
    profile: PRF-02
email: test@example.com
teams_user_id: teams-user-101
preferred_language: ja
timezone: Asia/Tokyo
created_at: "2026-01-05T09:00:00+09:00"
updated_at: "2026-01-05T09:00:00+09:00"
updated_by: ST-102
`;

const fakeFs = (files: Record<string, string>) => ({
  readdirSync: () => Object.keys(files),
  readFileSync: (path: string) => files[path.split("/").at(-1)!]!,
});

describe("stakeholder YAML loader [REQ-002] [AUD-IMP-003]", () => {
  it("既存スキーマの正常なYAMLを読み込む", () => {
    expect(loadStakeholdersFromYamlDirectory("/stakeholders", fakeFs({ "ST-101.yaml": validYaml }), parse)).toEqual([
      expect.objectContaining({ id: "ST-101", teams_user_id: "teams-user-101" }),
    ]);
  });

  it.each([
    [
      "型不正",
      validYaml.replace(/assignments:\n {2}- project_id: PJ-001\n {4}profile: PRF-02/, "assignments: invalid"),
    ],
    ["列挙値不正", validYaml.replace("preferred_language: ja", "preferred_language: fr")],
    ["profile列挙値不正", validYaml.replace("profile: PRF-02", "profile: PRF-99")],
  ])("%sのYAMLをruntime境界で拒否する", (_label, yaml) => {
    expect(() => loadStakeholdersFromYamlDirectory("/stakeholders", fakeFs({ "ST-101.yaml": yaml }), parse)).toThrow(
      /ST-101\.yaml.*invalid stakeholder schema/,
    );
  });

  it("runtime shape通過後も既存validateStakeholderの意味検証を適用する", () => {
    const yaml = validYaml.replace(/assignments:\n {2}- project_id: PJ-001\n {4}profile: PRF-02/, "assignments: []");
    expect(() => loadStakeholdersFromYamlDirectory("/stakeholders", fakeFs({ "ST-101.yaml": yaml }), parse)).toThrow(
      /ST-101\.yaml.*E-MST05/,
    );
  });

  it("空ディレクトリは空のマスタとして読み込む", () => {
    expect(loadStakeholdersFromYamlDirectory("/stakeholders", fakeFs({}), parse)).toEqual([]);
  });

  it("未設定時のdecisionはnull resolverと正確な監査intentを返す", () => {
    const decision = decideStakeholderMaster(null);
    expect(decision.resolveCallerProfile("teams-user-101", "PJ-001")).toBeNull();
    expect(decision.auditIntent).toEqual({
      actor: "SERVER",
      action: "stakeholder_master_not_configured",
      basis: "REQ-002 AUD-IMP-003",
      detail: { reason: "STAKEHOLDERS_DIR is not configured" },
    });
  });

  it("設定時のdecisionは読み込んだマスタでprofileを解決し、監査intentを返さない", () => {
    const stakeholders = loadStakeholdersFromYamlDirectory(
      "/stakeholders",
      fakeFs({ "ST-101.yaml": validYaml }),
      parse,
    );
    const decision = decideStakeholderMaster(stakeholders);
    expect(decision.resolveCallerProfile("teams-user-101", "PJ-001")).toBe("PRF-02");
    expect(decision.auditIntent).toBeNull();
  });
});
