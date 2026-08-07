/**
 * packages/server/tests/logger.test.ts
 *
 * 根拠: ADR-0005 / DevOps:REQ-028。多段ネストした秘密キーのログ伏字を検証する。
 */
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/observability/logger.js";

const SECRET = "A040_SENTINEL";

function logAndCapture(payload: Record<string, unknown>): string {
  let output = "";
  const sink = new Writable({
    write(chunk, _encoding, done) {
      output += String(chunk);
      done();
    },
  });
  createLogger("info", sink).info(payload);
  return output;
}

describe("createLogger の多段 redact [ADR-0005 / DevOps:REQ-028]", () => {
  it.each([
    ["authorization", { request: { headers: { authorization: SECRET } } }],
    ["GRAPH_CLIENT_SECRET", { request: { config: { GRAPH_CLIENT_SECRET: SECRET } } }],
    ["authorization", { context: { request: { headers: { authorization: SECRET } } } }],
    ["GRAPH_CLIENT_SECRET", { context: { request: { config: { GRAPH_CLIENT_SECRET: SECRET } } } }],
  ])("深さ2・3の %s を伏せる [DevOps:REQ-028]", (_key, payload) => {
    const output = logAndCapture(payload);

    expect(output).not.toContain(SECRET);
    expect(output).toContain("[redacted]");
  });
});
