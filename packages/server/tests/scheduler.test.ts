/**
 * packages/server/tests/scheduler.test.ts
 *
 * 根拠: ADR-0005（常駐スケジューラ: 間隔実行・エラー隔離・graceful shutdown）
 *   / DevOps:SPEC-INT-040（30秒）/ DevOps:SPEC-INT-032（毎分）の呼び出しループ
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

const startTestScheduler = (tasks: ScheduledTask[], onError: (taskName: string, err: unknown) => void) =>
  startScheduler(
    tasks,
    onError,
    () => new Date(),
    () => Date.now(),
  );

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
    const handle = startTestScheduler([task], () => {});
    await vi.advanceTimersByTimeAsync(3500);
    expect(runs.length).toBe(3);
    await handle.stop();
  });

  it("runOnStart taskだけを起動直後に一度実行し、通常intervalを維持する", async () => {
    vi.useFakeTimers();
    const runs = { startup: 0, normal: 0 };
    const handle = startTestScheduler(
      [
        { name: "startup", intervalMs: 1000, runOnStart: true, run: async () => void (runs.startup += 1) },
        { name: "normal", intervalMs: 1000, run: async () => void (runs.normal += 1) },
      ],
      () => {},
    );
    await vi.advanceTimersByTimeAsync(20);
    expect(runs).toEqual({ startup: 1, normal: 0 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(runs).toEqual({ startup: 2, normal: 1 });
    await handle.stop();
  });

  it("runOnStart taskを配列順に直列実行する", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const handle = startTestScheduler(
      ["renewal", "polling"].map((name) => ({
        name,
        intervalMs: 60_000,
        runOnStart: true,
        run: async () => {
          events.push(`${name}:start`);
          await Promise.resolve();
          events.push(`${name}:end`);
        },
      })),
      () => {},
    );
    await vi.advanceTimersByTimeAsync(20);
    expect(events).toEqual(["renewal:start", "renewal:end", "polling:start", "polling:end"]);
    await handle.stop();
  });

  it("polling startupが停止中でも完了済みrenewalの通常cadenceを継続する", async () => {
    vi.useFakeTimers();
    let renewalRuns = 0;
    let releasePolling!: () => void;
    const handle = startTestScheduler(
      [
        { name: "renewal", intervalMs: 1000, runOnStart: true, run: async () => void (renewalRuns += 1) },
        {
          name: "polling",
          intervalMs: 5000,
          runOnStart: true,
          run: () => new Promise<void>((resolve) => void (releasePolling = resolve)),
        },
      ],
      () => {},
    );
    await vi.advanceTimersByTimeAsync(20);
    expect(renewalRuns).toBe(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(renewalRuns).toBe(3);
    releasePolling();
    await handle.stop();
  });

  it("first startup後にmonotonic clockがinvalidでもremaining startupをskipしない", async () => {
    const runs: string[] = [];
    let reads = 0;
    const errors: string[] = [];
    const handle = startScheduler(
      ["renewal", "polling"].map((name) => ({
        name,
        intervalMs: 60_000,
        runOnStart: true,
        run: async () => void runs.push(name),
      })),
      (name) => errors.push(name),
      () => new Date("2026-07-11T00:00:00Z"),
      () => (reads++ === 0 ? 0 : Number.NaN),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runs).toEqual(["renewal", "polling"]);
    expect(errors.length).toBeLessThanOrEqual(1);
    await handle.stop();
  });

  it("monotonic clockの後退をclampしhot loopを起こさない", async () => {
    vi.useFakeTimers();
    let monotonic = 0;
    let runs = 0;
    const handle = startScheduler(
      [{ name: "t", intervalMs: 1000, run: async () => void (runs += 1) }],
      () => {},
      () => new Date("2026-07-11T00:00:00Z"),
      () => monotonic,
    );
    monotonic = 1000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(runs).toBe(1);
    monotonic = 500;
    await vi.advanceTimersByTimeAsync(500);
    expect(runs).toBe(1);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(2);
    monotonic = 2000;
    await vi.advanceTimersByTimeAsync(500);
    expect(runs).toBe(2);
    await handle.stop();
  });

  it("invalid monotonic clockを起動時に拒否する", () => {
    expect(() =>
      startScheduler(
        [],
        () => {},
        () => new Date(),
        () => Number.NaN,
      ),
    ).toThrow(/monotonic/i);
  });

  it("invalid wall clockをtaskへ渡さずonErrorへ隔離する", async () => {
    const errors: unknown[] = [];
    let ran = false;
    let resolveError!: () => void;
    const errorReceived = new Promise<void>((resolve) => {
      resolveError = resolve;
    });
    const handle = startScheduler(
      [{ name: "wall", intervalMs: 1000, runOnStart: true, run: async () => void (ran = true) }],
      (_name, error) => {
        errors.push(error);
        resolveError();
      },
      () => new Date(Number.NaN),
      () => 0,
    );
    await errorReceived;
    expect(ran).toBe(false);
    expect(errors).toHaveLength(1);
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
    const handle = startTestScheduler([task], (name) => errors.push(name));
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
    const handle = startTestScheduler([task], () => {});
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
    const handle = startTestScheduler([task], () => {});
    await vi.advanceTimersByTimeAsync(1100); // run開始
    const stopPromise = handle.stop();
    await vi.advanceTimersByTimeAsync(600); // run内のsetTimeoutを消化
    await stopPromise;
    expect(completed).toBe(true);
  });

  it("mixed short/long timersを全てactive trackingしstop後にcallbackを残さない", async () => {
    vi.useFakeTimers();
    let longRuns = 0;
    const handle = startTestScheduler(
      [
        { name: "short", intervalMs: 10, run: async () => {} },
        { name: "long", intervalMs: 10_000, run: async () => void (longRuns += 1) },
      ],
      () => {},
    );
    await vi.advanceTimersByTimeAsync(200);
    await handle.stop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(longRuns).toBe(0);
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
