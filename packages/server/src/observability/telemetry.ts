/**
 * packages/server/src/observability/telemetry.ts
 *
 * 根拠: ADR-0005。OpenTelemetry auto instrumentationをOTLP endpoint設定時だけ起動する。
 */
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { Logger } from "./logger.js";

export interface TelemetryConfig {
  serviceName: string;
  otlpEndpoint?: string;
  otlpTracesEndpoint?: string;
}

export interface TelemetryHandle {
  shutdown(): Promise<void>;
}

export async function startTelemetry(config: TelemetryConfig, logger: Logger): Promise<TelemetryHandle> {
  const endpoint = config.otlpTracesEndpoint ?? config.otlpEndpoint;
  if (!endpoint) {
    logger.info(
      { service: config.serviceName, reason: "OTEL exporter endpoint is not configured" },
      "telemetry disabled",
    );
    return { shutdown: async () => {} };
  }

  const url = config.otlpTracesEndpoint ?? `${endpoint.replace(/\/$/, "")}/v1/traces`;
  const sdk = new NodeSDK({
    serviceName: config.serviceName,
    traceExporter: new OTLPTraceExporter({ url }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  logger.info({ service: config.serviceName, tracesEndpoint: url }, "telemetry enabled");
  return { shutdown: () => sdk.shutdown() };
}
