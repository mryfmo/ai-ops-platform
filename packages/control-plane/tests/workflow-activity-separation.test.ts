// 根拠: FinalArch:CON-001 / ADR-0020
// 受入条件「Temporal workflow code separated from activities」の機械検証。
// workflow 層は activities からは型定義ファイル（activities/types）のみ、
// かつ type-only import しか行えない（決定性の構造的保証）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workflowsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/workflows");

function workflowSources(): Array<[string, string]> {
  return fs
    .readdirSync(workflowsDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => [name, fs.readFileSync(path.join(workflowsDir, name), "utf8")]);
}

describe("FinalArch:CON-001 workflow 層は activity 実装から分離されている", () => {
  it("activities への import は activities/types への type-only import に限られる", () => {
    const sources = workflowSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const [name, source] of sources) {
      const activityImports = [...source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]*activities[^"]*)";/gmu)];
      for (const [, typeOnly, specifier] of activityImports) {
        expect(typeOnly, `${name}: activities からの import は type-only でなければならない`).toBeTruthy();
        expect(specifier, `${name}: activities からは types モジュールのみ import できる`).toMatch(
          /activities\/types(\.js)?$/u,
        );
      }
    }
  });

  it("workflow 層は非決定 API（Date.now / Math.random / fetch / DB）を直接呼ばない", () => {
    for (const [name, source] of workflowSources()) {
      expect(source, `${name}: 非決定 API の直接使用は禁止`).not.toMatch(
        /\b(Date\.now|Math\.random|fetch\s*\(|new\s+Date\s*\()/u,
      );
    }
  });
});
