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
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
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

export interface CategoryResult {
  category: string;
  total: number;
  inSrc: number;
  inTest: number;
  missingFromSrc: string[];
  missingFromTest: string[];
}

export function collectFailureMessages(
  results: CategoryResult[],
  basisFailures: string[],
  adrFailures: string[],
): string[] {
  const mandatory = results.filter((result) => ["REQ", "SPEC-INT", "TH"].includes(result.category));
  return [
    ...mandatory.flatMap((result) => result.missingFromSrc),
    ...basisFailures.map((file) => `basis header missing: ${file}`),
    ...adrFailures.map((id) => `ADR reference missing file: ${id}`),
  ];
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

function basisHeaderFailures(repoRoot: string): string[] {
  const reportingDir = join(repoRoot, "packages", "shared", "src", "reporting");
  const serverDir = join(repoRoot, "packages", "server", "src");
  return [...listFiles(reportingDir, [".ts"]), ...listFiles(serverDir, [".ts"])]
    .filter(
      (file) =>
        !readFileSync(file, "utf8")
          .slice(0, 500)
          .match(/根拠:[\s\S]*(REQ|SPEC-INT|AC|ADR)-\d{3,4}/),
    )
    .map((file) => file.replace(`${repoRoot}/`, ""));
}

function adrReferenceFailures(repoRoot: string): string[] {
  const adrDir = join(repoRoot, "docs", "adr");
  const generatedOutputDir = resolve(repoRoot, "packages", "traceability", "output");
  const files = [
    ...listFiles(join(repoRoot, "packages"), [".ts", ".md"]),
    ...listFiles(join(repoRoot, "docs"), [".md"]),
  ].filter((file) => !resolve(file).startsWith(`${generatedOutputDir}${sep}`));
  const refs = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(/ADR-(\d{4})/g)) refs.add(match[1]!);
  }
  return [...refs]
    .sort()
    .filter((id) => !readdirSync(adrDir).some((entry) => entry.startsWith(`${id}-`) && entry.endsWith(".md")))
    .map((id) => `ADR-${id}`);
}

export interface TraceabilityCliOptions {
  repoRoot?: string;
  writeOutput?: boolean;
  now?: Date;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

export interface TraceabilityRunResult {
  report: string;
  failures: string[];
  exitCode: 0 | 1;
  errorMessage?: string;
}

export async function runTraceability(options: TraceabilityCliOptions = {}): Promise<TraceabilityRunResult> {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const specIdsDir = join(repoRoot, "packages", "traceability", "spec-ids");
  const prjopsIndex = loadSpecIndex(join(specIdsDir, "prjops.json"));
  const devopsIndex = loadSpecIndex(join(specIdsDir, "devops.json"));

  const sharedDir = join(repoRoot, "packages", "shared");
  const prjopsDir = join(repoRoot, "packages", "prjops");
  const devopsDir = join(repoRoot, "packages", "devops");
  const serverDir = join(repoRoot, "packages", "server");
  const webDir = join(repoRoot, "packages", "web");

  const prjopsCorpus = buildCorpus([sharedDir, prjopsDir, serverDir, webDir]);
  const devopsCorpus = buildCorpus([sharedDir, devopsDir, serverDir, webDir]);

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
      `生成日時: ${(options.now ?? new Date()).toISOString()}`,
      "",
      "凡例: 「実装参照あり」= `packages/*/src` 配下のコード（コメント含む）にIDが1回以上出現。",
      "「テスト参照あり」= `packages/*/tests` 配下のテストコードにIDが1回以上出現。",
      "ISS/TOBE/ASMは文書間トレーサビリティの記録用IDであり、実装コードへの直接参照を必須としない（参考値）。",
      "",
      formatResults("PrjOps", prjopsResults),
      "",
      formatResults("DevOps", devopsResults),
      "",
      "## Traceability Guards",
      "",
      `- 根拠ヘッダ不足: ${basisHeaderFailures(repoRoot).join(", ") || "—"}`,
      `- 存在しないADR参照: ${adrReferenceFailures(repoRoot).join(", ") || "—"}`,
      "",
    ].join("\n"),
    { parser: "markdown" },
  );

  if (options.writeOutput !== false) {
    const outDir = join(repoRoot, "packages", "traceability", "output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "traceability_matrix.md"), report, "utf8");
  }

  const failures = collectFailureMessages(
    [...prjopsResults, ...devopsResults],
    basisHeaderFailures(repoRoot),
    adrReferenceFailures(repoRoot),
  );
  const errorMessage =
    failures.length > 0 ? `E-TRACE01: トレーサビリティ検証に失敗しました: ${failures.join(", ")}` : undefined;
  return { report, failures, exitCode: errorMessage ? 1 : 0, errorMessage };
}

export async function runTraceabilityCli(options: TraceabilityCliOptions = {}): Promise<number> {
  const result = await runTraceability(options);
  (options.stdout ?? console.log)(result.report);
  if (result.errorMessage) (options.stderr ?? console.error)(`\n${result.errorMessage}`);
  else (options.stdout ?? console.log)("\nOK: 全REQ/SPEC-INT/TH IDが実装コードから最低1回参照されています。");
  return result.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runTraceabilityCli();
}
