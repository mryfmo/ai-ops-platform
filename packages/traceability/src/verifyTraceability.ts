/**
 * packages/traceability/src/verifyTraceability.ts
 *
 * 目的: 「仕様と実装コード」「仕様と検証コード」の相互参照を機械的に検証する。
 *   - packages/traceability/spec-ids/*.json に列挙された各ID（REQ/SPEC-EXT/SPEC-INT/TH/AC等）が、
 *     対応するsrc/配下（実装コード）およびtests/配下（検証コード）のコメント・文字列中に
 *     少なくとも1回参照されているかを確認する。
 *   - DOC-05 §11 実装完了の定義「本表の全SPEC-INTについて、対応するREQのACを検証するテストが存在し
 *     合格していること」に対応する機械チェックとして機能する。
 *
 * 制約: 本スクリプトは「参照されているか（文字列一致）」のみを確認する構文的チェックであり、
 *   実装の意味的正しさまでは保証しない（意味的正しさはテストの合否で担保する。README参照）。
 *   REQ/SPEC-INT/TH（要件・内部仕様・閾値）は実装必須と位置づけ、コード参照0件を検出エラーとする。
 *   ISS/TOBE/ASM（現状課題・将来プロセス・仮定）は文書間トレーサビリティの記録用IDであり、
 *   実装コードへの直接参照を必須としない（警告のみ）。
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { format as formatMarkdown } from "prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

interface SpecIndex {
  system: string;
  REQ?: string[];
  "SPEC-EXT"?: string[];
  "SPEC-INT"?: string[];
  TH?: string[];
  ISS?: string[];
  TOBE?: string[];
  ASM?: string[];
  AC?: string[];
}

function loadSpecIndex(file: string): SpecIndex {
  return JSON.parse(readFileSync(file, "utf8")) as SpecIndex;
}

function listFiles(dir: string, exts: string[], out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) listFiles(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

interface FileCorpus {
  srcText: string;
  testText: string;
}

function buildCorpus(packageDirs: string[]): FileCorpus {
  let srcText = "";
  let testText = "";
  for (const pkgDir of packageDirs) {
    const srcFiles = listFiles(join(pkgDir, "src"), [".ts", ".sql", ".yml", ".yaml"]);
    const testFiles = listFiles(join(pkgDir, "tests"), [".ts"]);
    for (const f of srcFiles) srcText += readFileSync(f, "utf8") + "\n";
    for (const f of testFiles) testText += readFileSync(f, "utf8") + "\n";
  }
  return { srcText, testText };
}

interface CategoryResult {
  category: string;
  total: number;
  inSrc: number;
  inTest: number;
  missingFromSrc: string[];
  missingFromTest: string[];
}

function checkCategory(ids: string[] | undefined, category: string, corpus: FileCorpus): CategoryResult {
  const list = ids ?? [];
  const missingFromSrc: string[] = [];
  const missingFromTest: string[] = [];
  let inSrc = 0;
  let inTest = 0;
  for (const id of list) {
    const inS = corpus.srcText.includes(id);
    const inT = corpus.testText.includes(id);
    if (inS) inSrc += 1;
    else missingFromSrc.push(id);
    if (inT) inTest += 1;
    else missingFromTest.push(id);
  }
  return { category, total: list.length, inSrc, inTest, missingFromSrc, missingFromTest };
}

function pct(n: number, total: number): string {
  if (total === 0) return "100";
  return ((n / total) * 100).toFixed(0);
}

function markdownTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)));
  const formatRow = (cells: string[]) => `| ${cells.map((c, i) => c.padEnd(widths[i]!)).join(" | ")} |`;
  return [
    formatRow(headers),
    `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`,
    ...rows.map((row) => formatRow(row)),
  ];
}

function formatResults(systemName: string, results: CategoryResult[]): string {
  const rows = results.map((r) => [
    r.category,
    String(r.total),
    `${r.inSrc} (${pct(r.inSrc, r.total)}%)`,
    `${r.inTest} (${pct(r.inTest, r.total)}%)`,
    r.missingFromSrc.join(", ") || "—",
  ]);
  const lines: string[] = [
    `## ${systemName}`,
    "",
    ...markdownTable(["カテゴリ", "総数", "実装参照あり", "テスト参照あり", "実装参照なし"], rows),
  ];
  return lines.join("\n");
}

async function main(): Promise<void> {
  const prjopsIndex = loadSpecIndex(join(__dirname, "..", "spec-ids", "prjops.json"));
  const devopsIndex = loadSpecIndex(join(__dirname, "..", "spec-ids", "devops.json"));

  const sharedDir = join(REPO_ROOT, "packages", "shared");
  const prjopsDir = join(REPO_ROOT, "packages", "prjops");
  const devopsDir = join(REPO_ROOT, "packages", "devops");
  const webDir = join(REPO_ROOT, "packages", "web");

  const prjopsCorpus = buildCorpus([sharedDir, prjopsDir, webDir]);
  const devopsCorpus = buildCorpus([sharedDir, devopsDir, webDir]);

  const prjopsResults: CategoryResult[] = [
    checkCategory(prjopsIndex.REQ, "REQ", prjopsCorpus),
    checkCategory(prjopsIndex["SPEC-EXT"], "SPEC-EXT", prjopsCorpus),
    checkCategory(prjopsIndex["SPEC-INT"], "SPEC-INT", prjopsCorpus),
    checkCategory(prjopsIndex.AC, "AC", prjopsCorpus),
    checkCategory(prjopsIndex.ISS, "ISS(参考)", prjopsCorpus),
    checkCategory(prjopsIndex.TOBE, "TOBE(参考)", prjopsCorpus),
    checkCategory(prjopsIndex.ASM, "ASM(参考)", prjopsCorpus),
  ];

  const devopsResults: CategoryResult[] = [
    checkCategory(devopsIndex.REQ, "REQ", devopsCorpus),
    checkCategory(devopsIndex["SPEC-EXT"], "SPEC-EXT", devopsCorpus),
    checkCategory(devopsIndex["SPEC-INT"], "SPEC-INT", devopsCorpus),
    checkCategory(devopsIndex.TH, "TH", devopsCorpus),
    checkCategory(devopsIndex.AC, "AC", devopsCorpus),
    checkCategory(devopsIndex.ISS, "ISS(参考)", devopsCorpus),
  ];

  const report = await formatMarkdown(
    [
      "# トレーサビリティ検証結果",
      "",
      `生成日時: ${new Date().toISOString()}`,
      "",
      "凡例: 「実装参照あり」= `packages/*/src` 配下のコード（コメント含む）にIDが1回以上出現。",
      "「テスト参照あり」= `packages/*/tests` 配下のテストコードにIDが1回以上出現。",
      "ISS/TOBE/ASMは文書間トレーサビリティの記録用IDであり、実装コードへの直接参照を必須としない（参考値）。",
      "",
      formatResults("PrjOps", prjopsResults),
      "",
      formatResults("DevOps", devopsResults),
      "",
    ].join("\n"),
    { parser: "markdown" },
  );

  const outDir = join(__dirname, "..", "output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "traceability_matrix.md"), report, "utf8");
  console.log(report);

  const mandatoryCategories = [...prjopsResults, ...devopsResults].filter((r) =>
    ["REQ", "SPEC-INT", "TH"].includes(r.category),
  );
  const hardFailures = mandatoryCategories.flatMap((r) => r.missingFromSrc);

  if (hardFailures.length > 0) {
    console.error(
      `\nE-TRACE01: 以下のID(REQ/SPEC-INT/TH)が実装コードに一切参照されていません: ${hardFailures.join(", ")}`,
    );
    process.exitCode = 1;
  } else {
    console.log("\nOK: 全REQ/SPEC-INT/TH IDが実装コードから最低1回参照されています。");
  }
}

await main();
