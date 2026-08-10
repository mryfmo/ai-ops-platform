/**
 * packages/server/src/serverLifecycle.ts
 *
 * 根拠: ADR-0005。readinessを落としてからHTTP drain、scheduler停止、DB終了を行う。
 */
import type { Pool } from "pg";
import type { SchedulerHandle } from "./scheduler/scheduler.js";
import type { Logger } from "./observability/logger.js";
import type { TelemetryHandle } from "./observability/telemetry.js";

export interface CloseableServer {
  close(callback?: (error?: Error) => void): void;
}

export function createShutdownSignalHandler(deps: {
  isShuttingDown(): boolean;
  shutdown(): Promise<void>;
  logger: Logger;
  exit(code: number): void;
}): () => Promise<void> {
  return async () => {
    if (deps.isShuttingDown()) return;
    deps.logger.info("shutdown signal received");
    try {
      await deps.shutdown();
      deps.exit(0);
    } catch (err) {
      deps.logger.error({ err: err instanceof Error ? err.message : String(err) }, "graceful shutdown failed");
      deps.exit(1);
    }
  };
}

export async function closeHttpServer(server: CloseableServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => (error ? reject(error) : resolve()));
  });
}

export async function gracefulShutdown(deps: {
  server: CloseableServer;
  /** FinalArch:FR-CP-008: legacy scheduler が flag で無効化された構成では null（stop をスキップ） */
  scheduler: SchedulerHandle | null;
  pool: Pick<Pool, "end">;
  telemetry?: TelemetryHandle;
  setShuttingDown(value: boolean): void;
  logger: Logger;
  timeoutMs?: number;
}): Promise<void> {
  deps.setShuttingDown(true);
  const shutdown = async (): Promise<void> => {
    await closeHttpServer(deps.server);
    await deps.scheduler?.stop();
    await deps.pool.end();
    await deps.telemetry?.shutdown();
  };
  let timeoutTimer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => reject(new Error("graceful shutdown timed out")), deps.timeoutMs ?? 25_000);
    timeoutTimer.unref?.();
  });
  try {
    await Promise.race([shutdown(), timeout]);
    deps.logger.info("graceful shutdown completed");
  } finally {
    clearTimeout(timeoutTimer!);
  }
}
