import { readdirSync, readFileSync } from "node:fs";

const auditPath = ".orchestration/audit/user_facing_artifact_audit.md";
const audit = readFileSync(auditPath, "utf8");
const checks = [];

function check(name, condition, detail) {
  if (!condition) throw new Error(`FAIL ${name}: ${detail}`);
  checks.push(`PASS ${name}: ${detail}`);
}

const headings = [...audit.matchAll(/^### UFA-(\d{3}):/gm)].map((match) => match[1]);
const expected = Array.from({ length: 11 }, (_, index) => String(index + 1).padStart(3, "0"));
check("finding sequence", JSON.stringify(headings) === JSON.stringify(expected), `UFA-${headings[0]}..${headings.at(-1)}, count=${headings.length}`);

const starts = [...audit.matchAll(/^### UFA-(\d{3}):/gm)];
const fields = [
  "- 欠陥種別:",
  "- 対象成果物:",
  "- ユーザーが詰まる箇所の再現:",
  "- 証跡 file:line:",
  "- 重大度:",
  "- 推奨対処:",
  "- 既存所見(PRG/SPC)との相互参照:",
];
for (let index = 0; index < starts.length; index += 1) {
  const end = starts[index + 1]?.index ?? audit.indexOf("\n## Six-Group Coverage");
  const segment = audit.slice(starts[index].index, end);
  for (const field of fields) check(`UFA-${starts[index][1]} ${field}`, segment.includes(field), "present");
}

for (const type of ["実行不能", "記入不能", "循環定義", "前提未記載"]) {
  check(`defect type ${type}`, audit.includes(`- 欠陥種別: ${type}`), "present");
}
check("severity count", (audit.match(/- 重大度: \*\*HIGH\*\*/g) ?? []).length === 8
  && (audit.match(/- 重大度: \*\*MED\*\*/g) ?? []).length === 3, "HIGH=8, MED=3");

const docs = [
  ...readdirSync("docs/guide").filter((name) => name.endsWith(".md")).map((name) => `docs/guide/${name}`),
  ...readdirSync("docs/reference").filter((name) => name.endsWith(".md")).map((name) => `docs/reference/${name}`),
  "docs/teams-app/README.md",
  ...readdirSync("runbooks").filter((name) => name.endsWith(".md")).map((name) => `runbooks/${name}`),
];
const missingDocs = docs.filter((path) => !audit.includes(`\`${path}\``));
check("artifact coverage", docs.length === 18 && missingDocs.length === 0,
  `files=${docs.length}, missing=${JSON.stringify(missingDocs)}`);

const excelKnowledge = [
  "Delete or replace all three row-2 examples",
  "all three worksheets",
  "source_key",
  "project_node_id",
  "field_node_id",
  "content_node_id",
  "singleSelectOptionId",
  "iteration ID",
  "XLSX_IMPORT_SECRET",
  "XLSX_IMPORT_ALLOWED_REPOS",
  "x-confirm-import: yes",
  "result.failed > 0",
  "ledger commit",
];
const missingKnowledge = excelKnowledge.filter((token) => !audit.includes(token));
check("Excel missing-knowledge inventory", missingKnowledge.length === 0,
  `items=${excelKnowledge.length}, missing=${JSON.stringify(missingKnowledge)}`);
check("node acquisition procedure", ["gh auth login --scopes \"read:project\"", "gh api graphql", "projectV2(number:$number)", "gh api repos/OWNER/REPO/issues/123"].every((token) => audit.includes(token)), "auth + project/field + content queries present");
check("signed walkthrough", ["openssl dgst -sha256", "/xlsx-import/dry-run", "/xlsx-import/execute?owner=", "--data-binary", "jq -e"].every((token) => audit.includes(token)), "dry-run + execute + result assertions present");

for (const group of [
  "### 1. Excel import complete set",
  "### 2. All `docs/guide/*.md`",
  "### 3. All `docs/reference/*.md`",
  "### 4. Teams application README",
  "### 5. All operator-facing `runbooks/*.md`",
  "### 6. Error-message self-resolution",
]) check(`coverage ${group}`, audit.includes(group), "present");

check("deduplication", audit.includes("No UFA-001..011 row duplicates an accepted PRG/SPC root cause."), "new duplicate count=0");
for (const id of ["PRG-004", "PRG-014", "PRG-019", "PRG-020", "PRG-021", "PRG-022", "PRG-028", "PRG-030", "PRG-031", "PRG-032", "PRG-043", "SPC-013", "SPC-014", "SPC-015", "SPC-025"]) {
  check(`cross-reference ${id}`, audit.includes(id), "present");
}

check("probe evidence", ["rows=3", "errors=0", "remoteCreates=2", "31/31 pass", "19/19 pass", "eight missing config values"].every((token) => audit.includes(token)), "local walkthrough results present");
check("forbidden placeholders", !/TBD|適切に判断/.test(audit), "zero matches");

console.log("T34 VALIDATOR PASS");
console.log(`checks=${checks.length}`);
console.log("findings=11 (HIGH=8, MED=3); sequence=UFA-001..011");
console.log("defect types=4/4; required finding fields=7 x 11");
console.log("artifact coverage=18/18 (guides=3, references=4, Teams README=1, runbooks=10)");
console.log("Excel knowledge inventory=13/13; node-ID and signed HTTP walkthroughs present");
console.log("six groups=6/6; accepted-finding duplicates newly filed=0");
