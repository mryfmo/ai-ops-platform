import { describe, expect, it } from "vitest";
import { startTelemetry } from "../src/observability/telemetry.js";

describe("startTelemetry (A-2)", () => {
  it("OTLP endpoint未設定時は明示ログしてno-opにする", async () => {
    const logs: unknown[] = [];
    const handle = await startTelemetry({ serviceName: "test" }, {
      info: (obj: unknown, msg?: string) => {
        logs.push({ obj, msg });
      },
    } as never);
    await handle.shutdown();
    expect(JSON.stringify(logs)).toContain("telemetry disabled");
  });
});
