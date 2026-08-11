// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / ADR-0020
// 受入条件「vendor SDK does not leak into domain packages」の機械検証。
// この package の src は vendor SDK / HTTP クライアント実装を import しない
// （許可は @aiops/shared と相対 import のみ）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : entry.name.endsWith(".ts") ? [p] : [];
  });
}

describe("FinalArch:CON-001 vendor SDK はドメイン package に漏出しない", () => {
  it("src の import は @aiops/shared と相対パスに限られる", () => {
    const files = walk(srcDir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const [, specifier] of source.matchAll(/^import\s+[^;]*?from\s+"([^"]+)";/gmu)) {
        const allowed = specifier === "@aiops/shared" || specifier.startsWith("./") || specifier.startsWith("../");
        expect(allowed, `${path.relative(srcDir, file)}: 禁止 import ${specifier}`).toBe(true);
      }
    }
  });
});
