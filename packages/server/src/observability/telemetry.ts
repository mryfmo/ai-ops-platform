/**
 * packages/server/src/observability/telemetry.ts
 *
 * 根拠: ADR-0005 / ADR-0020 / FinalArch:CON-002 / FinalArch:FR-OBS-001。
 * OpenTelemetry auto instrumentationをOTLP endpoint設定時だけ起動する。
 */
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { sanitizeSecrets } from "@aiops/shared";
import type { Logger } from "./logger.js";

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint?: string;
  otlpTracesEndpoint?: string;
}

export interface TelemetryHandle {
  shutdown(): Promise<void>;
}

type NodeSdkOptions = NonNullable<ConstructorParameters<typeof NodeSDK>[0]>;
type TraceExporterOptions = ConstructorParameters<typeof OTLPTraceExporter>[0];
type TelemetrySdk = Pick<NodeSDK, "start" | "shutdown">;

export interface TelemetryDependencies {
  environment: Record<string, string | undefined>;
  createTraceExporter(options: TraceExporterOptions): NodeSdkOptions["traceExporter"];
  createNodeSdk(options: NodeSdkOptions): TelemetrySdk;
  getNodeAutoInstrumentations(): NodeSdkOptions["instrumentations"];
}

const DEFAULT_DEPENDENCIES: TelemetryDependencies = {
  environment: process.env,
  createTraceExporter: (options) => new OTLPTraceExporter(options),
  createNodeSdk: (options) => new NodeSDK(options),
  getNodeAutoInstrumentations,
};
const OTEL_RESOURCE_ATTRIBUTE_MAX_LENGTH = 255;
function resourceValue(name: "service.name" | "service.version", value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > OTEL_RESOURCE_ATTRIBUTE_MAX_LENGTH) {
    throw new RangeError(`${name} must be between 1 and ${OTEL_RESOURCE_ATTRIBUTE_MAX_LENGTH} characters`);
  }
  if (sanitizeSecrets(trimmed).redactionCount > 0) throw new RangeError(`${name} must not contain secrets`);
  return trimmed;
}

function setServiceResourceAttributes(
  environment: Record<string, string | undefined>,
  serviceName: string,
  serviceVersion: string,
): void {
  const retained = (environment.OTEL_RESOURCE_ATTRIBUTES ?? "")
    .split(",")
    .map((attribute) => attribute.trim())
    .filter(Boolean)
    .flatMap((attribute) => {
      if (attribute.startsWith("service.name=") || attribute.startsWith("service.version=")) return [];
      const pair = attribute.split("=");
      if (pair.length !== 2)
        throw new RangeError(`invalid OTEL_RESOURCE_ATTRIBUTES entry ${JSON.stringify(attribute)}`);
      let key: string;
      let value: string;
      try {
        key = decodeURIComponent(pair[0]!.trim());
        value = decodeURIComponent(pair[1]!.trim());
      } catch {
        throw new RangeError(`invalid OTEL_RESOURCE_ATTRIBUTES encoding ${JSON.stringify(attribute)}`);
      }
      if (key.length < 1) throw new RangeError(`invalid OTEL_RESOURCE_ATTRIBUTES key ${JSON.stringify(attribute)}`);
      if (sanitizeSecrets(value).redactionCount > 0) {
        throw new RangeError(`OTEL_RESOURCE_ATTRIBUTES must not contain secrets`);
      }
      return [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`];
    });
  environment.OTEL_RESOURCE_ATTRIBUTES = [
    ...retained,
    `service.name=${encodeURIComponent(serviceName)}`,
    `service.version=${encodeURIComponent(serviceVersion)}`,
  ].join(",");
}

export async function startTelemetry(
  config: TelemetryConfig,
  logger: Logger,
  dependencies: TelemetryDependencies = DEFAULT_DEPENDENCIES,
): Promise<TelemetryHandle> {
  const serviceName = resourceValue("service.name", config.serviceName);
  const serviceVersion = resourceValue("service.version", config.serviceVersion);
  setServiceResourceAttributes(dependencies.environment, serviceName, serviceVersion);
  const endpoint = config.otlpTracesEndpoint ?? config.otlpEndpoint;
  if (!endpoint) {
    logger.info(
      { service: serviceName, serviceVersion, reason: "OTEL exporter endpoint is not configured" },
      "telemetry disabled",
    );
    return { shutdown: async () => {} };
  }

  const url = config.otlpTracesEndpoint ?? `${endpoint.replace(/\/$/, "")}/v1/traces`;
  const sdk = dependencies.createNodeSdk({
    serviceName,
    traceExporter: dependencies.createTraceExporter({ url }),
    instrumentations: dependencies.getNodeAutoInstrumentations(),
  });
  sdk.start();
  logger.info({ service: serviceName, serviceVersion, tracesEndpoint: url }, "telemetry enabled");
  return { shutdown: () => sdk.shutdown() };
}
