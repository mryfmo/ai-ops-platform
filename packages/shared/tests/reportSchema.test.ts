/**
 * 根拠: PrjOps:REQ-019 / PrjOps:SPEC-INT-051 / PrjOps:AC-019-1。
 */
import { describe, expect, it } from "vitest";
import { STANDARD_REPORT_JSON_SCHEMA } from "../src/reporting/reportSchema.js";
import { validateStandardReportPayload } from "../src/reporting/reportValidation.js";

const base = {
  schemaVersion: "standard-report.v2",
  reportType: "weekly-summary",
  evidenceIds: ["PrjOps:REQ-019"],
  period: { label: "2026-W32", generatedAt: "2026-08-08T00:00:00.000Z" },
  slots: { conclusion: "ok", riskSummary: "none", nextActions: "ship" },
};

describe("metric scope schema [PrjOps:REQ-019 PrjOps:SPEC-INT-051]", () => {
  it.each([
    { kind: "project", projectId: "PJ-001" },
    { kind: "project", projectId: "PRJ-001" },
    { kind: "portfolio", projectIds: ["PJ-001", "PJ-002"] },
    { kind: "portfolio", projectIds: ["PJ-001", "PRJ-002"] },
  ])("v2 metric scope $kind を受理する", (scope) => {
    expect(
      validateStandardReportPayload({
        ...base,
        metrics: { completed: { value: 1, source: "code:test", as_of: base.period.generatedAt, scope } },
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("保存済みv2との互換性のためscope欠落を受理する", () => {
    expect(
      validateStandardReportPayload({
        ...base,
        metrics: { completed: { value: 1, source: "code:test", as_of: base.period.generatedAt } },
      }).ok,
    ).toBe(true);
  });

  it("公開producer JSON schemaはmeasured/unavailableのscopeを必須にする", () => {
    const variants = STANDARD_REPORT_JSON_SCHEMA.properties.metrics.additionalProperties.oneOf as readonly {
      required: readonly string[];
    }[];
    expect(variants.every((variant) => variant.required.includes("scope"))).toBe(true);
  });

  it.each([
    { kind: "project", projectId: "" },
    { kind: "portfolio", projectIds: [] },
    { kind: "portfolio", projectIds: ["PJ-001", "PJ-001"] },
    { kind: "project", projectId: "global" },
  ])("不正scopeを拒否する: $kind", (scope) => {
    expect(
      validateStandardReportPayload({
        ...base,
        metrics: { completed: { value: 1, source: "code:test", as_of: base.period.generatedAt, scope } },
      }).ok,
    ).toBe(false);
  });
});
