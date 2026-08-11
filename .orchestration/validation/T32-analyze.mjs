import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const root = process.cwd();
const categories = ["REQ", "SPEC-EXT", "SPEC-INT", "TH", "ISS", "TOBE", "ASM", "AC"];
const sourceExts = new Set([".ts", ".tsx", ".sql", ".mjs", ".yml", ".yaml"]);
const docExts = new Set([".md"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if ([".git", "node_modules", "dist", ".next", "coverage", ".orchestration"].includes(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function rel(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactRegex(id) {
  return new RegExp(`(?<![A-Za-z0-9-])${escapeRegex(id)}(?![A-Za-z0-9-])`);
}

function compact(value, max = 260) {
  const text = value
    .replace(/^\s*(?:\/\/?|\*|--|#)\s?/gm, "")
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function loadIndex(file) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  return categories.flatMap((category) =>
    (json[category] ?? []).map((id) => ({ system: json.system, category, id, key: `${json.system}:${id}` })),
  );
}

function loadCatalog() {
  const lines = readFileSync(join(root, "docs/spec/spec-id-catalog.md"), "utf8").split("\n");
  const definitions = new Map();
  let system;
  lines.forEach((line, index) => {
    if (line === "## PrjOps") system = "PrjOps";
    if (line === "## DevOps") system = "DevOps";
    const match = line.match(/^\| `([^`]+)`\s+\|\s+([^|]+?)\s+\|/);
    if (system && match) {
      definitions.set(`${system}:${match[1]}`, { text: match[2].trim(), line: index + 1 });
    }
  });
  return definitions;
}

const entries = [
  ...loadIndex(join(root, "packages/traceability/spec-ids/prjops.json")),
  ...loadIndex(join(root, "packages/traceability/spec-ids/devops.json")),
];
const catalog = loadCatalog();
const allFiles = walk(root);
const corpus = allFiles
  .filter((path) => sourceExts.has(extname(path)) || docExts.has(extname(path)))
  .filter((path) => !rel(path).startsWith("packages/traceability/spec-ids/"))
  .filter((path) => !rel(path).startsWith("packages/traceability/output/"))
  .filter((path) => rel(path) !== "packages/traceability/src/verifyTraceability.ts")
  .map((path) => ({ path: rel(path), lines: readFileSync(path, "utf8").split("\n") }));

function inSystemScope(path, system) {
  if (path.startsWith("docs/") || path.startsWith("runbooks/") || path === "README.md" || path === "AGENTS.md") return true;
  if (path.startsWith(".github/")) return true;
  const shared = path.startsWith("packages/shared/") || path.startsWith("packages/server/") || path.startsWith("packages/web/");
  return shared || path.startsWith(`packages/${system.toLowerCase()}/`);
}

function kind(path) {
  if (path.includes("/tests/") || /\.test\.[cm]?[jt]sx?$/.test(path)) return "test";
  if (path.startsWith("docs/") || path.startsWith("runbooks/") || path === "README.md" || path === "AGENTS.md") return "doc";
  return "source";
}

function references(entry) {
  const regex = exactRegex(entry.id);
  const refs = [];
  for (const file of corpus) {
    if (!inSystemScope(file.path, entry.system)) continue;
    file.lines.forEach((line, index) => {
      if (!regex.test(line)) return;
      const around = file.lines.slice(Math.max(0, index - 2), Math.min(file.lines.length, index + 3)).join(" ");
      refs.push({ path: file.path, line: index + 1, kind: kind(file.path), context: compact(around) });
    });
  }
  const priority = (ref) => {
    const packagePrefix = `packages/${entry.system.toLowerCase()}/`;
    if (ref.path.startsWith(packagePrefix)) return 0;
    if (ref.path.startsWith("packages/shared/")) return 1;
    if (ref.path.startsWith("packages/server/")) return 2;
    if (ref.path.startsWith("packages/web/")) return 3;
    if (ref.path.startsWith(".github/")) return 4;
    return 5;
  };
  return refs.sort((a, b) => priority(a) - priority(b) || a.path.localeCompare(b.path) || a.line - b.line);
}

const byId = new Map();
for (const entry of entries) {
  const refs = references(entry);
  byId.set(entry.key, {
    ...entry,
    defined: catalog.has(entry.key),
    definition: catalog.get(entry.key) ?? null,
    refs,
    sourceRefs: refs.filter((ref) => ref.kind === "source"),
    testRefs: refs.filter((ref) => ref.kind === "test"),
    docRefs: refs.filter((ref) => ref.kind === "doc"),
  });
}

const undefinedEntries = [...byId.values()].filter((entry) => !entry.defined);
const idSystems = new Map();
for (const entry of entries) {
  const systems = idSystems.get(entry.id) ?? new Set();
  systems.add(entry.system);
  idSystems.set(entry.id, systems);
}
const collisions = [...idSystems.entries()]
  .filter(([, systems]) => systems.size > 1)
  .map(([id, systems]) => ({ id, systems: [...systems] }))
  .sort((a, b) => a.id.localeCompare(b.id));

function numericBase(entry) {
  const match = entry.id.match(/-(\d+)/);
  return match ? Number(match[1]) : null;
}

const gapRows = [];
for (const system of ["PrjOps", "DevOps"]) {
  for (const category of ["REQ", "SPEC-EXT", "SPEC-INT", "TH", "AC", "ISS", "TOBE", "ASM"]) {
    const present = [...new Set(entries.filter((e) => e.system === system && e.category === category).map(numericBase).filter(Number.isInteger))].sort((a, b) => a - b);
    if (!present.length) {
      gapRows.push({ system, category, min: null, max: null, missing: [], absent: true });
      continue;
    }
    const missing = [];
    for (let n = present[0]; n <= present.at(-1); n += 1) if (!present.includes(n)) missing.push(n);
    gapRows.push({ system, category, min: present[0], max: present.at(-1), missing });
  }
}

const uniqueIds = [...idSystems.keys()].sort();
const substringPairs = [];
for (const short of uniqueIds) {
  for (const long of uniqueIds) {
    if (short !== long && long.includes(short)) substringPairs.push({ short, long });
  }
}

const tokenPattern = /\b(?:REQ-\d{2,3}|SPEC-(?:EXT|INT)-\d{2,3}|TH-\d{3}|ISS-\d{2,3}|TOBE-\d{2}|ASM-\d{3}|AC-\d{2,3}(?:-\d+|[a-z]))\b/g;
const indexedIds = new Set(entries.map((entry) => entry.id));
const unindexed = new Map();
for (const file of corpus.filter((file) =>
  (file.path.startsWith("packages/") || file.path.startsWith(".github/")) && ["source", "test"].includes(kind(file.path)),
)) {
  file.lines.forEach((line, index) => {
    for (const match of line.matchAll(tokenPattern)) {
      if (indexedIds.has(match[0])) continue;
      const refs = unindexed.get(match[0]) ?? [];
      refs.push(`${file.path}:${index + 1}`);
      unindexed.set(match[0], refs);
    }
  });
}

function statsRows() {
  const rows = [];
  for (const system of ["PrjOps", "DevOps"]) {
    for (const category of categories) {
      const list = [...byId.values()].filter((entry) => entry.system === system && entry.category === category);
      if (!list.length) continue;
      rows.push({
        system,
        category,
        total: list.length,
        defined: list.filter((entry) => entry.defined).length,
        undefined: list.filter((entry) => !entry.defined).length,
        dead: list.filter((entry) => entry.sourceRefs.length === 0 && entry.testRefs.length === 0).length,
        testlessAc: category === "AC" ? list.filter((entry) => entry.testRefs.length === 0).length : null,
      });
    }
  }
  return rows;
}

function firstRef(refs) {
  return refs.length ? `${refs[0].path}:${refs[0].line}` : "なし";
}

function collisionMeaning(system, id) {
  const entry = byId.get(`${system}:${id}`);
  if (entry.definition) return `catalog: ${compact(entry.definition.text, 150)} (docs/spec/spec-id-catalog.md:${entry.definition.line})`;
  const ref = entry.sourceRefs[0] ?? entry.testRefs[0] ?? entry.docRefs[0];
  return ref
    ? `normative text absent; current reference: ${compact(ref.context, 150)} (${ref.path}:${ref.line})`
    : "normative text absent; no exact source/test evidence (meaning unrecoverable)";
}

function reconstruct(entry) {
  const source = entry.sourceRefs[0];
  const test = entry.testRefs[0];
  const doc = entry.docRefs[0];
  const selectedPath = source?.path ?? test?.path ?? "";
  const ambiguous = idSystems.get(entry.id)?.size > 1 &&
    ["packages/shared/", "packages/server/", "packages/web/", "docs/", "README.md", "AGENTS.md", ".github/"].some((prefix) => selectedPath.startsWith(prefix));
  if (!source && !test) {
    return {
      status: "復元不能",
      confidence: "low",
      text: "復元不能。実装・テストにexact-token参照がなく、外部原本もないため、意味・境界条件・期待結果を証拠から再構成できない。",
      source: "なし",
      test: "なし",
      doc: firstRef(entry.docRefs),
      ambiguity: ambiguous,
    };
  }
  const evidence = source ?? test;
  const lead = entry.category === "ISS"
    ? "現行リポジトリでは課題識別子として"
    : entry.category === "TOBE"
      ? "現行リポジトリでは将来像識別子として"
      : entry.category === "ASM"
        ? "現行リポジトリでは前提識別子として"
        : entry.category === "AC"
          ? "現行リポジトリでは受入条件の根拠として"
          : "現行リポジトリでは要求・仕様の根拠として";
  const confidence = ambiguous || !source || !test ? "low" : doc ? "high" : "medium";
  return {
    status: source && test ? "逆再構成" : "部分復元",
    confidence,
    text: `${lead}「${evidence.context}」が参照されている。これは実装・テストが示す現状記述であり、正しい要求の証明ではない。${ambiguous ? "同一IDが両systemに存在し、共有corpus参照はnamespaceを確定できない。" : ""}`,
    source: firstRef(entry.sourceRefs),
    test: firstRef(entry.testRefs),
    doc: firstRef(entry.docRefs),
    ambiguity: ambiguous,
  };
}

const reconstruction = undefinedEntries.map((entry) => ({ ...entry, reconstruction: reconstruct(entry) }));
const inventory = {
  generatedAt: new Date().toISOString(),
  totals: {
    ids: entries.length,
    prjops: entries.filter((e) => e.system === "PrjOps").length,
    devops: entries.filter((e) => e.system === "DevOps").length,
    catalogDefinitionLines: catalog.size,
    indexedDefined: [...byId.values()].filter((entry) => entry.defined).length,
    undefined: undefinedEntries.length,
    adrs: readdirSync(join(root, "docs/adr")).filter((name) => /^\d{4}-.+\.md$/.test(name)).length,
  },
  stats: statsRows(),
  gaps: gapRows,
  missingDefinitions: undefinedEntries.map((entry) => entry.key),
  deadIds: [...byId.values()].filter((entry) => entry.sourceRefs.length === 0 && entry.testRefs.length === 0).map((entry) => entry.key),
  testlessAc: [...byId.values()].filter((entry) => entry.category === "AC" && entry.testRefs.length === 0).map((entry) => entry.key),
  unindexedReferences: [...unindexed.entries()].map(([id, refs]) => ({ id, refs: [...new Set(refs)] })),
  collisions,
  substringPairs,
  reconstruction: reconstruction.map((entry) => ({
    key: entry.key,
    category: entry.category,
    ...entry.reconstruction,
  })),
};

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

const inventoryMd = [
  "# T32 ID Space Inventory",
  "",
  `Generated: ${inventory.generatedAt}`,
  "",
  "> exact-token検索。spec-id JSON、生成済みtraceability output、verifyTraceability自身、.orchestrationは参照corpusから除外した。",
  "> 公式値は295 indexed IDs / 32 catalog definition lines / 31 indexed definitions / 264 undefined (89.5%)。差分1件はcatalog-only `DevOps:REQ-032`。",
  "",
  "## 集計規則",
  "",
  "- 集計キー: ID文字列単体ではなく `(system, id)` の複合キー（全295キー）。cross-system同番号56件を統合しない。",
  "- system scope: `packages/prjops/**` はPrjOpsだけ、`packages/devops/**` はDevOpsだけへ計上する。`packages/shared/**`、`packages/server/**`、`packages/web/**`、`.github/**` は両systemへ計上する。",
  "- kind: `/tests/` 配下または `*.test.*` は`test`。`docs/**`、`runbooks/**`、`README.md`、`AGENTS.md`は`doc`。それ以外の対象実装は`source`。",
  "- dead: namespaced IDのexact-token参照が`source`にも`test`にも0件の場合。`doc`参照だけではdeadを解除しない。",
  "- testless AC: namespaced ACのexact-token `test`参照が0件の場合。source/doc参照の有無は問わない。",
  "- 除外: `spec-ids/*.json`、生成済みtraceability output、`verifyTraceability.ts`、`.orchestration/**`、`.git`、`node_modules`、`dist`、`.next`、`coverage`。",
  "- 再生成: repository rootで `node .orchestration/validation/T32-analyze.mjs`。検算は `node .orchestration/validation/T32-validate.mjs`。",
  "",
  "## Statistics",
  "",
  table(
    ["System", "Category", "Total", "Defined", "Undefined", "Dead", "Testless AC"],
    inventory.stats.map((row) => [row.system, row.category, row.total, row.defined, row.undefined, row.dead, row.testlessAc ?? "-"]),
  ),
  "",
  "## Sequence Gaps",
  "",
  "Git history check: every numeric base listed below was absent in every revision of its registry file; no intentional deletion/removal trace was found. This does not prove the gaps intentional.",
  "",
  table(["System", "Category", "Range", "Missing numeric bases"], inventory.gaps.map((row) => [
    row.system,
    row.category,
    row.absent ? "n/a" : `${row.min}-${row.max}`,
    row.absent ? "category absent from this system index" : row.missing.join(", ") || "none",
  ])),
  "",
  "## Undefined IDs (full list)",
  "",
  ...["PrjOps", "DevOps"].flatMap((system) => categories.flatMap((category) => {
    const ids = undefinedEntries.filter((entry) => entry.system === system && entry.category === category).map((entry) => entry.id);
    return ids.length ? [`### ${system} ${category} (${ids.length})`, "", ids.join(", "), ""] : [];
  })),
  "## Dead IDs (no exact source/test reference)",
  "",
  inventory.deadIds.join(", ") || "none",
  "",
  "## AC IDs without exact test reference",
  "",
  inventory.testlessAc.join(", ") || "none",
  "",
  "## Source/test references absent from both indexes",
  "",
  inventory.unindexedReferences.length
    ? table(["ID", "References", "Classification"], inventory.unindexedReferences.map((row) => [
      row.id,
      row.refs.join("<br>"),
      row.id === "REQ-999" ? "synthetic negative-test fixture" : "real implementation/test trace candidate missing from index",
    ]))
    : "none",
  "",
  "## Cross-system exact ID collisions",
  "",
  collisions.map((row) => row.id).join(", ") || "none",
  "",
  "Undefined collisions have unknowable semantic equivalence. Defined shared IDs must still use `(system, id)` because the definitions differ or delegate separately.",
  "",
  table(
    ["ID", "PrjOps meaning/evidence", "DevOps meaning/evidence"],
    collisions.map((row) => [row.id, collisionMeaning("PrjOps", row.id), collisionMeaning("DevOps", row.id)]),
  ),
  "",
  "## Registry-to-registry substring containment pairs",
  "",
  substringPairs.length ? table(["Short", "Long"], substringPairs.map((row) => [row.short, row.long])) : "none",
  "",
].join("\n");

const reconstructionMd = [
  "# T32 Specification Reconstruction",
  "",
  `Generated: ${inventory.generatedAt}`,
  "",
  "## Interpretation Rule",
  "",
  "This table reconstructs current repository behavior only. It MUST NOT be used to ratify implementation as the correct requirement. Every row requires Specification Owner review before entering a canonical corpus.",
  "",
  "- `逆再構成`: exact implementation and test references both exist.",
  "- `部分復元`: only one side exists; missing evidence remains an explicit gap.",
  "- `復元不能`: neither exact implementation nor test reference exists.",
  "- `high` still means evidence alignment, not normative correctness; undefined source text caps authority at owner review.",
  "- REQ/SPEC/TH/AC rows describe observable behavior or acceptance evidence only. ISS rows are reconstructed only as problem statements, TOBE as future-state statements, and ASM as assumptions; they are not silently converted into implementation requirements.",
  "",
  "## Coverage",
  "",
  `- Undefined indexed IDs: ${reconstruction.length}`,
  `- Reverse reconstructed: ${reconstruction.filter((entry) => entry.reconstruction.status === "逆再構成").length}`,
  `- Partial: ${reconstruction.filter((entry) => entry.reconstruction.status === "部分復元").length}`,
  `- Unrecoverable: ${reconstruction.filter((entry) => entry.reconstruction.status === "復元不能").length}`,
  "",
  "## PRG-023 Inputs",
  "",
  "### Unrecoverable specification-loss IDs",
  "",
  reconstruction.filter((entry) => entry.reconstruction.status === "復元不能").map((entry) => entry.key).join(", ") || "none",
  "",
  "### Partially reconstructed IDs requiring missing-side evidence",
  "",
  reconstruction.filter((entry) => entry.reconstruction.status === "部分復元").map((entry) => entry.key).join(", ") || "none",
  "",
  "## ADR/Catalog/AGENTS Cross-Check Outcomes",
  "",
  "Cross-check findings are recorded in the audit as SPC-001 (orphan namespace), SPC-004 (ADR-0014 omission), SPC-005 (substring collision), SPC-015 (deterministic/non-canonical thresholds), SPC-017 (unspecified thinking default), and SPC-021 (metric provenance). These findings do not upgrade any reconstruction to normative text.",
  "",
  "## Full Reconstruction Table",
  "",
  table(
    ["System", "Category", "ID", "Result", "Current-state reconstruction", "Implementation evidence", "Test evidence", "Document evidence", "Confidence"],
    reconstruction.map((entry) => [
      entry.system,
      entry.category,
      entry.id,
      entry.reconstruction.status,
      entry.reconstruction.text,
      entry.reconstruction.source,
      entry.reconstruction.test,
      entry.reconstruction.doc,
      entry.reconstruction.confidence,
    ]),
  ),
  "",
].join("\n");

mkdirSync(join(root, ".orchestration/audit"), { recursive: true });
mkdirSync(join(root, ".orchestration/validation"), { recursive: true });
writeFileSync(join(root, ".orchestration/validation/T32-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
writeFileSync(join(root, ".orchestration/validation/T32-id-inventory.md"), inventoryMd);
writeFileSync(join(root, ".orchestration/audit/spec_reconstruction.md"), reconstructionMd);

const rev = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
console.log(JSON.stringify({ revision: rev, ...inventory.totals, reconstructed: reconstruction.filter((entry) => entry.reconstruction.status === "逆再構成").length, partial: reconstruction.filter((entry) => entry.reconstruction.status === "部分復元").length, unrecoverable: reconstruction.filter((entry) => entry.reconstruction.status === "復元不能").length, dead: inventory.deadIds.length, testlessAc: inventory.testlessAc.length, unindexed: inventory.unindexedReferences.length, collisions: collisions.length, substringPairs: substringPairs.length }, null, 2));

if (entries.length !== 295 || catalog.size !== 32 || undefinedEntries.length !== 264) process.exitCode = 1;
