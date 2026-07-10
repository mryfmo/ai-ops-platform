/**
 * packages/server/src/main.ts
 *
 * 根拠: ADR-0005 / A-2。OpenTelemetry auto instrumentation をアプリケーション本体の
 * instrumented module import 前に起動する実行専用エントリ。
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { createLogger } from "./observability/logger.js";
import { startTelemetry } from "./observability/telemetry.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const telemetry = await startTelemetry(
    {
      serviceName: config.OTEL_SERVICE_NAME,
      otlpEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
      otlpTracesEndpoint: config.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    },
    logger,
  );
  const { main } = await import("./index.js");
  await main({ config, logger, telemetry });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  start().catch((err) => {
    createLogger(process.env.LOG_LEVEL ?? "info").error(
      { err: err instanceof Error ? err.message : String(err) },
      "fatal startup error",
    );
    process.exit(1);
  });
}
