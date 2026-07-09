import { describe, expect, it } from "vitest";
import { InMemoryAuditLog, buildHolidayCalendar } from "@aiops/shared";
import type { ExecutiveProjectInput } from "@aiops/prjops";
import { createSevenKeysMonthlySnapshotTask } from "../src/scheduler/tasks/sevenKeysMonthlySnapshotTask.js";
import type { SevenKeysSnapshotRecord } from "../src/db/sevenKeysSnapshotsRepo.js";

const calendar = buildHolidayCalendar([]);
const project: ExecutiveProjectInput = {
  projectId: "PRJ-0001",
  name: "案件A",
  progressPct: 50,
  highSeverityOpenIssueCount: 1,
  isOverdue: false,
  scopeChangeCount: 0,
  averageReviewWaitHours: 12,
  activeContributorCount: 3,
};

describe("sevenKeysMonthlySnapshotTask (ADR-0010 / AC-038-1)", () => {
  it("AC-038-1: 第1営業日に前月RAGとの差分を保存する", async () => {
    const auditLog = new InMemoryAuditLog();
    const saved: unknown[] = [];
    const previous: SevenKeysSnapshotRecord = {
      month: "2026-06",
      projectId: "PRJ-0001",
      keysRag: { K1: "grey", K2: "grey", K3: "green", K4: "green", K5: "green", K6: "grey", K7: "grey" },
      improvedKeys: [],
      worsenedKeys: [],
      nextActions: [],
      generatedAt: "2026-06-01T00:00:00.000Z",
    };
    const task = createSevenKeysMonthlySnapshotTask({
      repo: {
        findByProjectMonth: async () => null,
        findLatestBefore: async () => previous,
        insert: async (snapshot, _generatedAt, nextActions) => {
          saved.push({ snapshot, nextActions });
          return true;
        },
      },
      provider: { listExecutiveProjects: async () => [project] },
      auditLog,
      calendar,
      traceIdProvider: () => "trace-seven",
    });

    await task.run(new Date("2026-07-01T00:00:00.000Z"));
    expect(saved).toHaveLength(1);
    expect(JSON.stringify(saved[0])).toContain("K3");
    expect(JSON.stringify(saved[0])).toContain("K6");
    const log = (await auditLog.readAll())[0]!;
    expect(log.actor).toBe("AGT-04");
    expect(log.action).toBe("seven_keys_monthly_snapshot_created");
  });

  it("AC-038-1: 同月再実行は保存せずskip監査ログを残す", async () => {
    const auditLog = new InMemoryAuditLog();
    const task = createSevenKeysMonthlySnapshotTask({
      repo: {
        findByProjectMonth: async () => ({ projectId: "PRJ-0001" }) as SevenKeysSnapshotRecord,
        findLatestBefore: async () => null,
        insert: async () => {
          throw new Error("must not insert duplicate month");
        },
      },
      provider: { listExecutiveProjects: async () => [project] },
      auditLog,
      calendar,
      traceIdProvider: () => "trace-seven",
    });

    await task.run(new Date("2026-07-01T00:00:00.000Z"));
    const log = (await auditLog.readAll())[0]!;
    expect(log.action).toBe("seven_keys_monthly_snapshot_skipped");
    expect(log.detail).toMatchObject({ month: "2026-07", created: 0, skipped: 1 });
  });

  it("AC-038-1: provider未設定時はdisabled理由を監査しcreated扱いにしない", async () => {
    const auditLog = new InMemoryAuditLog();
    const task = createSevenKeysMonthlySnapshotTask({
      repo: {
        findByProjectMonth: async () => null,
        findLatestBefore: async () => null,
        insert: async () => {
          throw new Error("must not insert when disabled");
        },
      },
      disabledReason: "PrjOps report data provider is not configured",
      auditLog,
      calendar,
      traceIdProvider: () => "trace-seven",
    });

    await task.run(new Date("2026-07-01T00:00:00.000Z"));
    const log = (await auditLog.readAll())[0]!;
    expect(log.action).toBe("seven_keys_monthly_snapshot_disabled");
    expect(log.detail).toMatchObject({ reason: "PrjOps report data provider is not configured" });
  });

  it("AC-038-1: providerが0件を返す場合はno_data監査にしcreated扱いにしない", async () => {
    const auditLog = new InMemoryAuditLog();
    const task = createSevenKeysMonthlySnapshotTask({
      repo: {
        findByProjectMonth: async () => null,
        findLatestBefore: async () => null,
        insert: async () => {
          throw new Error("must not insert without projects");
        },
      },
      provider: { listExecutiveProjects: async () => [] },
      auditLog,
      calendar,
      traceIdProvider: () => "trace-seven",
    });

    await task.run(new Date("2026-07-01T00:00:00.000Z"));
    const log = (await auditLog.readAll())[0]!;
    expect(log.action).toBe("seven_keys_monthly_snapshot_no_data");
    expect(log.detail).toMatchObject({ month: "2026-07", created: 0, skipped: 0 });
  });

  it("第1営業日以外は何もしない", async () => {
    const auditLog = new InMemoryAuditLog();
    const task = createSevenKeysMonthlySnapshotTask({
      repo: {
        findByProjectMonth: async () => null,
        findLatestBefore: async () => null,
        insert: async () => {
          throw new Error("must not run outside first business day");
        },
      },
      provider: { listExecutiveProjects: async () => [project] },
      auditLog,
      calendar,
      traceIdProvider: () => "trace-seven",
    });

    await task.run(new Date("2026-07-02T00:00:00.000Z"));
    expect(await auditLog.readAll()).toEqual([]);
  });
});
