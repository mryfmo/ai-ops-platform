/**
 * 根拠: PrjOps:REQ-019 / PrjOps:SPEC-INT-051 / PrjOps:AC-019-1。
 */
import { describe, expect, it } from "vitest";
import type { StandardReportPayload } from "@aiops/shared";
import {
  evaluateReportVerificationGate,
  filterReportContentForRecipient,
  reportMetricDisplayValue,
} from "../src/lib/reportVerificationGate.js";

const payload: StandardReportPayload = {
  schemaVersion: "standard-report.v2",
  reportType: "weekly-summary",
  evidenceIds: ["PrjOps:REQ-019"],
  period: { label: "2026-W32", generatedAt: "2026-08-08T00:00:00.000Z" },
  metrics: {
    completed: { value: 7, source: "code:test", as_of: "2026-08-08T00:00:00.000Z" },
  },
  slots: { conclusion: "ok", riskSummary: "none", nextActions: "ship" },
};

const baseInput = {
  payload,
  html: '<span data-src="MTR-COMPLETED#value">7</span>',
  audience: "PRF-02" as const,
  personalNames: [] as string[],
  internalTerms: [] as string[],
  intendedRecipientEmail: "person@example.com",
  actualToEmail: "PERSON@example.com",
};

describe("reportVerificationGate [PrjOps:REQ-019 PrjOps:SPEC-INT-051 PrjOps:AC-019-1]", () => {
  it("out-of-scope metricが1件でもあれば非数値narrativeもpure policyでfail-closeする", () => {
    const result = filterReportContentForRecipient(
      {
        ...payload,
        metrics: {
          completed: {
            value: 7,
            source: "code:test",
            as_of: payload.period.generatedAt,
            scope: { kind: "project", projectId: "PJ-002" },
          },
        },
        slots: { ...payload.slots, conclusion: "Project Orion is delayed" },
      },
      "PRF-02",
      {
        recipientStakeholderId: "ST-001",
        projectIds: ["PJ-001"],
        scopeMode: "project",
        projectDomain: "prjops",
      },
    );

    expect(result.visibleMetricEntries).toEqual([]);
    expect(result.safeSlots).toEqual({ conclusion: "[masked]", riskSummary: "[masked]", nextActions: "[masked]" });
  });

  it("global recipientでもPrjOps/DevOps project名前空間を越えてmetricを公開しない", () => {
    const mixedPayload: StandardReportPayload = {
      ...payload,
      metrics: {
        completed: { ...payload.metrics.completed!, scope: { kind: "project", projectId: "PJ-001" } },
        blocked: { ...payload.metrics.completed!, scope: { kind: "project", projectId: "PRJ-001" } },
      },
    };
    const prjops = filterReportContentForRecipient(mixedPayload, "PRF-04", {
      recipientStakeholderId: "ST-001",
      projectIds: [],
      scopeMode: "global",
      projectDomain: "prjops",
    });
    const devops = filterReportContentForRecipient(mixedPayload, "PRF-04", {
      recipientStakeholderId: "ST-002",
      projectIds: [],
      scopeMode: "global",
      projectDomain: "devops",
    });

    expect(prjops.visibleMetricEntries.map(([key]) => key)).toEqual(["completed"]);
    expect(devops.visibleMetricEntries.map(([key]) => key)).toEqual(["blocked"]);
  });

  it("一致するmetricsと大文字小文字だけ異なる宛先を許可する", () => {
    expect(evaluateReportVerificationGate(baseInput)).toEqual({
      ok: true,
      failureCodes: [],
      errorCodes: [],
      details: [],
    });
  });

  it("unavailable metricはnullを描画せずN/Aで決定的に照合する", () => {
    const unavailablePayload: StandardReportPayload = {
      ...payload,
      metrics: {
        completed: {
          value: null,
          unavailable_reason: "missing_current",
          source: "code:test",
          as_of: "2026-08-08T00:00:00.000Z",
        },
      },
    };
    expect(reportMetricDisplayValue(unavailablePayload.metrics.completed!.value)).toBe("N/A");
    expect(
      evaluateReportVerificationGate({
        ...baseInput,
        payload: unavailablePayload,
        html: '<span data-src="MTR-COMPLETED#value">N/A</span>',
      }).ok,
    ).toBe(true);
  });

  it("metricsが空ならdata-src参照ゼロを正しく許可する", () => {
    expect(
      evaluateReportVerificationGate({
        ...baseInput,
        payload: { ...payload, metrics: {} },
        html: "<section><h2>Metrics</h2><dl></dl></section>",
      }).ok,
    ).toBe(true);
  });

  it("HTML escapeされた禁止語もV-Bとして検出する", () => {
    expect(
      evaluateReportVerificationGate({
        ...baseInput,
        html: "R&amp;D / O&#39;Connor",
        audience: "PRF-04",
        personalNames: ["R&D", "O'Connor"],
      }).failureCodes,
    ).toContain("V-B");
  });

  it.each([
    ["V-A", "E-VER0A", { html: '<span data-src="MTR-COMPLETED#value">8</span>' }],
    ["V-B", "E-VER0B", { html: "Alice", audience: "PRF-04", personalNames: ["Alice"] }],
    ["V-C", "E-VER0C", { html: "{{todo}}" }],
    ["V-D", "E-VER0D", { intendedRecipientEmail: "a@example.com", actualToEmail: "b@example.com" }],
  ] as const)("%sを対応する%sへ写像する", (failureCode, errorCode, overrides) => {
    const result = evaluateReportVerificationGate({ ...baseInput, ...overrides });
    expect(result.ok).toBe(false);
    expect(result.failureCodes).toContain(failureCode);
    expect(result.errorCodes).toContain(errorCode);
  });
});
