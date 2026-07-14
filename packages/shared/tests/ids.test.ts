import { describe, it, expect } from "vitest";
import { isValidId, formatProjectId, formatStatusUpdateId, formatReportId, newTraceId, isoWeekOf } from "../src/ids.js";
import { resolveLanguage } from "../src/language.js";

describe("ID formatting/validation [DOC-00 §6]", () => {
  it("PJ-nnn形式を正しく検証する", () => {
    expect(isValidId("project", "PJ-001")).toBe(true);
    expect(isValidId("project", "PJ-1")).toBe(false);
    expect(formatProjectId(1)).toBe("PJ-001");
    expect(formatProjectId(123)).toBe("PJ-123");
  });

  it("status_update ID (PrjOps:SPEC-INT-020) を正しく生成・検証する", () => {
    const id = formatStatusUpdateId("PJ-001", 2026, 27, 1);
    expect(id).toBe("SU-PJ-001-2026-W27-1");
    expect(isValidId("statusUpdate", id)).toBe(true);
  });

  it("report ID (SPEC-INT-026) を生成する", () => {
    const id = formatReportId("PRF-02", "PJ-001", "2026-W27", "ST-010");
    expect(id).toBe("RPT-PRF-02-PJ-001-2026-W27-ST-010");
  });

  it("newTraceIdはUUID形式の一意な値を返す", () => {
    const a = newTraceId();
    const b = newTraceId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("isoWeekOfはISO週番号を正しく計算する（2026-07-06は第28週）", () => {
    const { isoYear, isoWeek } = isoWeekOf("2026-07-06");
    expect(isoYear).toBe(2026);
    expect(isoWeek).toBe(28);
  });
});

describe("resolveLanguage [ASM-002, DOC-05 §8]", () => {
  it("preferredLanguageが設定されていればそれを優先する", () => {
    expect(resolveLanguage({ preferredLanguage: "en", organizationCountry: "JP" })).toBe("en");
  });
  it("未設定時、国内企業(JP)はja", () => {
    expect(resolveLanguage({ organizationCountry: "JP" })).toBe("ja");
  });
  it("未設定時、海外企業はen", () => {
    expect(resolveLanguage({ organizationCountry: "US" })).toBe("en");
    expect(resolveLanguage({})).toBe("en");
  });
});
