import { describe, it, expect } from "vitest";
import { validateProject, validateStakeholder, validateOrganization } from "../src/lib/masterValidation.js";

describe("validateProject [REQ-001 AC-001-1]", () => {
  const validProject = {
    id: "PJ-001",
    name: "サンプル案件",
    leader_id: "ST-010",
    manager_id: "ST-020",
    organization_ids: ["ORG-001"],
    start_date: "2026-01-01",
    end_date: "2026-06-30",
    report_frequency: "weekly",
    status: "active",
  };

  it("全属性が揃っていればok", () => {
    const r = validateProject(validProject);
    expect(r.ok).toBe(true);
    expect(r.missingFields).toHaveLength(0);
  });

  it("属性が1つ欠けるとエラーになり、欠落属性名がエラーメッセージに含まれる", () => {
    const { manager_id: _manager_id, ...rest } = validProject;
    const r = validateProject(rest);
    expect(r.ok).toBe(false);
    expect(r.missingFields).toContain("manager_id");
    expect(r.errors.join(" ")).toContain("manager_id");
  });

  it("複数属性が欠けても全て列挙される", () => {
    const r = validateProject({ id: "PJ-002" });
    expect(r.missingFields.length).toBeGreaterThanOrEqual(7);
  });

  it("不正なstatus値はエラーになる", () => {
    const r = validateProject({ ...validProject, status: "archived" });
    expect(r.ok).toBe(false);
  });

  it("report_frequencyがweekly以外はエラーになる", () => {
    const r = validateProject({ ...validProject, report_frequency: "monthly" });
    expect(r.ok).toBe(false);
  });

  it("start_dateがend_dateより後ならエラーになる", () => {
    const r = validateProject({ ...validProject, start_date: "2026-12-01", end_date: "2026-01-01" });
    expect(r.ok).toBe(false);
  });

  it("空文字列は欠落として扱われる", () => {
    const r = validateProject({ ...validProject, name: "" });
    expect(r.missingFields).toContain("name");
  });

  it("空配列は欠落として扱われる（organization_ids）", () => {
    const r = validateProject({ ...validProject, organization_ids: [] });
    expect(r.missingFields).toContain("organization_ids");
  });
});

describe("validateStakeholder [REQ-002 AC-002-1]", () => {
  const valid = {
    id: "ST-010",
    name: "山田太郎",
    organization_id: "ORG-001",
    assignments: [
      { project_id: "PJ-001", profile: "PRF-02" as const },
      { project_id: "PJ-002", profile: "PRF-01" as const },
    ],
    email: "yamada@example.com",
    preferred_language: "ja" as const,
    timezone: "Asia/Tokyo",
  };

  it("複数プロジェクトに異なる立場で参加できる（AC-002-1）", () => {
    const r = validateStakeholder(valid);
    expect(r.ok).toBe(true);
  });

  it("emailの形式が不正ならエラー", () => {
    const r = validateStakeholder({ ...valid, email: "not-an-email" });
    expect(r.ok).toBe(false);
  });

  it("不正なprofile値はエラー", () => {
    const r = validateStakeholder({ ...valid, assignments: [{ project_id: "PJ-001", profile: "PRF-99" as never }] });
    expect(r.ok).toBe(false);
  });

  it("teams_user_idは任意（欠落してもエラーにならない）", () => {
    const { teams_user_id: _teams_user_id, ...rest } = valid as typeof valid & { teams_user_id?: string };
    const r = validateStakeholder(rest);
    expect(r.ok).toBe(true);
  });
});

describe("validateOrganization [REQ-002: 企業は国内/海外区分を持つ]", () => {
  it("必須属性が揃っていればok", () => {
    const r = validateOrganization({
      id: "ORG-001",
      name: "Acme Corp",
      country: "US",
      domestic_or_overseas: "overseas",
    });
    expect(r.ok).toBe(true);
  });
  it("countryが欠落するとエラー", () => {
    const r = validateOrganization({ id: "ORG-001", name: "Acme Corp", domestic_or_overseas: "overseas" });
    expect(r.ok).toBe(false);
    expect(r.missingFields).toContain("country");
  });
});
