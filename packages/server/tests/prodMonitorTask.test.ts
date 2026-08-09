/**
 * packages/server/tests/prodMonitorTask.test.ts
 *
 * 根拠: DevOps:REQ-012 / TH-003 / ADR-0014。
 */
import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import { createProdMonitorTask } from "../src/scheduler/tasks/prodMonitorTask.js";

const target = {
  deployId: "deploy-1",
  projectId: "PJ-001",
  owner: "acme",
  repo: "widget",
  commitSha: "a".repeat(40),
  channels: [{ teamId: "team", channelId: "channel" }],
};
const metrics = { samples: [{ atSecondsFromDeploy: 300, http5xxRatePct: 6, p95LatencyMs: 100 }], baselineP95Ms: 100 };

describe("production RED monitoring [DevOps:REQ-012 / TH-003]", () => {
  it("metrics不足は0へ補完せずevaluation-only監査にする", async () => {
    const evaluate = vi.fn();
    const auditLog = new InMemoryAuditLog();
    const task = createProdMonitorTask({
      deploymentsRepo: {
        listMonitoringTargets: vi.fn(async () => [target]),
        markRollingBack: vi.fn(),
        markRolledBack: vi.fn(),
      },
      metricsProvider: { read: vi.fn(async () => null) },
      stableVersionsProvider: { read: vi.fn(async () => null) },
      workflowExists: vi.fn(async () => false),
      evaluate,
      auditLog,
      traceIdProvider: () => "trace-monitor",
    });
    await task.run(new Date("2026-08-09T00:00:00Z"));
    expect(evaluate).not.toHaveBeenCalled();
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("prod_monitor_input_missing");
  });

  it("stable history不在でもTH-003は空履歴で評価しrollback dispatch不能を明示する", async () => {
    const evaluate = vi.fn(async () => ({ rolledBack: false, matchedConditions: ["a"] }));
    const auditLog = new InMemoryAuditLog();
    const task = createProdMonitorTask({
      deploymentsRepo: {
        listMonitoringTargets: vi.fn(async () => [target]),
        markRollingBack: vi.fn(),
        markRolledBack: vi.fn(),
      },
      metricsProvider: { read: vi.fn(async () => metrics) },
      stableVersionsProvider: { read: vi.fn(async () => null) },
      workflowExists: vi.fn(async () => false),
      evaluate,
      auditLog,
      traceIdProvider: () => "trace-history-missing",
    });
    await task.run(new Date("2026-08-09T00:00:00Z"));
    expect(evaluate).toHaveBeenCalledWith(metrics, [], target, target.channels[0], "trace-history-missing");
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("prod_monitor_stable_history_missing");
  });

  it("workflow不在ではstable履歴があっても空履歴で評価しdispatchを遮断する", async () => {
    const stable = [{ version: "v1", stableSince: "2026-08-08T00:00:00Z", stableDurationMinutesAsOfFailure: 20 }];
    const evaluate = vi.fn(async () => ({ rolledBack: false, matchedConditions: ["a"] }));
    const task = createProdMonitorTask({
      deploymentsRepo: {
        listMonitoringTargets: vi.fn(async () => [target]),
        markRollingBack: vi.fn(),
        markRolledBack: vi.fn(),
      },
      metricsProvider: { read: vi.fn(async () => metrics) },
      stableVersionsProvider: { read: vi.fn(async () => stable) },
      workflowExists: vi.fn(async () => false),
      evaluate,
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-workflow-guard",
    });
    await task.run(new Date("2026-08-09T00:00:00Z"));
    expect(evaluate).toHaveBeenCalledWith(metrics, [], target, target.channels[0], "trace-workflow-guard");
  });

  it("rollback dispatch前にmonitoringをCASし、成功後rolled_backへ終端する", async () => {
    const stable = [{ version: "v1", stableSince: "2026-08-08T00:00:00Z", stableDurationMinutesAsOfFailure: 20 }];
    const calls: string[] = [];
    const task = createProdMonitorTask({
      deploymentsRepo: {
        listMonitoringTargets: vi.fn(async () => [target]),
        markRollingBack: vi.fn(async () => {
          calls.push("rolling_back");
          return true;
        }),
        markRolledBack: vi.fn(async () => {
          calls.push("rolled_back");
        }),
      },
      metricsProvider: { read: vi.fn(async () => metrics) },
      stableVersionsProvider: { read: vi.fn(async () => stable) },
      workflowExists: vi.fn(async () => true),
      evaluate: vi.fn(async () => {
        calls.push("dispatch");
        return { rolledBack: true, matchedConditions: ["a"] };
      }),
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-rollback",
    });

    await task.run(new Date("2026-08-09T00:00:00Z"));

    expect(calls).toEqual(["rolling_back", "dispatch", "rolled_back"]);
  });
});
