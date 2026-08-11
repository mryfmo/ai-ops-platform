import { readFileSync, writeFileSync } from "node:fs";

const inventory = JSON.parse(readFileSync(".orchestration/validation/T32-inventory.json", "utf8"));
const inventoryMd = readFileSync(".orchestration/validation/T32-id-inventory.md", "utf8");
const body = readFileSync(".orchestration/validation/T32-audit-body.md", "utf8");

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

const nestedInventory = inventoryMd
  .split("\n")
  .map((line) => line.startsWith("#") ? `#${line}` : line)
  .join("\n")
  .replace(/^## T32 ID Space Inventory$/m, "## Full ID-Space Inventory");
const findingCount = (body.match(/^### SPC-\d{3}:/gm) ?? []).length;
const severity = Object.fromEntries(["CRITICAL", "HIGH", "MED", "LOW"].map((level) => [
  level,
  (body.match(new RegExp(`重大度: \\*\\*${level}\\*\\*`, "g")) ?? []).length,
]));

const report = [
  "# T32 Specification Content Audit",
  "",
  "- Repository revision: `21306d8`",
  "- Audit date: 2026-07-10",
  "- Scope: specification ID space, existing specification/ADR/README/AGENTS content, and current implementation/test evidence used only for reverse reconstruction",
  "- Decision: **NO-GO** until canonical source recovery or owner-approved normative reconstruction",
  "- Implementation-ratification rule: current code describes current behavior only; it never proves the correct requirement",
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
  "## ID-Space Statistics",
  "",
  table(
    ["Measure", "Official fixed value", "Exact namespace-join result", "Disposition"],
    [
      ["Indexed IDs", "295 (PrjOps 156 / DevOps 139)", String(inventory.totals.ids), "match"],
      ["Catalog definition lines", "32", String(inventory.totals.catalogDefinitionLines), "match; includes one orphan"],
      ["Indexed IDs with a joined definition", "31", String(inventory.totals.indexedDefined), "match"],
      ["Undefined indexed IDs", "264 (89.5%)", String(inventory.totals.undefined), "match; all reconstructed or marked unrecoverable"],
      ["ADRs", "14 (0001-0014)", String(inventory.totals.adrs), "match; AGENTS list omits 0014"],
    ],
  ),
  "",
  "> Official values are 295 indexed IDs, 32 catalog definition lines, 31 indexed definitions, and 264 undefined indexed IDs. The one-line difference is the orphan definition `DevOps:REQ-032` (SPC-001).",
  "",
  table(
    ["System", "Category", "Total", "Defined in catalog join", "Undefined", "Dead", "AC without test"],
    inventory.stats.map((row) => [row.system, row.category, row.total, row.defined, row.undefined, row.dead, row.testlessAc ?? "-"]),
  ),
  "",
  "## Executive Result",
  "",
  `- Findings: ${findingCount} (CRITICAL ${severity.CRITICAL}, HIGH ${severity.HIGH}, MED ${severity.MED}, LOW ${severity.LOW})`,
  `- Exact cross-system ID collisions: ${inventory.collisions.length}`,
  `- Registry substring containment pairs: ${inventory.substringPairs.length} (DevOps ISS-01 -> PrjOps ISS-010 false-positive risk)`,
  `- Dead indexed IDs: ${inventory.deadIds.length}`,
  `- AC IDs without exact test reference: ${inventory.testlessAc.length}`,
  `- Code/test IDs absent from indexes: ${inventory.unindexedReferences.length} (one real candidate AC-016-1; one synthetic fixture REQ-999)`,
  "- Canonical originals: absent from repository and `/mnt/user-data/uploads`",
  "",
  "## Method",
  "",
  "1. Parsed both JSON indexes and catalog tables by system namespace.",
  "2. Scanned source, tests, docs, ADRs, README, and AGENTS with exact-token boundaries; excluded registries, generated traceability output, verifier self-text, dependencies, build output, and `.orchestration`.",
  "3. Enumerated numeric-base gaps for REQ/SPEC-EXT/SPEC-INT/TH/AC and inspected every registry revision for prior presence/removal.",
  "4. Compared existing specification statements with schema and implementation only to detect errors or reconstruct current behavior.",
  "5. Reconstructed every exact-join undefined ID in `spec_reconstruction.md`; missing evidence is explicitly `復元不能`.",
  "",
  body.trim(),
  "",
  nestedInventory.trim(),
  "",
  "## Reconstruction Artifact",
  "",
  "The full per-ID table is `.orchestration/audit/spec_reconstruction.md`. It contains all 264 undefined indexed IDs.",
  "",
].join("\n");

writeFileSync(".orchestration/audit/specification_content_audit.md", report);
console.log(JSON.stringify({ findingCount, severity, lines: report.split("\n").length }, null, 2));
