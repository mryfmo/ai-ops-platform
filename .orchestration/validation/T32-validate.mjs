import { readFileSync } from "node:fs";

const audit = readFileSync(".orchestration/audit/specification_content_audit.md", "utf8");
const reconstruction = readFileSync(".orchestration/audit/spec_reconstruction.md", "utf8");
const inventory = JSON.parse(readFileSync(".orchestration/validation/T32-inventory.json", "utf8"));
const inventoryMd = readFileSync(".orchestration/validation/T32-id-inventory.md", "utf8");
const workplan = readFileSync(".orchestration/plan/remediation_workplan.md", "utf8");

const failures = [];
const check = (name, condition, detail = "") => {
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`);
};

check("official ID totals", inventory.totals.ids === 295 && inventory.totals.prjops === 156 && inventory.totals.devops === 139);
check("definition cardinality", inventory.totals.catalogDefinitionLines === 32 && inventory.totals.indexedDefined === 31 && inventory.totals.undefined === 264);
check("ADR count", inventory.totals.adrs === 14);
for (const [name, token] of [
  ["composite key", "`(system, id)` の複合キー"],
  ["system scope", "`packages/shared/**`、`packages/server/**`、`packages/web/**`、`.github/**` は両systemへ計上"],
  ["kind rule", "`docs/**`、`runbooks/**`、`README.md`、`AGENTS.md`は`doc`"],
  ["dead rule", "`doc`参照だけではdeadを解除しない"],
  ["testless rule", "source/doc参照の有無は問わない"],
  ["exclusions", "`verifyTraceability.ts`、`.orchestration/**`"],
  ["regeneration", "node .orchestration/validation/T32-analyze.mjs"],
]) {
  check(`aggregation rule ${name} in audit`, audit.includes(token));
  check(`aggregation rule ${name} in inventory`, inventoryMd.includes(token));
}

const rows = reconstruction.split("\n").filter((line) => /^\| (PrjOps|DevOps) \|/.test(line));
const rowKeys = rows.map((line) => {
  const cells = line.split("|").map((cell) => cell.trim());
  return `${cells[1]}:${cells[3]}`;
});
const expectedKeys = inventory.reconstruction.map((row) => row.key);
check("reconstruction rows", rows.length === 264, `count=${rows.length}`);
check("reconstruction unique keys", new Set(rowKeys).size === 264, `unique=${new Set(rowKeys).size}`);
check("reconstruction exact key set", expectedKeys.every((key) => rowKeys.includes(key)) && rowKeys.every((key) => expectedKeys.includes(key)));
check("reconstruction status total", ["逆再構成", "部分復元", "復元不能"].every((status) => reconstruction.includes(status)));
check("implementation ratification prohibited", reconstruction.includes("MUST NOT be used to ratify implementation") && audit.includes("Implementation-ratification rule"));

const findingHeadings = [...audit.matchAll(/^### SPC-(\d{3}):/gm)].map((match) => Number(match[1]));
check("SPC count", findingHeadings.length === 26, `count=${findingHeadings.length}`);
check("SPC contiguous", findingHeadings.every((value, index) => value === index + 1));
const findingSegments = audit.split(/^### SPC-\d{3}:/gm).slice(1, 27);
for (const field of ["- 種別:", "- 重大度:", "- 対象:", "- 引用:", "- なぜ問題か:", "- 推奨対処:"]) {
  check(`finding field ${field}`, findingSegments.every((segment) => segment.includes(field)));
}
for (const type of ["間違い", "矛盾", "曖昧", "ヌケモレ"]) check(`finding type ${type}`, audit.includes(`- 種別: ${type}`));

const reqGaps = Object.fromEntries(inventory.gaps.filter((row) => row.category === "REQ").map((row) => [row.system, row.missing]));
check("REQ gap totals", reqGaps.PrjOps.length === 8 && reqGaps.DevOps.length === 17, `PrjOps=${reqGaps.PrjOps.length} DevOps=${reqGaps.DevOps.length}`);
check("all category gap audit", inventory.gaps.length === 16, `rows=${inventory.gaps.length}`);
check("orphan definition finding", audit.includes("SPC-001") && audit.includes("DevOps:REQ-032"));
check("dead IDs full count", inventory.deadIds.length === 64);
check("testless AC full count", inventory.testlessAc.length === 36);
check("unindexed code/test IDs", inventory.unindexedReferences.length === 2 && inventory.unindexedReferences.some((row) => row.id === "AC-016-1"));
check("namespace collisions", inventory.collisions.length === 56);
check("substring false-match pair", inventory.substringPairs.length === 1 && inventory.substringPairs[0].short === "ISS-01" && inventory.substringPairs[0].long === "ISS-010");

for (const prg of ["PRG-041", "PRG-042", "PRG-044", "PRG-047", "PRG-048"]) check(`retrospective ${prg}`, audit.includes(`| ${prg} `));
for (let n = 9; n <= 21; n += 1) {
  if ([9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21].includes(n)) check(`orchestrator candidate SPC-${String(n).padStart(3, "0")}`, audit.includes(`### SPC-${String(n).padStart(3, "0")}:`));
}
const t31FollowUpPending = workplan.includes("263件") && !workplan.includes("264件");
const t33Integrated = workplan.includes("PRG-001〜050 + SPC-001〜026（76所見）")
  && workplan.includes("カタログ定義行32")
  && workplan.includes("索引済み定義31")
  && workplan.includes("未定義264")
  && workplan.includes("DevOps 17件")
  && workplan.includes("孤児定義DevOps `REQ-032`");
check("T31 stale-value follow-up disposition", t31FollowUpPending || t33Integrated,
  t31FollowUpPending ? "pending" : "T33 integrated");

if (failures.length) {
  console.error(JSON.stringify({ status: "FAIL", failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", findings: findingHeadings.length, reconstructionRows: rows.length }, null, 2));
}
