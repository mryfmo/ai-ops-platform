// 根拠: FinalArch:CON-001 / ADR-0020
// 受入条件「Temporal workflow code separated from activities」の機械検証。
// TypeScript AST で workflow 層の全ファイル（再帰）を解析し、activities への
// 実行時到達経路（静的 import・re-export・dynamic import・require・side-effect
// import、引用符種別を問わず）をすべて拒否する。許可は activities/types への
// type-only import のみ。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const workflowsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/workflows");

const TYPES_MODULE = /activities\/types(\.js)?$/u;
const ACTIVITIES = /activities/u;

/** workflow ソース 1 ファイル分の違反一覧を返す純粋解析関数。 */
export function activityBoundaryViolations(fileName: string, source: string): string[] {
  const violations: string[] = [];
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (ACTIVITIES.test(spec)) {
        const typeOnly = node.importClause?.isTypeOnly === true;
        if (!typeOnly) violations.push(`${fileName}: 実行時 import ${spec}`);
        else if (!TYPES_MODULE.test(spec)) violations.push(`${fileName}: types 以外への import ${spec}`);
      }
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (ACTIVITIES.test(spec) && (!node.isTypeOnly || !TYPES_MODULE.test(spec))) {
        violations.push(`${fileName}: 実行時 re-export ${spec}`);
      }
    }
    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) {
        const argument = node.arguments[0];
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          if (ACTIVITIES.test(argument.text)) {
            violations.push(`${fileName}: 動的 ${isRequire ? "require" : "import"} ${argument.text}`);
          }
        } else {
          violations.push(`${fileName}: 静的に検証できない動的 ${isRequire ? "require" : "import"}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

function workflowSources(dir: string = workflowsDir): Array<[string, string]> {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return workflowSources(p);
    if (!entry.name.endsWith(".ts")) return [];
    return [[path.relative(workflowsDir, p), fs.readFileSync(p, "utf8")]] as Array<[string, string]>;
  });
}

describe("FinalArch:CON-001 workflow 層は activity 実装から分離されている", () => {
  it("workflow 全ファイル（再帰）で activities への実行時到達経路がない", () => {
    const sources = workflowSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const [name, source] of sources) {
      expect(activityBoundaryViolations(name, source)).toEqual([]);
    }
  });

  it("回避形はすべて検出される（負 fixture）", () => {
    const bypasses: Array<[string, string]> = [
      ["single-quote", "import { impl } from '../activities/index.js';"],
      ["double-quote non-type", 'import { impl } from "../activities/index.js";'],
      ["value import of types module", 'import { helper } from "../activities/types.js";'],
      ["side-effect import", 'import "../activities/index.js";'],
      ["re-export", 'export { impl } from "../activities/index.js";'],
      ["re-export star", 'export * from "../activities/index.js";'],
      ["dynamic import", 'const m = await import("../activities/index.js");'],
      ["require", 'const m = require("../activities/index.js");'],
      ["non-literal dynamic import", "const m = await import(target);"],
    ];
    for (const [label, source] of bypasses) {
      expect(activityBoundaryViolations("fixture.ts", source).length, `未検出: ${label}`).toBeGreaterThan(0);
    }
  });

  it("許可形（activities/types への type-only import）は違反にならない", () => {
    const allowed = [
      'import type { ActivityDefinition } from "../activities/types.js";',
      "import type { ActivityDefinition } from '../activities/types.js';",
      'export type { ActivityDefinition } from "../activities/types.js";',
      'import { defineWorkflow } from "../lib/workflowId.js";',
    ];
    for (const source of allowed) {
      expect(activityBoundaryViolations("fixture.ts", source)).toEqual([]);
    }
  });

  it("workflow 層は非決定 API（Math.random / fetch / DB）を直接呼ばない", () => {
    for (const [name, source] of workflowSources()) {
      expect(source, `${name}: 非決定 API の直接使用は禁止`).not.toMatch(
        /\b(Math\.random|fetch\s*\(|new\s+Date\s*\()/u,
      );
    }
  });
});
