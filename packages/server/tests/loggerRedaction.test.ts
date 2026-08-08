/**
 * packages/server/tests/loggerRedaction.test.ts
 *
 * 根拠: ADR-0005 / DevOps:REQ-028。構造化ログへ秘密が載る誤用に対する最終防波堤を検証する。
 *   所見 ADV-SEC-012（pino に redact 設定がない）。
 */
import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { createLogger, REDACT_PATHS } from "../src/observability/logger.js";

const SECRET = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";

function logAndCapture(payload: Record<string, unknown>): string {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(String(chunk));
      done();
    },
  });
  // 実際の createLogger を使う。設定を書き写すとpinoを検証するだけになる。
  createLogger("info", sink).info(payload, "test");
  return chunks.join("");
}

describe("createLogger の redact [ADR-0005 / DevOps:REQ-028]", () => {
  const topLevelKeys = REDACT_PATHS.filter((path) => !path.startsWith("*."));

  it.each(topLevelKeys)("トップレベルの %s を伏せる [DevOps:REQ-028]", (key) => {
    const output = logAndCapture({ [key]: SECRET });

    expect(output).not.toContain(SECRET);
    expect(output).toContain("[redacted]");
  });

  it.each(topLevelKeys)("ネストした %s も伏せる（config 丸ごと渡す誤用への防波堤） [DevOps:REQ-028]", (key) => {
    const output = logAndCapture({ config: { [key]: SECRET } });

    expect(output).not.toContain(SECRET);
    expect(output).toContain("[redacted]");
  });

  it("実際のServerConfigキー名を伏せる（config丸ごと渡す誤用の本命） [DevOps:REQ-028]", () => {
    // camelCase だけを並べても ServerConfig のプロパティには一つも当たらない。
    const output = logAndCapture({
      config: {
        GRAPH_CLIENT_SECRET: SECRET,
        METRICS_TOKEN: SECRET,
        CODING_TASK_CONFIRM_SECRET: SECRET,
        WEB_BFF_IDENTITY_SECRET: SECRET,
      },
    });

    expect(output).not.toContain(SECRET);
  });

  it("秘密でないフィールドはそのまま出す（過剰な伏字にしない） [DevOps:REQ-028]", () => {
    const output = logAndCapture({ traceId: "trace-1", reportId: "RPT-1" });

    expect(output).toContain("trace-1");
    expect(output).toContain("RPT-1");
  });
});
