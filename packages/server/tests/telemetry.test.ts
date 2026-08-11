// 根拠: FinalArch:CON-002 / FinalArch:FR-OBS-001 / FinalArch:PRD-003 / ADR-0020
import { describe, expect, it, vi } from "vitest";
import { startTelemetry } from "../src/observability/telemetry.js";

describe("startTelemetry (A-2 / FinalArch:CON-002)", () => {
  it("OTLP endpoint未設定時もservice resourceを設定し、exporterは作らない [FinalArch:CON-002]", async () => {
    const logs: unknown[] = [];
    const environment: Record<string, string | undefined> = {};
    const createTraceExporter = vi.fn();
    const createNodeSdk = vi.fn();
    const handle = await startTelemetry(
      { serviceName: "test", serviceVersion: "1.0.0" },
      {
        info: (obj: unknown, msg?: string) => {
          logs.push({ obj, msg });
        },
      },
      {
        environment,
        createTraceExporter,
        createNodeSdk,
        getNodeAutoInstrumentations: vi.fn(),
      } as never,
    );
    await handle.shutdown();
    expect(JSON.stringify(logs)).toContain("telemetry disabled");
    expect(environment.OTEL_RESOURCE_ATTRIBUTES).toBe("service.name=test,service.version=1.0.0");
    expect(createTraceExporter).not.toHaveBeenCalled();
    expect(createNodeSdk).not.toHaveBeenCalled();
  });

  it("uses mock exporter/SDK and snapshots service resources [FinalArch:FR-OBS-001]", async () => {
    const environment: Record<string, string | undefined> = {
      OTEL_RESOURCE_ATTRIBUTES: "deployment.environment.name=test,service.version=old",
    };
    const exporter = { exporter: "mock" };
    const sdk = { start: vi.fn(), shutdown: vi.fn(async () => {}) };
    const createTraceExporter = vi.fn(() => exporter);
    const createNodeSdk = vi.fn(() => sdk);
    const instrumentations = [{ instrumentation: "mock" }];

    const handle = await startTelemetry(
      {
        serviceName: "aiops-server",
        serviceVersion: "2.3.4",
        otlpEndpoint: "https://otel.example.com/",
      },
      { info: vi.fn() } as never,
      {
        environment,
        createTraceExporter,
        createNodeSdk,
        getNodeAutoInstrumentations: () => instrumentations,
      } as never,
    );
    await handle.shutdown();

    expect(createTraceExporter).toHaveBeenCalledWith({ url: "https://otel.example.com/v1/traces" });
    expect(sdk.start).toHaveBeenCalledOnce();
    expect(sdk.shutdown).toHaveBeenCalledOnce();
    expect({
      resourceAttributes: environment.OTEL_RESOURCE_ATTRIBUTES,
      sdk: createNodeSdk.mock.calls[0]![0],
    }).toMatchInlineSnapshot(`
      {
        "resourceAttributes": "deployment.environment.name=test,service.name=aiops-server,service.version=2.3.4",
        "sdk": {
          "instrumentations": [
            {
              "instrumentation": "mock",
            },
          ],
          "serviceName": "aiops-server",
          "traceExporter": {
            "exporter": "mock",
          },
        },
      }
    `);
  });

  it("prefers the explicit traces endpoint and rejects unsafe resource values [FinalArch:CON-002]", async () => {
    const createTraceExporter = vi.fn(() => ({}));
    const deps = {
      environment: {} as Record<string, string | undefined>,
      createTraceExporter,
      createNodeSdk: vi.fn(() => ({ start: vi.fn(), shutdown: vi.fn(async () => {}) })),
      getNodeAutoInstrumentations: vi.fn(() => []),
    };
    await startTelemetry(
      {
        serviceName: "aiops-server",
        serviceVersion: "2.3.4",
        otlpEndpoint: "https://base.example.com",
        otlpTracesEndpoint: "https://traces.example.com/custom",
      },
      { info: vi.fn() } as never,
      deps as never,
    );

    expect(createTraceExporter).toHaveBeenCalledWith({ url: "https://traces.example.com/custom" });
    const longResourceValue = "x".repeat(512);
    const longResourceEnvironment = { OTEL_RESOURCE_ATTRIBUTES: `container.image.id=${longResourceValue}` };
    await startTelemetry(
      { serviceName: "aiops-server", serviceVersion: "2.3.4" },
      { info: vi.fn() } as never,
      { ...deps, environment: longResourceEnvironment } as never,
    );
    expect(longResourceEnvironment.OTEL_RESOURCE_ATTRIBUTES).toContain(longResourceValue);
    await expect(
      startTelemetry(
        { serviceName: "aiops-server", serviceVersion: `v${"x".repeat(255)}` },
        { info: vi.fn() } as never,
        deps as never,
      ),
    ).rejects.toThrow(/service.version/u);
    await expect(
      startTelemetry(
        { serviceName: ["ghp", "a".repeat(24)].join("_"), serviceVersion: "2.3.4" },
        { info: vi.fn() } as never,
        deps as never,
      ),
    ).rejects.toThrow(/service.name.*secrets/u);
    await expect(
      startTelemetry(
        { serviceName: "aiops-server", serviceVersion: "2.3.4" },
        { info: vi.fn() } as never,
        { ...deps, environment: { OTEL_RESOURCE_ATTRIBUTES: "deployment.environment.name=test=invalid" } } as never,
      ),
    ).rejects.toThrow(/OTEL_RESOURCE_ATTRIBUTES/u);
  });
});
