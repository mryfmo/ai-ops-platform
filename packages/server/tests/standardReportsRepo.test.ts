import { describe, it, expect } from "vitest";
import { StandardReportsRepo, standardReportId } from "../src/db/standardReportsRepo.js";
import type { StandardReportPayload } from "@aiops/shared";

const payload: StandardReportPayload = {
  schemaVersion: "standard-report.v1",
  reportType: "weekly-summary",
  evidenceIds: ["REQ-042"],
  period: { label: "2026-W28", generatedAt: "2026-07-06T00:00:00.000Z" },
  metrics: {},
  slots: { conclusion: "ok", riskSummary: "low", nextActions: "ship" },
};

describe("StandardReportsRepo [REQ-042 SPEC-INT-069]", () => {
  it("payloadから安定reportIdを生成する", () => {
    expect(standardReportId(payload)).toBe(standardReportId({ ...payload }));
  });

  it("reportIdは生成時刻の差で変わらない", () => {
    expect(standardReportId(payload)).toBe(
      standardReportId({
        ...payload,
        period: { ...payload.period, generatedAt: "2026-07-06T12:34:56.000Z" },
      }),
    );
  });

  it("ON CONFLICT DO NOTHINGで冪等insertする", async () => {
    const calls: unknown[][] = [];
    const repo = new StandardReportsRepo({
      query: async (_sql, params) => {
        calls.push(params ?? []);
        return { rows: [], rowCount: 1 };
      },
    });
    const result = await repo.insert(payload, "00000000-0000-0000-0000-000000000001");
    expect(result.created).toBe(true);
    expect(calls[0]![0]).toBe(standardReportId(payload));
  });
});
