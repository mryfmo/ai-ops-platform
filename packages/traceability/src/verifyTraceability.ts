/**
 * packages/traceability/src/verifyTraceability.ts
 *
 * 根拠: PrjOps:REQ-043 / PrjOps:SPEC-INT-070 / PrjOps:AC-043-1 /
 *   DevOps:REQ-033 / DevOps:SPEC-INT-084 / DevOps:AC-033a。
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

interface ParsedReferences {
  canonical: Set<string>;
  bare: Set<string>;
  failures: string[];
}

const SPEC_ID_PATTERN =
  "(?:REQ|SPEC-(?:EXT|INT)|TH)-\\d{3}|AC-\\d{3}(?:-\\d+|[a-z])?|ISS-\\d{2,3}|TOBE-\\d{2}|ASM-\\d{3}";

function indexedIds(index: SpecIndex): Set<string> {
  return new Set(
    Object.entries(index)
      .filter((entry): entry is [string, string[]] => entry[0] !== "system" && Array.isArray(entry[1]))
      .flatMap(([, ids]) => ids),
  );
}

function parseReferences(
  text: string,
  knownBySystem: ReadonlyMap<string, ReadonlySet<string>>,
  collidingIds: ReadonlySet<string>,
): ParsedReferences {
  const canonical = new Set<string>();
  const bare = new Set<string>();
  const failures = new Set<string>();
  const canonicalPattern = new RegExp(`\\b(PrjOps|DevOps):(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g");
  const knownSystemPattern = new RegExp(`\\b(PrjOps|DevOps)([\\t :/]+)(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g");
  const unknownSystemPattern = new RegExp(`\\b([A-Za-z][A-Za-z0-9_-]*)(:+)(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g");
  const canonicalCandidatePattern = /\b([A-Za-z][A-Za-z0-9_-]*):([A-Za-z0-9_-]+)/g;
  const validIdPattern = new RegExp(`^(?:${SPEC_ID_PATTERN})$`);
  const barePattern = new RegExp(`(?<![A-Za-z0-9_-])(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g");

  for (const match of text.matchAll(canonicalPattern)) {
    const system = match[1]!;
    const id = match[2]!;
    const reference = `${system}:${id}`;
    if (knownBySystem.get(system)?.has(id)) canonical.add(reference);
    else failures.add(`unknown canonical reference: ${reference}`);
  }

  for (const match of text.matchAll(knownSystemPattern)) {
    if (match[2] !== ":") failures.add(`malformed canonical reference: ${match[0]}`);
  }

  for (const match of text.matchAll(unknownSystemPattern)) {
    if (!knownBySystem.has(match[1]!)) failures.add(`unknown traceability system: ${match[0]}`);
  }

  for (const match of text.matchAll(canonicalCandidatePattern)) {
    const isKnownSystem = knownBySystem.has(match[1]!);
    const isValidId = validIdPattern.test(match[2]!);
    if (isKnownSystem && !isValidId) failures.add(`malformed canonical reference: ${match[0]}`);
    else if (!isKnownSystem && isValidId) failures.add(`unknown traceability system: ${match[0]}`);
  }

  for (const match of text.matchAll(barePattern)) {
    const id = match[1]!;
    const lineStart = text.lastIndexOf("\n", match.index! - 1) + 1;
    const prefix = text.slice(lineStart, match.index);
    if (/[A-Za-z][A-Za-z0-9_-]*:+$/.test(prefix) || /(?:PrjOps|DevOps)[\t :/]+$/.test(prefix)) continue;
    bare.add(id);
    if (collidingIds.has(id)) failures.add(`ambiguous bare reference: ${id}`);
  }

  return { canonical, bare, failures: [...failures] };
}

function namespaceFailuresByFile(
  repoRoot: string,
  packageDirs: string[],
  knownBySystem: ReadonlyMap<string, ReadonlySet<string>>,
  collidingIds: ReadonlySet<string>,
  ignoredFiles: ReadonlySet<string> = new Set(),
): string[] {
  const files = packageDirs
    .flatMap((pkgDir) => [
      ...listFiles(join(pkgDir, "src"), [".ts", ".sql", ".yml", ".yaml"]),
      ...listFiles(join(pkgDir, "tests"), [".ts"]),
    ])
    .filter((file) => !ignoredFiles.has(file));
  return [
    ...new Set(
      files.flatMap((file) => {
        const relativeFile = file.replace(`${repoRoot}${sep}`, "");
        return parseReferences(readFileSync(file, "utf8"), knownBySystem, collidingIds).failures.map(
          (failure) => `${failure} [${relativeFile}]`,
        );
      }),
    ),
  ].sort();
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
  referenceFailures: string[] = [],
): string[] {
  const mandatory = results.filter((result) => ["REQ", "SPEC-INT", "TH"].includes(result.category));
  return [
    ...mandatory.flatMap((result) => result.missingFromSrc),
    ...basisFailures.map((file) => `basis header missing: ${file}`),
    ...adrFailures.map((id) => `ADR reference missing file: ${id}`),
    ...referenceFailures,
  ];
}

function checkCategory(
  ids: string[] | undefined,
  category: string,
  system: string,
  corpus: { src: ParsedReferences; test: ParsedReferences },
  collidingIds: ReadonlySet<string>,
): CategoryResult {
  const list = ids ?? [];
  const missingFromSrc: string[] = [];
  const missingFromTest: string[] = [];
  let inSrc = 0;
  let inTest = 0;
  for (const id of list) {
    const canonical = `${system}:${id}`;
    const inS = corpus.src.canonical.has(canonical) || (!collidingIds.has(id) && corpus.src.bare.has(id));
    const inT = corpus.test.canonical.has(canonical) || (!collidingIds.has(id) && corpus.test.bare.has(id));
    if (inS) inSrc += 1;
    else missingFromSrc.push(canonical);
    if (inT) inTest += 1;
    else missingFromTest.push(canonical);
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
  const prjopsIds = indexedIds(prjopsIndex);
  const devopsIds = indexedIds(devopsIndex);
  const knownBySystem = new Map<string, ReadonlySet<string>>([
    [prjopsIndex.system, prjopsIds],
    [devopsIndex.system, devopsIds],
  ]);
  const collidingIds = new Set([...prjopsIds].filter((id) => devopsIds.has(id)));

  const sharedDir = join(repoRoot, "packages", "shared");
  const traceabilityDir = join(repoRoot, "packages", "traceability");
  const prjopsDir = join(repoRoot, "packages", "prjops");
  const devopsDir = join(repoRoot, "packages", "devops");
  const serverDir = join(repoRoot, "packages", "server");
  const webDir = join(repoRoot, "packages", "web");
  const packageDirs = [sharedDir, traceabilityDir, prjopsDir, devopsDir, serverDir, webDir];

  const prjopsCorpus = buildCorpus([sharedDir, traceabilityDir, prjopsDir, serverDir, webDir]);
  const devopsCorpus = buildCorpus([sharedDir, traceabilityDir, devopsDir, serverDir, webDir]);
  const prjopsReferences = {
    src: parseReferences(prjopsCorpus.srcText, knownBySystem, collidingIds),
    test: parseReferences(prjopsCorpus.testText, knownBySystem, collidingIds),
  };
  const devopsReferences = {
    src: parseReferences(devopsCorpus.srcText, knownBySystem, collidingIds),
    test: parseReferences(devopsCorpus.testText, knownBySystem, collidingIds),
  };
  const namespaceFailures = namespaceFailuresByFile(
    repoRoot,
    packageDirs,
    knownBySystem,
    collidingIds,
    new Set([join(traceabilityDir, "tests", "verifyTraceability.test.ts")]),
  );

  const prjopsResults: CategoryResult[] = [
    checkCategory(prjopsIndex.REQ, "REQ", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex["SPEC-EXT"], "SPEC-EXT", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex["SPEC-INT"], "SPEC-INT", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex.AC, "AC", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex.ISS, "ISS(参考)", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex.TOBE, "TOBE(参考)", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex.ASM, "ASM(参考)", prjopsIndex.system, prjopsReferences, collidingIds),
  ];

  const devopsResults: CategoryResult[] = [
    checkCategory(devopsIndex.REQ, "REQ", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex["SPEC-EXT"], "SPEC-EXT", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex["SPEC-INT"], "SPEC-INT", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex.TH, "TH", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex.AC, "AC", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex.ISS, "ISS(参考)", devopsIndex.system, devopsReferences, collidingIds),
  ];

  const report = await formatMarkdown(
    [
      "# トレーサビリティ検証結果",
      "",
      `生成日時: ${(options.now ?? new Date()).toISOString()}`,
      "",
      "凡例: 「実装参照あり」= `packages/*/src` 配下のコード（コメント含む）にIDが1回以上出現。",
      "「テスト参照あり」= `packages/*/tests` 配下のテストコードにIDが1回以上出現。",
      "注記: 参照の存在は構文上の接続だけを示し、要件の振る舞いを検証した証明ではありません。",
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
      `- 名前空間参照不正: ${namespaceFailures.join(", ") || "—"}`,
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
    namespaceFailures,
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
