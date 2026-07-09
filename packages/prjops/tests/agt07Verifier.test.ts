import { describe, it, expect } from "vitest";
import { verifyReportBeforeDelivery } from "../src/agents/AGT07_verifier.js";

const cleanHtml = `<html><body><span data-src="projects/PJ-001#progress_pct">50</span></body></html>`;

describe("verifyReportBeforeDelivery [REQ-019 AC-019-1]", () => {
  it("すべて正常ならok=true", () => {
    const r = verifyReportBeforeDelivery({
      html: cleanHtml,
      numericLookup: () => "50",
      forbiddenTerms: [],
      intendedRecipientEmail: "pm@example.com",
      actualToEmail: "pm@example.com",
    });
    expect(r.ok).toBe(true);
    expect(r.failureCodes).toHaveLength(0);
  });

  it("(a)数値不一致でV-A", () => {
    const r = verifyReportBeforeDelivery({
      html: cleanHtml,
      numericLookup: () => "99",
      forbiddenTerms: [],
      intendedRecipientEmail: "pm@example.com",
      actualToEmail: "pm@example.com",
    });
    expect(r.ok).toBe(false);
    expect(r.failureCodes).toContain("V-A");
  });

  it("(b)禁止語彙検出でV-B", () => {
    const r = verifyReportBeforeDelivery({
      html: cleanHtml + "田中太郎",
      numericLookup: () => "50",
      forbiddenTerms: ["田中太郎"],
      intendedRecipientEmail: "pm@example.com",
      actualToEmail: "pm@example.com",
    });
    expect(r.failureCodes).toContain("V-B");
  });

  it("(c)プレースホルダ残存でV-C", () => {
    const r = verifyReportBeforeDelivery({
      html: cleanHtml + "{{未置換}}",
      numericLookup: () => "50",
      forbiddenTerms: [],
      intendedRecipientEmail: "pm@example.com",
      actualToEmail: "pm@example.com",
    });
    expect(r.failureCodes).toContain("V-C");
  });

  it("(d)宛先不一致でV-D", () => {
    const r = verifyReportBeforeDelivery({
      html: cleanHtml,
      numericLookup: () => "50",
      forbiddenTerms: [],
      intendedRecipientEmail: "pm@example.com",
      actualToEmail: "someone-else@example.com",
    });
    expect(r.failureCodes).toContain("V-D");
  });

  it("複数のNGが同時に検出される", () => {
    const r = verifyReportBeforeDelivery({
      html: cleanHtml + "{{x}}",
      numericLookup: () => "99",
      forbiddenTerms: [],
      intendedRecipientEmail: "a@example.com",
      actualToEmail: "b@example.com",
    });
    expect(r.failureCodes.sort()).toEqual(["V-A", "V-C", "V-D"]);
  });
});
