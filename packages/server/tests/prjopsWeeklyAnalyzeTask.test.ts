/** 根拠: PrjOps:REQ-006/007 / PrjOps:SPEC-INT-040 */
import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import { createPrjopsWeeklyAnalyzeTask } from "../src/scheduler/tasks/prjopsWeeklyAnalyzeTask.js";

const project = {
  projectId: "PJ-001",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  asOfDate: "2026-07-20",
  progressPct: 50,
  highSeverityOpenIssueCount: 0,
  overdueActionCount: 0,
  selfStatus: "green" as const,
};

describe("prjopsWeeklyAnalyzeTask [PrjOps:REQ-006/007 / PrjOps:SPEC-INT-040]", () => {
  it("月曜06:00 JSTにactive projectを分析して監査する", async () => {
    const auditLog = new InMemoryAuditLog();
    const analyze = vi.fn(() => ({ projectId: "PJ-001", machineColor: "green" }));
    const task = createPrjopsWeeklyAnalyzeTask({
      provider: { listActiveProjects: async () => [project] },
      analyze,
      auditLog,
      traceIdProvider: () => "trace-weekly",
    });
    await task.run(new Date("2026-07-19T21:00:00Z"));
    expect(analyze).toHaveBeenCalledWith(project);
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("weekly_analysis_completed");
  });

  it("provider未設定はdisabled+audited", async () => {
    const auditLog = new InMemoryAuditLog();
    const task = createPrjopsWeeklyAnalyzeTask({ auditLog, traceIdProvider: () => "trace-disabled" });
    await task.run(new Date("2026-07-19T21:00:00Z"));
    expect((await auditLog.readAll())[0]).toMatchObject({ action: "weekly_analysis_disabled" });
  });

  it("10分間隔で2回retryし3回目失敗をPMOへ通知する", async () => {
    const auditLog = new InMemoryAuditLog();
    const analyze = vi.fn(() => {
      throw new Error("analysis failed");
    });
    const sendMail = vi.fn(async () => undefined);
    const task = createPrjopsWeeklyAnalyzeTask({
      provider: { listActiveProjects: async () => [project] },
      analyze,
      auditLog,
      traceIdProvider: () => "trace-retry",
      pmoNotifyMailbox: "pmo@example.com",
      fromMailbox: "reports@example.com",
      graphClient: { sendMail },
    });
    await task.run(new Date("2026-07-19T21:00:00Z"));
    await task.run(new Date("2026-07-19T21:09:00Z"));
    expect(analyze).toHaveBeenCalledTimes(1);
    await task.run(new Date("2026-07-19T21:10:00Z"));
    await task.run(new Date("2026-07-19T21:20:00Z"));
    expect(analyze).toHaveBeenCalledTimes(3);
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("PMO mail失敗時はweekly slotを完了せず10分後にmailだけ再試行する", async () => {
    const provider = vi.fn(async () => Promise.reject(new Error("analysis failed")));
    const sendMail = vi.fn().mockRejectedValueOnce(new Error("Graph unavailable")).mockResolvedValue(undefined);
    const task = createPrjopsWeeklyAnalyzeTask({
      provider: { listActiveProjects: provider },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-pmo-retry",
      pmoNotifyMailbox: "pmo@example.com",
      fromMailbox: "reports@example.com",
      graphClient: { sendMail },
    });
    await task.run(new Date("2026-07-19T21:00:00Z"));
    await task.run(new Date("2026-07-19T21:10:00Z"));
    await task.run(new Date("2026-07-19T21:20:00Z"));
    await task.run(new Date("2026-07-19T21:29:00Z"));
    expect(sendMail).toHaveBeenCalledOnce();
    await task.run(new Date("2026-07-19T21:30:00Z"));
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledTimes(3);
  });
});
