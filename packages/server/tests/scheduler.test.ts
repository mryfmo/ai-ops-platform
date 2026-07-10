/**
 * packages/server/tests/scheduler.test.ts
 *
 * 根拠: ADR-0005（常駐スケジューラ: 間隔実行・エラー隔離・graceful shutdown）
 *   / SPEC-INT-040（30秒）/ SPEC-INT-032（毎分）の呼び出しループ
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import { MetricsRegistry } from "../src/observability/metrics.js";
import {
  guardFailsafeTask,
  instrumentScheduledTask,
  startScheduler,
  type ScheduledTask,
} from "../src/scheduler/scheduler.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("startScheduler (ADR-0005)", () => {
  it("interval経過ごとにrunが呼ばれる", async () => {
    vi.useFakeTimers();
    const runs: number[] = [];
    const task: ScheduledTask = {
      name: "t1",
      intervalMs: 1000,
      run: async (now) => {
        runs.push(now.getTime());
      },
    };
    const handle = startScheduler([task], () => {});
    await vi.advanceTimersByTimeAsync(3500);
    expect(runs.length).toBe(3);
    await handle.stop();
  });

  it("1タスクの例外はonErrorへ隔離され、以降も実行が継続する", async () => {
    vi.useFakeTimers();
    const errors: string[] = [];
    let calls = 0;
    const task: ScheduledTask = {
      name: "flaky",
      intervalMs: 1000,
      run: async () => {
        calls += 1;
        if (calls === 1) throw new Error("boom");
      },
    };
    const handle = startScheduler([task], (name) => errors.push(name));
    await vi.advanceTimersByTimeAsync(2500);
    expect(errors).toEqual(["flaky"]);
    expect(calls).toBe(2); // 1回目の失敗後も2回目が実行される
    await handle.stop();
  });

  it("実行中はスキップされる（多重実行ガード）", async () => {
    vi.useFakeTimers();
    let started = 0;
    let resolveRun: (() => void) | null = null;
    const task: ScheduledTask = {
      name: "slow",
      intervalMs: 1000,
      run: async () => {
        started += 1;
        await new Promise<void>((resolve) => {
          resolveRun = resolve;
        });
      },
    };
    const handle = startScheduler([task], () => {});
    await vi.advanceTimersByTimeAsync(3500); // 3周期分経過してもrunning中
    expect(started).toBe(1);
    resolveRun!();
    await handle.stop();
  });

  it("stop()は新規tickを止め、実行中runの完了を待つ", async () => {
    vi.useFakeTimers();
    let completed = false;
    const task: ScheduledTask = {
      name: "graceful",
      intervalMs: 1000,
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        completed = true;
      },
    };
    const handle = startScheduler([task], () => {});
    await vi.advanceTimersByTimeAsync(1100); // run開始
    const stopPromise = handle.stop();
    await vi.advanceTimersByTimeAsync(600); // run内のsetTimeoutを消化
    await stopPromise;
    expect(completed).toBe(true);
  });
});

describe("guardFailsafeTask (REQ-029)", () => {
  it("フェイルセーフ中は変更系taskを止め、解除後に再開する", async () => {
    const auditLog = new InMemoryAuditLog();
    let failsafe = true;
    let runs = 0;
    const task = guardFailsafeTask(
      {
        name: "side-effect",
        intervalMs: 1000,
        run: async () => {
          runs += 1;
        },
      },
      {
        isFailsafeActive: () => failsafe,
        auditLog,
        traceIdProvider: () => "trace-fs",
      },
    );

    await task.run(new Date("2026-07-10T00:00:00Z"));
    expect(runs).toBe(0);
    failsafe = false;
    await task.run(new Date("2026-07-10T00:01:00Z"));
    expect(runs).toBe(1);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "failsafe_task_skipped" && l.basis === "REQ-029")).toBe(true);
  });
});

describe("instrumentScheduledTask (A-2)", () => {
  it("task durationと失敗counterを記録する", async () => {
    const metrics = new MetricsRegistry();
    const task = instrumentScheduledTask(
      {
        name: "observed",
        intervalMs: 1000,
        run: async () => {
          throw new Error("boom");
        },
      },
      metrics,
    );

    await expect(task.run(new Date())).rejects.toThrow("boom");
    const text = metrics.renderPrometheus();
    expect(text).toContain('aiops_task_failures_total{task="observed"} 1');
    expect(text).toContain('aiops_task_run_duration_seconds_count{task="observed",status="failure"} 1');
  });
});
