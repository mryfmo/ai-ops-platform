/** 根拠: PrjOps:REQ-006/009 / PrjOps:SPEC-INT-040 / PrjOps:SPEC-EXT-034/035 */
import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditLog, buildHolidayCalendar } from "@aiops/shared";
import { createPrjopsDailyTrackerTask } from "../src/scheduler/tasks/prjopsDailyTrackerTask.js";

const action = {
  id: "ACT-001",
  projectId: "PJ-001",
  due: "2026-07-20",
  status: "open" as const,
  assigneeEmail: "owner@example.com",
  managerEmail: "manager@example.com",
  remindersSentCountBaseline: 0,
};

describe("prjopsDailyTrackerTask [PrjOps:REQ-006/009 / PrjOps:SPEC-INT-040]", () => {
  it("営業日09:00 JSTにDB countをoverlayし成功直後にstateを保存する", async () => {
    const auditLog = new InMemoryAuditLog();
    const recordOutcome = vi.fn(async () => undefined);
    const processAction = vi.fn(async () => "reminded" as const);
    const task = createPrjopsDailyTrackerTask({
      provider: { listOpenActions: async () => [action] },
      stateRepo: {
        findMany: async () =>
          new Map([
            ["ACT-001", { actionId: "ACT-001", remindersSentCount: 1, lastNotifiedAt: null, escalatedAt: null }],
          ]),
        recordOutcome,
      },
      processAction,
      graphClient: { sendMail: vi.fn(), sendAdaptiveCard: vi.fn() },
      fromMailbox: "reports@example.com",
      calendar: buildHolidayCalendar([]),
      auditLog,
      traceIdProvider: () => "trace-daily",
    });
    await task.run(new Date("2026-07-20T00:00:00Z"));
    expect(processAction.mock.calls[0]![0]).toMatchObject({ id: "ACT-001", remindersSentCount: 1 });
    expect(recordOutcome).toHaveBeenCalledWith("ACT-001", "reminded", "2026-07-20T00:00:00.000Z", 0);
  });

  it("同日通知済みまたはescalated済みactionを再送しない", async () => {
    const processAction = vi.fn();
    const task = createPrjopsDailyTrackerTask({
      provider: { listOpenActions: async () => [action] },
      stateRepo: {
        findMany: async () =>
          new Map([
            [
              "ACT-001",
              {
                actionId: "ACT-001",
                remindersSentCount: 3,
                lastNotifiedAt: "2026-07-20T00:00:00.000Z",
                escalatedAt: null,
              },
            ],
          ]),
        recordOutcome: vi.fn(),
      },
      processAction,
      graphClient: { sendMail: vi.fn(), sendAdaptiveCard: vi.fn() },
      fromMailbox: "reports@example.com",
      calendar: buildHolidayCalendar([]),
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-dedupe",
    });
    await task.run(new Date("2026-07-20T00:00:00Z"));
    expect(processAction).not.toHaveBeenCalled();
  });

  it("providerまたはFROM_MAILBOX未設定はdisabled+audited", async () => {
    const auditLog = new InMemoryAuditLog();
    const task = createPrjopsDailyTrackerTask({
      stateRepo: { findMany: vi.fn(), recordOutcome: vi.fn() },
      calendar: buildHolidayCalendar([]),
      auditLog,
      traceIdProvider: () => "trace-disabled",
    });
    await task.run(new Date("2026-07-20T00:00:00Z"));
    expect((await auditLog.readAll())[0]).toMatchObject({ action: "daily_tracking_disabled" });
  });

  it("10分間隔で2回retryし3回目失敗をPMOへ通知する", async () => {
    const sendMail = vi.fn(async () => undefined);
    const task = createPrjopsDailyTrackerTask({
      provider: {
        listOpenActions: async () => {
          throw new Error("tracking failed");
        },
      },
      stateRepo: { findMany: vi.fn(), recordOutcome: vi.fn() },
      graphClient: { sendMail, sendAdaptiveCard: vi.fn() },
      fromMailbox: "reports@example.com",
      pmoNotifyMailbox: "pmo@example.com",
      calendar: buildHolidayCalendar([]),
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-retry",
    });
    await task.run(new Date("2026-07-20T00:00:00Z"));
    await task.run(new Date("2026-07-20T00:09:00Z"));
    expect(sendMail).not.toHaveBeenCalled();
    await task.run(new Date("2026-07-20T00:10:00Z"));
    await task.run(new Date("2026-07-20T00:20:00Z"));
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("3回目失敗時にPMO宛先が無ければdegradedを監査する", async () => {
    const auditLog = new InMemoryAuditLog();
    const task = createPrjopsDailyTrackerTask({
      provider: { listOpenActions: async () => Promise.reject(new Error("tracking failed")) },
      stateRepo: { findMany: vi.fn(), recordOutcome: vi.fn() },
      graphClient: { sendMail: vi.fn(), sendAdaptiveCard: vi.fn() },
      fromMailbox: "reports@example.com",
      calendar: buildHolidayCalendar([]),
      auditLog,
      traceIdProvider: () => "trace-degraded",
    });
    await task.run(new Date("2026-07-20T00:00:00Z"));
    await task.run(new Date("2026-07-20T00:10:00Z"));
    await task.run(new Date("2026-07-20T00:20:00Z"));
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("pmo_escalation_disabled");
  });
});
