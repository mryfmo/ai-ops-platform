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

export async function closeHttpServer(server: CloseableServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => (error ? reject(error) : resolve()));
  });
}

export async function gracefulShutdown(deps: {
  server: CloseableServer;
  scheduler: SchedulerHandle;
  pool: Pick<Pool, "end">;
  telemetry?: TelemetryHandle;
  setShuttingDown(value: boolean): void;
  logger: Logger;
  timeoutMs?: number;
}): Promise<void> {
  deps.setShuttingDown(true);
  const shutdown = async (): Promise<void> => {
    await closeHttpServer(deps.server);
    await deps.scheduler.stop();
    await deps.pool.end();
    await deps.telemetry?.shutdown();
  };
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("graceful shutdown timed out")), deps.timeoutMs ?? 25_000);
  });
  await Promise.race([shutdown(), timeout]);
  deps.logger.info("graceful shutdown completed");
}
