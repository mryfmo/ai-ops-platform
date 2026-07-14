/**
 * packages/server/src/scheduler/scheduler.ts
 *
 * 根拠: ADR-0005（常駐ループ）。DevOps:SPEC-INT-040（30秒ヘルスチェック）/
 *   DevOps:SPEC-INT-032（毎分JIT失効）は GitHub Actions cron（実用最短5分）では実現できないため、
 *   本スケジューラが常駐コンテナ内で担う（ADR-0003の未充足要件の実装）。
 *
 * 設計:
 *   - node-cron等は不採用（分単位粒度のため30秒要件を満たせない）
 *   - setTimeout再帰 + lib/schedulerPolicy.ts の純粋関数でドリフト補正・多重実行ガード
 *   - 1タスクの例外は他タスク・プロセスに波及させない（onErrorへ隔離）
 *   - SIGTERM時は stop() で実行中タスクの完了を待ってから解決（graceful shutdown）
 */
import type { AuditLogWriter } from "@aiops/shared";
import { performance } from "node:perf_hooks";
import { decideTick, nextCheckDelayMs, type TickState } from "../lib/schedulerPolicy.js";
import type { MetricsRegistry } from "../observability/metrics.js";

export interface ScheduledTask {
  /** 監査ログ・テレメトリで使う識別名（例: "healthcheck-30s", "jit-revocation-1m"） */
  name: string;
  intervalMs: number;
  /** プロセス再起動直後にも一度実行する（recovery taskのみ）。 */
  runOnStart?: boolean;
  run(now: Date): Promise<void>;
}

export interface SchedulerHandle {
  /** 新規tickを止め、実行中の run() の完了を待って解決する */
  stop(): Promise<void>;
}

export function guardFailsafeTask(
  task: ScheduledTask,
  deps: { isFailsafeActive(): boolean; auditLog: AuditLogWriter; traceIdProvider(): string },
): ScheduledTask {
  return {
    ...task,
    async run(now: Date): Promise<void> {
      if (!deps.isFailsafeActive()) {
        await task.run(now);
        return;
      }
      await deps.auditLog.append({
        trace_id: deps.traceIdProvider(),
        actor: "SERVER",
        action: "failsafe_task_skipped",
        basis: "REQ-029",
        detail: { taskName: task.name },
        at: now.toISOString(),
      });
    },
  };
}

export function instrumentScheduledTask(task: ScheduledTask, metrics: MetricsRegistry): ScheduledTask {
  return {
    ...task,
    async run(now: Date): Promise<void> {
      const started = performance.now();
      let status: "success" | "failure" = "success";
      try {
        await task.run(now);
      } catch (error) {
        status = "failure";
        metrics.recordTaskFailure(task.name);
        throw error;
      } finally {
        metrics.observeTaskDuration(task.name, status, (performance.now() - started) / 1000);
      }
    },
  };
}

export function startScheduler(
  tasks: ScheduledTask[],
  onError: (taskName: string, err: unknown) => void,
  nowProvider: () => Date = () => new Date(),
  monotonicNowProvider: () => number = () => performance.now(),
): SchedulerHandle {
  let stopped = false;
  const inflight = new Set<Promise<void>>();
  const timers = new Set<NodeJS.Timeout>();
  let lastMonotonicMs = monotonicNowProvider();
  if (!Number.isFinite(lastMonotonicMs)) throw new Error("monotonic clock must be finite");

  const monotonicNow = (): number => {
    const current = monotonicNowProvider();
    if (!Number.isFinite(current)) throw new Error("monotonic clock must be finite");
    lastMonotonicMs = Math.max(lastMonotonicMs, current);
    return lastMonotonicMs;
  };

  const scheduled = tasks.map((task) => ({
    task,
    state: { nextDueAtMs: lastMonotonicMs + task.intervalMs, running: false } satisfies TickState,
    startupComplete: !task.runOnStart,
  }));

  const schedule = (callback: () => void, delayMs: number): void => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delayMs);
    timers.add(timer);
  };

  const execute = (task: ScheduledTask, state: TickState): Promise<void> => {
    state.running = true;
    const promise = Promise.resolve()
      .then(() => {
        const wallNow = nowProvider();
        if (!Number.isFinite(wallNow.getTime())) throw new Error("wall clock must be a valid Date");
        return task.run(wallNow);
      })
      .catch((err) => onError(task.name, err))
      .finally(() => {
        state.running = false;
        inflight.delete(promise);
      });
    inflight.add(promise);
    return promise;
  };

  for (const scheduledTask of scheduled) {
    const { task, state } = scheduledTask;
    const tick = (): void => {
      if (stopped) return;
      if (!scheduledTask.startupComplete) {
        schedule(tick, 1000);
        return;
      }
      let nowMs: number;
      try {
        nowMs = monotonicNow();
      } catch (error) {
        onError(task.name, error);
        schedule(tick, 1000);
        return;
      }
      const decision = decideTick(state, nowMs, task.intervalMs);
      state.nextDueAtMs = decision.nextDueAtMs;

      if (decision.shouldRun) void execute(task, state);

      schedule(tick, nextCheckDelayMs(state.nextDueAtMs, nowMs));
    };

    schedule(tick, nextCheckDelayMs(state.nextDueAtMs, lastMonotonicMs));
  }

  const startup = Promise.resolve()
    .then(async () => {
      for (const scheduledTask of scheduled) {
        const { task, state } = scheduledTask;
        if (stopped) return;
        if (task.runOnStart) {
          await execute(task, state);
          scheduledTask.startupComplete = true;
          state.nextDueAtMs = lastMonotonicMs + task.intervalMs;
        }
      }
    })
    .catch((error) => onError("scheduler-startup", error))
    .finally(() => inflight.delete(startup));
  inflight.add(startup);

  return {
    async stop(): Promise<void> {
      stopped = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      await Promise.allSettled([...inflight]);
    },
  };
}
