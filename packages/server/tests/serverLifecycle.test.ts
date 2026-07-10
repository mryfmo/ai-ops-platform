import { afterEach, describe, expect, it, vi } from "vitest";
import { createShutdownSignalHandler, gracefulShutdown } from "../src/serverLifecycle.js";
import { createLogger } from "../src/observability/logger.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("gracefulShutdown (A-4)", () => {
  it("二重シグナル時はshutdown本体を1回だけ実行する", async () => {
    let shuttingDown = false;
    let shutdowns = 0;
    const exits: number[] = [];
    const handler = createShutdownSignalHandler({
      isShuttingDown: () => shuttingDown,
      shutdown: async () => {
        shuttingDown = true;
        shutdowns += 1;
      },
      logger: createLogger("silent"),
      exit: (code) => void exits.push(code),
    });

    await Promise.all([handler(), handler()]);

    expect(shutdowns).toBe(1);
    expect(exits).toEqual([0]);
  });

  it("readinessを落としてからHTTP drain、scheduler停止、pool終了を順に待つ", async () => {
    const calls: string[] = [];
    let shuttingDown = false;
    await gracefulShutdown({
      server: {
        close: (cb) => {
          calls.push("server.close");
          cb?.();
        },
      },
      scheduler: { stop: async () => void calls.push("scheduler.stop") },
      pool: { end: async () => void calls.push("pool.end") },
      telemetry: { shutdown: async () => void calls.push("telemetry.shutdown") },
      setShuttingDown: (value) => {
        shuttingDown = value;
        calls.push(`shuttingDown:${value}`);
      },
      logger: createLogger("silent"),
    });

    expect(shuttingDown).toBe(true);
    expect(calls).toEqual(["shuttingDown:true", "server.close", "scheduler.stop", "pool.end", "telemetry.shutdown"]);
  });

  it("正常終了後はtimeout timerを残さない", async () => {
    vi.useFakeTimers();
    await gracefulShutdown({
      server: { close: (cb) => cb?.() },
      scheduler: { stop: async () => {} },
      pool: { end: async () => {} },
      setShuttingDown: () => {},
      logger: createLogger("silent"),
      timeoutMs: 100,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("timeoutを超えたら失敗する", async () => {
    vi.useFakeTimers();
    const promise = gracefulShutdown({
      server: { close: () => {} },
      scheduler: { stop: async () => {} },
      pool: { end: async () => {} },
      setShuttingDown: () => {},
      logger: createLogger("silent"),
      timeoutMs: 100,
    });
    const assertion = expect(promise).rejects.toThrow("graceful shutdown timed out");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});
