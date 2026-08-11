import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const files = {
  workplan: process.env.T33_WORKPLAN_PATH ?? ".orchestration/plan/remediation_workplan.md",
  phases: ".orchestration/plan/remediation_phases.md",
  report: ".orchestration/reports/T31-report.md",
  t31Validation: ".orchestration/validation/T31-validation.txt",
  audit: ".orchestration/audit/specification_content_audit.md",
};

const text = Object.fromEntries(
  Object.entries(files).map(([name, path]) => [name, readFileSync(path, "utf8")]),
);
const expected = [
  ...Array.from({ length: 50 }, (_, index) => `PRG${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 26 }, (_, index) => `SPC${String(index + 1).padStart(3, "0")}`),
];
const checks = [];

function check(name, condition, detail) {
  if (!condition) throw new Error(`FAIL ${name}: ${detail}`);
  checks.push(`PASS ${name}: ${detail}`);
}

function sameSet(name, actual) {
  const missing = expected.filter((id) => !actual.includes(id));
  const extras = actual.filter((id) => !expected.includes(id));
  const duplicates = [...new Set(actual.filter((id, index) => actual.indexOf(id) !== index))];
  check(name, actual.length === 76 && new Set(actual).size === 76 && !missing.length && !extras.length,
    `count=${actual.length}, unique=${new Set(actual).size}, missing=${JSON.stringify(missing)}, extras=${JSON.stringify(extras)}, duplicates=${JSON.stringify(duplicates)}`);
}

const headings = [...text.workplan.matchAll(/^### TASK-(PRG|SPC)(\d{3}):/gm)].map((match) => `${match[1]}${match[2]}`);
const coverage = [...text.workplan.matchAll(/^\| (PRG|SPC)-(\d{3}) \| TASK-\1\2 \|$/gm)].map((match) => `${match[1]}${match[2]}`);
const phaseTasks = [...text.phases.matchAll(/^- Tasks: (.+)$/gm)]
  .flatMap((match) => match[1].split(", "))
  .map((task) => task.replace("TASK-", ""));
sameSet("task headings", headings);
sameSet("coverage table", coverage);
sameSet("phase union", phaseTasks);

const taskStarts = [...text.workplan.matchAll(/^### TASK-(PRG|SPC)(\d{3}):/gm)];
const labels = [
  "対応所見:", "観点(surface / lens):", "現状(as-is):", "精査で判明した欠陥:",
  "改善(to-be):", "許可ファイル/スコープ:", "禁止事項:", "前提/停止条件:",
  "完了条件(DoD、チェックボックス):", "検証手順:", "証跡の置き場:",
  "依存(blocked-by):", "仕様トレース:", "ステータス:",
];
for (let index = 0; index < taskStarts.length; index += 1) {
  const match = taskStarts[index];
  const id = `${match[1]}${match[2]}`;
  const end = taskStarts[index + 1]?.index ?? text.workplan.length;
  const segment = text.workplan.slice(match.index, end);
  for (const label of labels) {
    check(`${id} ${label}`, segment.includes(`- ${label}`), "present");
  }
  check(`${id} DoD`, (segment.match(/^  - \[ \] /gm) ?? []).length === 3, "3 checkboxes");
  for (const marker of ["verified-integration:", "requires-real-env:", "偽装禁止:"]) {
    check(`${id} ${marker}`, segment.includes(`  - ${marker}`), "present");
  }
}
check("schema totals", labels.every((label) => (text.workplan.match(new RegExp(`^- ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gm")) ?? []).length === 76), "14 labels x 76 tasks");
check("DoD total", (text.workplan.match(/^  - \[ \] /gm) ?? []).length === 228, "3 x 76 = 228");

const stale = /263|32 defined|32 definitions|定義32|未定義263|\(89%\)|（89%）|SPC[^\n]{0,20}未反映|未反映[^\n]{0,20}SPC/;
for (const name of ["workplan", "phases", "report", "t31Validation"]) {
  check(`${name} stale values`, !stale.test(text[name]), "zero legacy-value/limited-coverage matches");
}
const allowedUndecided = [
  ["owner/store/rotation/least privilegeとzero-downtime更新が未定。", "current defect, not an executor placeholder"],
];
const forbiddenLines = text.workplan.split("\n").flatMap((line, index) => {
  const hardForbidden = /TBD|適切に判断|workerが判断|ワーカーが判断/.test(line);
  const bareUndecided = /未定(?!義)/.test(line);
  const allowed = allowedUndecided.some(([token]) => line.includes(token));
  return hardForbidden || (bareUndecided && !allowed) ? [`${index + 1}:${line}`] : [];
});
check("forbidden placeholders", forbiddenLines.length === 0, `matches=${JSON.stringify(forbiddenLines)}`);
for (const [token, reason] of allowedUndecided) {
  const lines = text.workplan.split("\n").flatMap((line, index) => line.includes(token) ? [index + 1] : []);
  check(`allowed 未定 ${token}`, lines.length === 1, `line=${lines[0]}, reason=${reason}`);
}

const requiredFacts = ["295", "32", "31", "264", "89.5", "17", "25", "REQ-032"];
for (const name of ["workplan", "phases", "report", "t31Validation"]) {
  check(`${name} corrected facts`, requiredFacts.every((fact) => text[name].includes(fact)), requiredFacts.join(","));
}

const roots = [["022", "041"], ["023", "042"], ["024", "044"], ["025", "047"], ["026", "048"]];
function taskSegment(prefix, id) {
  const start = text.workplan.indexOf(`### TASK-${prefix}${id}:`);
  const end = text.workplan.indexOf("\n### TASK-", start + 1);
  return text.workplan.slice(start, end === -1 ? undefined : end);
}
for (const [spc, prg] of roots) {
  const implementation = taskSegment("PRG", prg);
  const specification = taskSegment("SPC", spc);
  check(`SPC${spc}->PRG${prg}`, implementation.match(/^- 依存\(blocked-by\): (.+)$/m)?.[1].includes(`TASK-SPC${spc}`), "implementation blocked by root specification");
  check(`no reverse PRG${prg}->SPC${spc}`, !specification.match(/^- 依存\(blocked-by\): (.+)$/m)?.[1].includes(`TASK-PRG${prg}`), "reverse dependency absent");
}
const prg023 = taskSegment("PRG", "023");
check("canonical-loss integration", ["TASK-SPC001", "TASK-SPC002", "TASK-SPC003", "TASK-SPC006", "TASK-SPC007"].every((task) => prg023.includes(task)), "canonical loss governed through PRG023");

function dependencyIds(segment) {
  const line = segment.match(/^- 依存\(blocked-by\): (.+)$/m)?.[1] ?? "";
  const dependencies = [...line.matchAll(/TASK-(PRG|SPC)(\d{3})/g)]
    .map((match) => `TASK-${match[1]}${match[2]}`);
  for (const range of line.matchAll(/TASK-(PRG|SPC)(\d{3})〜TASK-\1(\d{3})/g)) {
    for (let number = Number(range[2]); number <= Number(range[3]); number += 1) {
      dependencies.push(`TASK-${range[1]}${String(number).padStart(3, "0")}`);
    }
  }
  return [...new Set(dependencies)];
}

const taskIds = taskStarts.map((match) => `TASK-${match[1]}${match[2]}`);
const graph = new Map(taskIds.map((task, index) => {
  const end = taskStarts[index + 1]?.index ?? text.workplan.length;
  return [task, dependencyIds(text.workplan.slice(taskStarts[index].index, end))];
}));
const dangling = [...graph].flatMap(([task, dependencies]) =>
  dependencies.filter((dependency) => !graph.has(dependency)).map((dependency) => `${task}->${dependency}`));
check("dependency dangling", dangling.length === 0, `count=${dangling.length}, edges=${JSON.stringify(dangling)}`);

const colors = new Map();
const stack = [];
const cycles = [];
function visit(task) {
  colors.set(task, 1);
  stack.push(task);
  for (const dependency of graph.get(task)) {
    if (colors.get(dependency) === 1) {
      cycles.push([...stack.slice(stack.indexOf(dependency)), dependency]);
    } else if (!colors.has(dependency)) {
      visit(dependency);
    }
  }
  stack.pop();
  colors.set(task, 2);
}
for (const task of taskIds) if (!colors.has(task)) visit(task);
check("dependency DAG", cycles.length === 0, `cycles=${cycles.map((cycle) => cycle.join(" -> ")).join("; ") || "none"}`);

const phaseByTask = new Map();
for (const match of text.phases.matchAll(/^## GATE-(\d):[\s\S]*?^- Tasks: (.+)$/gm)) {
  for (const task of match[2].split(", ")) phaseByTask.set(task, Number(match[1]));
}
check("phase assignment", taskIds.every((task) => phaseByTask.has(task)), `assigned=${phaseByTask.size}/76`);
const phaseViolations = [...graph].flatMap(([task, dependencies]) => dependencies.flatMap((dependency) =>
  phaseByTask.get(dependency) > phaseByTask.get(task)
    ? [`${task}(G${phaseByTask.get(task)})->${dependency}(G${phaseByTask.get(dependency)})`]
    : []));
check("dependency phase monotonicity", phaseViolations.length === 0,
  `violations=${JSON.stringify(phaseViolations)}`);

const dependents = new Map(taskIds.map((task) => [task, []]));
const indegree = new Map(taskIds.map((task) => [task, graph.get(task).length]));
for (const [task, dependencies] of graph) {
  for (const dependency of dependencies) dependents.get(dependency).push(task);
}
const compareTasks = (left, right) => phaseByTask.get(left) - phaseByTask.get(right) || left.localeCompare(right);
const ready = taskIds.filter((task) => indegree.get(task) === 0).sort(compareTasks);
const topologicalOrder = [];
while (ready.length) {
  const task = ready.shift();
  topologicalOrder.push(task);
  for (const dependent of dependents.get(task)) {
    indegree.set(dependent, indegree.get(dependent) - 1);
    if (indegree.get(dependent) === 0) {
      ready.push(dependent);
      ready.sort(compareTasks);
    }
  }
}
check("topological order", topologicalOrder.length === 76, `count=${topologicalOrder.length}`);
for (let phase = 0; phase <= 5; phase += 1) {
  const plannedOrder = `- GATE-${phase}: ${topologicalOrder.filter((task) => phaseByTask.get(task) === phase).join(" -> ")}`;
  check(`planned topological GATE-${phase}`, text.phases.includes(plannedOrder), "matches regenerated order");
}

check("PRG005/048 direction",
  graph.get("TASK-PRG005").includes("TASK-PRG048") && !graph.get("TASK-PRG048").includes("TASK-PRG005"),
  "PRG048 identity propagation precedes PRG005 authorization");
check("PRG027/049 direction",
  graph.get("TASK-PRG049").includes("TASK-PRG027") && !graph.get("TASK-PRG027").includes("TASK-PRG049"),
  "PRG027 Docker CI precedes PRG049 image hardening");

const gate01 = [...text.phases.matchAll(/^## GATE-[01]:[\s\S]*?^- Tasks: (.+)$/gm)]
  .flatMap((match) => match[1].split(", "));
check("SPC early placement", Array.from({ length: 26 }, (_, index) => `TASK-SPC${String(index + 1).padStart(3, "0")}`).every((task) => gate01.includes(task)), "all 26 SPC tasks in GATE-0/1");
check("root gate criteria", ["TASK-SPC022〜026", "TASK-PRG041/042/044/047/048"].every((value) => text.phases.includes(value)), "root specifications precede implementations");

const auditSpc = [...text.audit.matchAll(/^### SPC-(\d{3}):/gm)].map((match) => `SPC${match[1]}`);
check("audit mapping", auditSpc.length === 26 && auditSpc.every((id) => headings.includes(id)), "SPC-001..026 mapped once");

const immutable = {
  ".orchestration/audit/production_readiness_gap_audit.md": "38dd23a7cbb3081a75fac784e41954ed12f74a0099d604f6da6de27be058640a",
  ".orchestration/audit/specification_content_audit.md": "27f7d84566d9db0cbfdfc8bbd173f553aa79e63f391d4a94b0da4edfa2b2872d",
  ".orchestration/audit/spec_reconstruction.md": "78d629d6aaee88009fb63ba81cbd1c268bd39849ff27e87bed30864580298def",
  ".orchestration/acceptance/T31.acceptance.md": "33a44401e086877de3e79272a1b6cb6d1a38e4b8598f212fed521da27cadc035",
  ".orchestration/acceptance/T32.acceptance.md": "2f05d8ffd8bc5eb804ac4679c0b7c752b4b61d11058138410c33238e51af11b8",
};
for (const [path, expectedHash] of Object.entries(immutable)) {
  const actualHash = createHash("sha256").update(readFileSync(path)).digest("hex");
  check(`immutable ${path}`, actualHash === expectedHash, actualHash);
}

console.log("T33 VALIDATOR PASS");
console.log(`checks=${checks.length}`);
console.log("task headings=76, coverage rows=76, phase members=76; missing=0, duplicates=0");
console.log("schema labels=14 x 76, DoD=228, verified/real-env/anti-faking=76 each");
console.log("legacy values=0 in four target files; corrected facts=present in four target files");
console.log(`forbidden placeholders=0; allowed bare 未定 lines=${allowedUndecided.length}`);
console.log("SPC tasks=26 in GATE-0/1; root dependencies=5 forward, 0 reverse");
console.log(`dependency graph=DAG, dangling=0, cycles=0, phase violations=0`);
for (let phase = 0; phase <= 5; phase += 1) {
  console.log(`GATE-${phase} topological order: ${topologicalOrder.filter((task) => phaseByTask.get(task) === phase).join(" -> ")}`);
}
for (const [token, reason] of allowedUndecided) {
  const line = text.workplan.split("\n").findIndex((value) => value.includes(token)) + 1;
  console.log(`allowed 未定 line ${line}: ${JSON.stringify(token)} (${reason})`);
}
console.log("canonical-loss tasks=integrated through TASK-PRG023");
console.log("immutable audit/acceptance artifacts=5 hash matches");
