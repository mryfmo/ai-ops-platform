import { describe, it, expect } from "vitest";
import { buildHolidayCalendar } from "@aiops/shared/calendar/businessCalendar.js";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import { runDailyTracking, type TrackedAction, type TrackerDependencies } from "../src/agents/AGT06_tracker.js";

const cal = buildHolidayCalendar([]);

function makeDeps(
  todayJst: string,
  overrides: Partial<TrackerDependencies> = {},
): { deps: TrackerDependencies; sentMails: string[] } {
  const sentMails: string[] = [];
  const auditLog = new InMemoryAuditLog();
  const deps: TrackerDependencies = {
    cal,
    graphClient: {
      sendMail: async (input) => {
        sentMails.push(`${input.toEmail}:${input.subject}`);
      },
      sendAdaptiveCard: async () => ({ messageId: "x" }),
    },
    auditLog,
    traceId: "trace-1",
    todayJst,
    fromMailbox: "prjops-system@example.com",
    managerEmailByProject: () => "manager@example.com",
    ...overrides,
  };
  return { deps, sentMails };
}

describe("runDailyTracking [REQ-009, SPEC-EXT-034/035]", () => {
  it("完了済みアクションには何もしない", async () => {
    const { deps, sentMails } = makeDeps("2026-07-07");
    const actions: TrackedAction[] = [
      {
        id: "ACT-0001",
        projectId: "PJ-001",
        due: "2026-07-06",
        status: "done",
        remindersSentCount: 0,
        assigneeEmail: "a@example.com",
      },
    ];
    const summary = await runDailyTracking(actions, deps);
    expect(summary.reminded).toHaveLength(0);
    expect(sentMails).toHaveLength(0);
  });

  it("超過当日に督促メールを送信し監査ログに記録する", async () => {
    const { deps, sentMails } = makeDeps("2026-07-07");
    const actions: TrackedAction[] = [
      {
        id: "ACT-0001",
        projectId: "PJ-001",
        due: "2026-07-06",
        status: "open",
        remindersSentCount: 0,
        assigneeEmail: "a@example.com",
      },
    ];
    const summary = await runDailyTracking(actions, deps);
    expect(summary.reminded).toEqual(["ACT-0001"]);
    expect(sentMails[0]).toContain("a@example.com");
    const logs = await deps.auditLog.readAll();
    expect(logs.some((l) => l.action === "reminder")).toBe(true);
  });

  it("3回督促超過でマネージャーへエスカレーションメールを送信する", async () => {
    const { deps, sentMails } = makeDeps("2026-07-20", { managerEmailByProject: () => "mgr@example.com" });
    const actions: TrackedAction[] = [
      {
        id: "ACT-0002",
        projectId: "PJ-001",
        due: "2026-07-06",
        status: "open",
        remindersSentCount: 3,
        assigneeEmail: "a@example.com",
      },
    ];
    const summary = await runDailyTracking(actions, deps);
    expect(summary.escalated).toEqual(["ACT-0002"]);
    expect(sentMails.some((m) => m.startsWith("mgr@example.com"))).toBe(true);
  });

  it("期限3営業日前には事前通知を送信する", async () => {
    const { deps, sentMails } = makeDeps("2026-07-06");
    const actions: TrackedAction[] = [
      {
        id: "ACT-0003",
        projectId: "PJ-001",
        due: "2026-07-09",
        status: "open",
        remindersSentCount: 0,
        assigneeEmail: "a@example.com",
      },
    ];
    const summary = await runDailyTracking(actions, deps);
    expect(summary.preDueNotified).toEqual(["ACT-0003"]);
    expect(sentMails[0]).toContain("期限3営業日前");
  });
});
