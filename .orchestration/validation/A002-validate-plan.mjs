// P012-F00-T02C
import fs from "node:fs";

const planPath = process.argv[2];
if (!planPath) throw new Error("usage: node A002-validate-plan.mjs <plan>");

const text = fs.readFileSync(planPath, "utf8");
const lines = text.split("\n");
const fields = [
  "Preconditions",
  "Allowed files",
  "Work",
  "Complete",
  "Verify Positive",
  "Verify Adversarial",
  "STOP",
];

const tasks = new Map();
for (const match of text.matchAll(
  /^#### (P012-(F\d{2}-T[A-Z0-9]+)) (.+)$/gm,
)) {
  if (tasks.has(match[2])) throw new Error(`duplicate heading: ${match[2]}`);
  const start = match.index;
  const next = text.indexOf("\n#### P012-", start + match[0].length);
  tasks.set(match[2], {
    id: match[2],
    title: match[3],
    body: text.slice(start, next < 0 ? text.length : next),
  });
}

const rows = new Map();
const dependencyStart = lines.findIndex((line) =>
  line.includes("| Task     | Direct prerequisites"),
);
const dependencyEnd = lines.findIndex(
  (line, index) =>
    index > dependencyStart && line === "### Formal atomic tasks for decomposed gate groups",
);
for (const line of lines.slice(dependencyStart, dependencyEnd)) {
  const match = line.match(/^\| (F\d{2}-T[A-Z0-9]+)\s+\| (.*?)\s+\|$/);
  if (!match) continue;
  if (rows.has(match[1])) throw new Error(`duplicate dependency row: ${match[1]}`);
  const dependencies = match[2]
    .split(/[,、]/)
    .map((value) => value.replaceAll("`", "").trim())
    .map((value) => value.replace(/^P012-/, ""))
    .filter((value) => /^F\d{2}-T[A-Z0-9]+$/.test(value));
  rows.set(match[1], dependencies);
}

const missingFields = [];
const owners = new Map();
for (const task of tasks.values()) {
  for (const field of fields) {
    if (!new RegExp(`^- \\*\\*${field}\\*\\*:`, "m").test(task.body)) {
      missingFields.push(`${task.id}:${field}`);
    }
  }
  const allowed = task.body.match(/^- \*\*Allowed files\*\*: (.+)$/m)?.[1] ?? "";
  for (const token of allowed.matchAll(/`([^`]+)`/g)) {
    const path = token[1];
    if (
      !path.includes("/") &&
      !["package.json", "pnpm-lock.yaml", ".env.example", ".mise.toml", "mise.lock"].includes(
        path,
      )
    ) {
      continue;
    }
    if (["readback.json", "evidence.json", "commands.json"].includes(path)) continue;
    const pathOwners = owners.get(path) ?? [];
    pathOwners.push(task.id);
    owners.set(path, pathOwners);
  }
}

const taskIds = new Set(tasks.keys());
const rowIds = new Set(rows.keys());
const missingRows = [...taskIds].filter((id) => !rowIds.has(id));
const extraRows = [...rowIds].filter((id) => !taskIds.has(id));
const unknownDependencies = [];
for (const [id, dependencies] of rows) {
  for (const dependency of dependencies) {
    if (!rowIds.has(dependency)) unknownDependencies.push(`${id}->${dependency}`);
  }
}

const visiting = new Set();
const visited = new Set();
let cycle = null;
function visit(id, path = []) {
  if (visiting.has(id)) {
    cycle = [...path, id];
    return;
  }
  if (visited.has(id) || cycle) return;
  visiting.add(id);
  for (const dependency of rows.get(id) ?? []) visit(dependency, [...path, id]);
  visiting.delete(id);
  visited.add(id);
}
for (const id of rows.keys()) visit(id);

const reachableCache = new Map();
function dependenciesOf(id) {
  if (reachableCache.has(id)) return reachableCache.get(id);
  const result = new Set();
  const pending = [...(rows.get(id) ?? [])];
  while (pending.length) {
    const dependency = pending.pop();
    if (result.has(dependency)) continue;
    result.add(dependency);
    pending.push(...(rows.get(dependency) ?? []));
  }
  reachableCache.set(id, result);
  return result;
}

const unorderedSharedPaths = [];
for (const [path, pathOwners] of owners) {
  const uniqueOwners = [...new Set(pathOwners)];
  for (let left = 0; left < uniqueOwners.length; left += 1) {
    for (let right = left + 1; right < uniqueOwners.length; right += 1) {
      const a = uniqueOwners[left];
      const b = uniqueOwners[right];
      if (!dependenciesOf(a).has(b) && !dependenciesOf(b).has(a)) {
        unorderedSharedPaths.push({ path, owners: [a, b] });
      }
    }
  }
}

const result = {
  headings: tasks.size,
  dependencyRows: rows.size,
  missingFields,
  missingRows,
  extraRows,
  unknownDependencies,
  duplicateHeadings: 0,
  duplicateDependencyRows: 0,
  cycle,
  unorderedSharedPaths,
};
console.log(JSON.stringify(result, null, 2));

if (
  tasks.size !== 115 ||
  rows.size !== 115 ||
  missingFields.length ||
  missingRows.length ||
  extraRows.length ||
  unknownDependencies.length ||
  cycle ||
  unorderedSharedPaths.length
) {
  process.exitCode = 1;
}
