import { describe, expect, it } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import { createPmSnapshotReconcileTask } from "../src/scheduler/tasks/pmSnapshotReconcileTask.js";
import type { PmTimeseriesRepo } from "../src/db/pmTimeseriesRepo.js";

describe("pmSnapshotReconcileTask (ADR-0007 / REQ-031 / SPEC-INT-081)", () => {
  it("AC-031a: rateLimit残量が少ない場合は保存せずskip監査ログを残す", async () => {
    const auditLog = new InMemoryAuditLog();
    const saved: unknown[] = [];
    const task = createPmSnapshotReconcileTask({
      repo: { recordSnapshot: async (snapshot: unknown) => saved.push(snapshot) } as unknown as PmTimeseriesRepo,
      client: { listCurrentSnapshots: async () => ({ rateLimit: { remaining: 1 }, snapshots: [] }) },
      auditLog,
      traceIdProvider: () => "trace-1",
      minRateLimitRemaining: 10,
    });

    await task.run(new Date("2026-07-09T00:00:00.000Z"));
    expect(saved).toEqual([]);
    expect((await auditLog.readAll()).map((r) => r.action)).toEqual(["pm_snapshot_reconcile_skipped"]);
  });

  it("SPEC-INT-081: GraphQL items->fieldValues相当のページを順にsnapshot保存する", async () => {
    const auditLog = new InMemoryAuditLog();
    const saved: unknown[] = [];
    let calls = 0;
    const task = createPmSnapshotReconcileTask({
      repo: { recordSnapshot: async (snapshot: unknown) => saved.push(snapshot) } as unknown as PmTimeseriesRepo,
      client: {
        listCurrentSnapshots: async () => {
          calls += 1;
          return calls === 1
            ? {
                rateLimit: { remaining: 999 },
                snapshots: [
                  {
                    projectId: "PJ-001",
                    repository: "octo/repo",
                    sourceType: "project_item" as const,
                    sourceId: "item-1",
                    state: "Todo",
                    payload: { fieldValues: [{ name: "Status", value: "Todo" }] },
                  },
                ],
                hasMore: true,
                nextCursor: "c2",
              }
            : { rateLimit: { remaining: 998 }, snapshots: [], hasMore: false };
        },
      },
      auditLog,
      traceIdProvider: () => "trace-2",
      minRateLimitRemaining: 10,
    });

    await task.run(new Date("2026-07-09T00:00:00.000Z"));
    expect(calls).toBe(2);
    expect(saved).toHaveLength(1);
    expect((await auditLog.readAll()).some((r) => r.action === "pm_snapshot_reconciled")).toBe(true);
  });
});
