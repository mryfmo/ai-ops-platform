// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / ADR-0020
// 受入条件「vendor SDK does not leak into domain packages」の機械検証。
// 境界の意味論: vendor 依存は将来の統合実装ディレクトリ（src/impl/**）にのみ
// 封じ込めてよい。公開契約面（src/adapters/** / src/lib/** / src/index.ts）は
// vendor SDK を import・re-export してはならない（@aiops/shared と相対のみ許可）。
// TypeScript AST で全 import 形態（静的/side-effect/re-export/dynamic/require、
// 引用符種別非依存）を検査する。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const IMPL_DIR = "impl";
const ALLOWED = (specifier: string): boolean =>
  specifier === "@aiops/shared" || specifier.startsWith("./") || specifier.startsWith("../");

/** 契約面ソース 1 ファイル分の違反一覧（純粋解析関数）。 */
export function vendorImportViolations(fileName: string, source: string): string[] {
  const violations: string[] = [];
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const check = (specifier: string, form: string): void => {
    if (!ALLOWED(specifier)) violations.push(`${fileName}: ${form} ${specifier}`);
    else if (/\/impl\//u.test(specifier) || specifier.endsWith("/impl")) {
      violations.push(`${fileName}: 契約面から impl への ${form} ${specifier}`);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      check(node.moduleSpecifier.text, "import");
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      check(node.moduleSpecifier.text, "re-export");
    }
    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) {
        const argument = node.arguments[0];
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          check(argument.text, isRequire ? "require" : "dynamic import");
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

/** 契約面ファイルの一覧。除外は root 直下の src/impl サブツリーのみで、
 *  それ以外の場所にある impl という名前のディレクトリは走査対象に含める。 */
export function listContractFiles(rootDir: string): string[] {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const p = path.join(dir, entry.name);
      const relative = path.relative(rootDir, p);
      if (entry.isDirectory()) return relative === IMPL_DIR ? [] : walk(p);
      return entry.name.endsWith(".ts") ? [relative] : [];
    });
  return walk(rootDir);
}

function contractSources(): Array<[string, string]> {
  return listContractFiles(srcDir).map((relative) => [relative, fs.readFileSync(path.join(srcDir, relative), "utf8")]);
}

describe("FinalArch:CON-001 vendor SDK は契約面・ドメインに漏出しない", () => {
  it("契約面（src、impl/ を除く再帰）に vendor import / impl 参照がない", () => {
    const sources = contractSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const [name, source] of sources) {
      expect(vendorImportViolations(name, source)).toEqual([]);
    }
  });

  it("回避形はすべて検出される（負 fixture）", () => {
    const bypasses: Array<[string, string]> = [
      ["single-quote vendor", "import { Client } from '@vendor/sdk';"],
      ["double-quote vendor", 'import { Client } from "@vendor/sdk";'],
      ["side-effect vendor", 'import "@vendor/sdk/register";'],
      ["re-export vendor", 'export { Client } from "@vendor/sdk";'],
      ["re-export star vendor", 'export * from "@vendor/sdk";'],
      ["dynamic import vendor", 'const m = await import("@vendor/sdk");'],
      ["require vendor", 'const m = require("@vendor/sdk");'],
      ["non-literal dynamic import", "const m = await import(target);"],
      ["契約面から impl re-export", 'export { WorkIqHttpAdapter } from "./impl/workiqHttp.js";'],
    ];
    for (const [label, source] of bypasses) {
      expect(vendorImportViolations("fixture.ts", source).length, `未検出: ${label}`).toBeGreaterThan(0);
    }
  });

  it("走査は root の src/impl のみ除外し、入れ子の impl は対象に含める（回帰）", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "contract-scan-"));
    try {
      for (const [file, body] of [
        ["index.ts", "export {};"],
        ["impl/vendorOnly.ts", 'import "@vendor/sdk";'],
        ["adapters/impl/bypass.ts", 'import "@vendor/sdk";'],
        ["adapters/deep/impl/bypass2.ts", 'import "@vendor/sdk";'],
      ] as const) {
        const target = path.join(root, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body);
      }
      const files = listContractFiles(root).sort();
      expect(files).toEqual(["adapters/deep/impl/bypass2.ts", "adapters/impl/bypass.ts", "index.ts"]);
      for (const nested of ["adapters/impl/bypass.ts", "adapters/deep/impl/bypass2.ts"]) {
        expect(vendorImportViolations(nested, fs.readFileSync(path.join(root, nested), "utf8")).length).toBeGreaterThan(
          0,
        );
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("許可形（@aiops/shared・相対の契約 import）は違反にならない", () => {
    const allowed = [
      'import type { FetchLike } from "@aiops/shared";',
      "import type { VersionedRef } from './refs.js';",
      'export type { AdapterKind } from "./types.js";',
    ];
    for (const source of allowed) {
      expect(vendorImportViolations("fixture.ts", source)).toEqual([]);
    }
  });
});
