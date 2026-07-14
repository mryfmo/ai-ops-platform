import { describe, expect, it, vi } from "vitest";
import { PmTimeseriesRepo } from "../src/db/pmTimeseriesRepo.js";

describe("PmTimeseriesRepo (ADR-0007 / REQ-036 / PrjOps:SPEC-INT-062 / DevOps:REQ-031 / SPEC-INT-081)", () => {
  it("AC-036-1: pm_events raw_payloadをsanitizeして保存する", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = new PmTimeseriesRepo({ query });
    await repo.recordEvent({
      traceId: "00000000-0000-4000-8000-000000000001",
      eventName: "issues",
      action: "opened",
      projectId: "PJ-001",
      repository: "octo/repo",
      subjectType: "issue",
      subjectId: "1",
      occurredAt: "2026-07-09T00:00:00.000Z",
      normalized: { ok: true },
      rawPayload: { authorization: "Bearer abcdefghijklmnopqrstuvwxyz" },
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO pm_events"), expect.any(Array));
    expect(JSON.stringify(query.mock.calls[0]![1])).toContain("***REDACTED:generic_bearer***");
  });

  it("AC-036-1: pm_events from_status/to_statusを保存する", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = new PmTimeseriesRepo({ query });
    await repo.recordEvent({
      traceId: "00000000-0000-4000-8000-000000000001",
      eventName: "projects_v2_item",
      action: "edited",
      projectId: "PVT_1",
      repository: "octo/repo",
      subjectType: "project_item",
      subjectId: "PVTI_1",
      occurredAt: "2026-07-09T00:00:00.000Z",
      fromStatus: "Todo",
      toStatus: "Done",
      normalized: {},
      rawPayload: {},
    });
    expect(query.mock.calls[0]![1]).toEqual(expect.arrayContaining(["projects_v2_item", "Todo", "Done"]));
  });

  it("AC-031a: pm_snapshotsをupsert相当で保存する", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = new PmTimeseriesRepo({ query });
    await repo.recordSnapshot({
      traceId: "00000000-0000-4000-8000-000000000001",
      projectId: "PJ-001",
      repository: "octo/repo",
      sourceType: "project_item",
      sourceId: "item-1",
      state: "Todo",
      capturedAt: "2026-07-09T00:00:00.000Z",
      payload: { client_secret: "0123456789abcdef0123" },
    });
    expect(query.mock.calls[0]![0]).toContain("ON CONFLICT");
    expect(JSON.stringify(query.mock.calls[0]![1])).toContain("***REDACTED:azure_client_secret_kv***");
  });
});
