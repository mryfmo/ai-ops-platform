// 根拠: P010-F01-T10 — acceptance receipt を immutable Plan と Git object から検証する。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PLAN_PATH = "plans/010-recommended-spec-environment-execution.md";
export const PLAN_COMMIT = "cf21b5edaff036adacb0002ecfa3fa825ba268a9";
export const PLAN_BLOB = "76137212e6878edb193aeb0f41c6a37f7c3eab5f";
export const PLAN_SHA256 = "ca3c85cf311b3942f3913032a71c721acdced370c4bc4c869515f4ed50bb9136";
const DEV_TRUST_COMMIT = PLAN_COMMIT;
const DEV_TRUST_PATH = "docs/decisions/acceptance-trust-bootstrap.md";

export const EXPECTED_PHASE_COUNTS = Object.freeze({
  F00: 4,
  F01: 11,
  F02: 14,
  F03: 8,
  F04: 8,
  F05: 20,
  F06: 18,
  F07: 3,
});

export const EXPECTED_TASK_IDS = Object.freeze(
  Object.entries(EXPECTED_PHASE_COUNTS).flatMap(([phase, count]) =>
    Array.from({ length: count }, (_, index) => `P010-${phase}-T${String(index + 1).padStart(2, "0")}`),
  ),
);

const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const fail = (message) => {
  throw new Error(message);
};

function git(repoRoot, args, encoding = "utf8") {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail(`git object lookup failed: git ${args.join(" ")}`);
  }
}

function assertCommit(repoRoot, commit, label) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) fail(`${label}: target SHA must be 40 lowercase hex`);
  if (git(repoRoot, ["cat-file", "-t", commit]).trim() !== "commit") fail(`${label}: target SHA is not a commit`);
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch {
    fail(`${label}: target SHA is not an ancestor of HEAD`);
  }
}

function gitFile(repoRoot, commit, artifactPath, label) {
  const entry = git(repoRoot, ["ls-tree", commit, "--", artifactPath]).trim();
  if (!entry) fail(`${label}: missing artifact ${artifactPath}`);
  const match = /^(?<mode>\d{6}) blob (?<blob>[0-9a-f]{40})\t(?<path>.+)$/u.exec(entry);
  if (!match || match.groups.path !== artifactPath) {
    if (entry.startsWith("120000 ")) fail(`${label}: symlink artifact ${artifactPath}`);
    fail(`${label}: artifact is not a regular Git blob ${artifactPath}`);
  }
  if (!match.groups.mode.startsWith("100")) fail(`${label}: symlink artifact ${artifactPath}`);
  return git(repoRoot, ["show", `${commit}:${artifactPath}`], null);
}

export function validateArtifactPath(root, artifactPath) {
  if (
    typeof artifactPath !== "string" ||
    !artifactPath ||
    artifactPath.includes("\\") ||
    artifactPath.includes(":") ||
    /[\u0000-\u001f\u007f]/u.test(artifactPath) ||
    path.posix.isAbsolute(artifactPath) ||
    artifactPath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    fail(`artifact path is outside repository: ${JSON.stringify(artifactPath)}`);
  }

  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, artifactPath);
  if (!absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    fail(`artifact path is outside repository: ${artifactPath}`);
  }

  let current = absoluteRoot;
  const parts = artifactPath.split("/");
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
    if (stat.isSymbolicLink()) fail(`symlink artifact is forbidden: ${artifactPath}`);
    if (index < parts.length - 1 && !stat.isDirectory()) fail(`artifact parent is not a directory: ${artifactPath}`);
    if (index === parts.length - 1 && !stat.isFile()) fail(`artifact is not a regular file: ${artifactPath}`);
  }
  return artifactPath;
}

function taskSections(planText) {
  const headings = [...planText.matchAll(/^#### (P010-F[0-9]{2}-T[0-9]{2}) .+$/gmu)];
  return new Map(
    headings.map((heading, index) => [
      heading[1],
      planText.slice(heading.index, headings[index + 1]?.index ?? planText.length),
    ]),
  );
}

export function loadImmutablePlan(repoRoot) {
  const entry = git(repoRoot, ["ls-tree", PLAN_COMMIT, "--", PLAN_PATH]).trim();
  const match = /^100644 blob (?<blob>[0-9a-f]{40})\t.+$/u.exec(entry);
  if (!match || match.groups.blob !== PLAN_BLOB) fail("plan hash mismatch: immutable Git blob");
  const content = git(repoRoot, ["show", `${PLAN_COMMIT}:${PLAN_PATH}`], null);
  if (sha256(content) !== PLAN_SHA256) fail("plan hash mismatch: SHA-256");
  const text = content.toString("utf8");
  const taskIds = [...text.matchAll(/^#### (P010-F[0-9]{2}-T[0-9]{2}) .+$/gmu)].map((match) => match[1]);
  const phaseCounts = Object.fromEntries(
    Object.keys(EXPECTED_PHASE_COUNTS).map((phase) => [
      phase,
      taskIds.filter((taskId) => taskId.includes(`-${phase}-`)).length,
    ]),
  );
  if (taskIds.length !== 86 || JSON.stringify(taskIds) !== JSON.stringify(EXPECTED_TASK_IDS)) {
    fail("plan task universe does not match the 86-task golden fixture");
  }
  if (JSON.stringify(phaseCounts) !== JSON.stringify(EXPECTED_PHASE_COUNTS)) {
    fail("plan phase counts do not match the golden fixture");
  }
  return { content, text, taskIds, phaseCounts, sections: taskSections(text) };
}

function dependencyMap() {
  const dependencies = new Map(EXPECTED_TASK_IDS.map((taskId) => [taskId, []]));
  const id = (phase, task) => `P010-${phase}-T${String(task).padStart(2, "0")}`;
  const set = (taskId, required) => dependencies.set(taskId, required);
  const range = (phase, start, end) => Array.from({ length: end - start + 1 }, (_, index) => id(phase, start + index));
  const chain = (phase, start, end, base) => {
    set(id(phase, start), base);
    for (let task = start + 1; task <= end; task += 1) set(id(phase, task), [id(phase, task - 1)]);
  };

  set(id("F00", 4), range("F00", 1, 3));
  set(id("F01", 1), [id("F00", 4)]);
  set(id("F01", 2), [id("F01", 1)]);
  set(id("F01", 3), [id("F01", 2)]);
  set(id("F01", 4), [id("F01", 3)]);
  set(id("F01", 5), [id("F01", 1)]);
  set(id("F01", 6), [id("F01", 5)]);
  for (const task of [7, 8, 9]) set(id("F01", task), [id("F01", 1)]);
  set(id("F01", 10), range("F01", 1, 9));
  set(id("F01", 11), [id("F01", 10)]);

  for (const task of [1, 3, 5]) set(id("F02", task), [id("F01", 11)]);
  set(id("F02", 2), [id("F02", 1)]);
  set(id("F02", 4), [id("F02", 3)]);
  set(id("F02", 6), [id("F02", 3), id("F02", 5)]);
  set(id("F02", 7), [id("F02", 1), id("F02", 2), id("F02", 6)]);
  set(id("F02", 8), [id("F02", 6), id("F02", 7)]);
  set(id("F02", 9), [id("F02", 4), id("F02", 5), id("F02", 6), id("F02", 8)]);
  set(id("F02", 10), [id("F02", 6), id("F02", 7), id("F02", 8)]);
  set(id("F02", 11), [id("F02", 10)]);
  set(id("F02", 12), [id("F02", 5), id("F02", 6), id("F02", 7), id("F02", 8), id("F02", 10), id("F02", 11)]);
  set(id("F02", 13), range("F02", 9, 12));
  set(id("F02", 14), range("F02", 9, 13));

  for (const task of [1, 2, 3]) set(id("F03", task), [id("F02", 3), id("F02", 5), id("F02", 6)]);
  set(id("F03", 4), range("F03", 1, 3));
  chain("F03", 5, 8, [id("F03", 4)]);

  for (const task of [1, 4]) set(id("F04", task), [id("F01", 11)]);
  set(id("F04", 2), [id("F04", 1)]);
  set(id("F04", 3), [id("F04", 2)]);
  set(id("F04", 5), [id("F04", 3), id("F04", 4)]);
  chain("F04", 6, 8, [id("F04", 5)]);

  chain("F05", 1, 5, [id("F02", 14), id("F03", 8), id("F04", 8)]);
  chain("F05", 6, 9, [id("F03", 8), id("F04", 8)]);
  chain("F05", 10, 14, [id("F02", 14), id("F03", 8)]);
  chain("F05", 15, 20, [id("F02", 14), id("F03", 8)]);

  const infrastructureBase = [id("F02", 14), id("F03", 8), id("F04", 8), id("F05", 20)];
  set(id("F06", 1), infrastructureBase);
  for (const task of [2, 3, 4, 5]) set(id("F06", task), [id("F06", 1)]);
  set(id("F06", 6), range("F06", 2, 5));
  set(id("F06", 7), [id("F06", 6)]);
  set(id("F06", 8), [id("F06", 7)]);
  chain("F06", 9, 18, [id("F06", 8)]);

  set(id("F07", 1), [
    id("F00", 4),
    id("F01", 11),
    id("F02", 14),
    id("F03", 8),
    id("F04", 8),
    id("F05", 20),
    id("F06", 18),
  ]);
  set(id("F07", 2), [id("F07", 1)]);
  set(id("F07", 3), [id("F07", 2)]);
  return dependencies;
}

const DEPENDENCIES = dependencyMap();

function validateGitEvidence(repoRoot, evidence, label) {
  if (!evidence || evidence.kind !== "git-file") fail(`${label}: git-derived evidence is required`);
  assertCommit(repoRoot, evidence.commit, label);
  validateArtifactPath(repoRoot, evidence.path);
  const content = gitFile(repoRoot, evidence.commit, evidence.path, label);
  if (!/^[0-9a-f]{64}$/.test(evidence.sha256 ?? "") || sha256(content) !== evidence.sha256) {
    fail(`${label}: evidence hash mismatch`);
  }
  return content;
}

function validateReview(repoRoot, record, devTrust) {
  const { review } = record;
  if (!review || typeof review !== "object") fail(`${record.task_id}: review is required`);
  if (review.requester !== record.requester) fail(`${record.task_id}: review requester mismatch`);
  if (!review.reviewer) fail(`${record.task_id}: reviewer is required`);
  if (review.reviewer === record.requester) fail(`${record.task_id}: requester cannot review its own record`);
  if (review.outcome !== "ACCEPTED") fail(`${record.task_id}: review outcome must be ACCEPTED`);
  if (review.evidence?.kind !== "git-file") fail(`${record.task_id}: git-derived review evidence is required`);
  const content = validateGitEvidence(repoRoot, review.evidence, `${record.task_id} review`);

  if (review.reviewer.startsWith("DEV-")) {
    if (
      review.evidence.commit !== DEV_TRUST_COMMIT ||
      review.evidence.path !== DEV_TRUST_PATH ||
      !content.includes(Buffer.from(review.reviewer)) ||
      !content.includes(Buffer.from("DEV-DEFAULT"))
    ) {
      fail(`${record.task_id}: DEV reviewer is not authorized by the tracked decision`);
    }
    devTrust.add(`${record.task_id}:${review.reviewer}`);
    return;
  }

  let receipt;
  try {
    receipt = JSON.parse(content.toString("utf8"));
  } catch {
    fail(`${record.task_id}: production review evidence must be JSON`);
  }
  if (
    receipt.task_id !== record.task_id ||
    receipt.requester !== record.requester ||
    receipt.reviewer !== review.reviewer ||
    receipt.outcome !== "ACCEPTED"
  ) {
    fail(`${record.task_id}: review evidence does not match the record`);
  }
}

function validateExternal(repoRoot, record, required, devTrust) {
  const { external } = record;
  if (!external || typeof external !== "object") fail(`${record.task_id}: external is required`);
  if (external.required !== required) fail(`${record.task_id}: external.required does not match immutable Plan`);
  if (!required) {
    if (!external.reason) fail(`${record.task_id}: external N/A reason is required`);
    return;
  }
  if (!external.scope || !external.approver) fail(`${record.task_id}: external scope and approver are required`);
  if (external.approver === record.requester) fail(`${record.task_id}: requester cannot approve external evidence`);
  if (!external.evidence || !["git-file", "merge-commit"].includes(external.evidence.kind)) {
    fail(`${record.task_id}: git-derived external evidence is required`);
  }
  if (external.evidence.kind === "merge-commit") {
    if (external.evidence.commit !== record.target_commit) fail(`${record.task_id}: external merge evidence mismatch`);
    assertCommit(repoRoot, external.evidence.commit, `${record.task_id} external`);
    const parents = git(repoRoot, ["show", "-s", "--format=%P", external.evidence.commit]).trim().split(/\s+/u);
    if (parents.length < 2) fail(`${record.task_id}: external evidence is not a merge commit`);
  } else {
    validateGitEvidence(repoRoot, external.evidence, `${record.task_id} external`);
  }
  if (external.approver.startsWith("DEV-")) devTrust.add(`${record.task_id}:${external.approver}`);
}

function validateHuman(repoRoot, record, required, devTrust) {
  const { human } = record;
  if (!human || typeof human !== "object") fail(`${record.task_id}: human is required`);
  if (human.required !== required) fail(`${record.task_id}: human.required does not match immutable Plan`);
  if (!required) {
    if (!human.reason) fail(`${record.task_id}: human N/A reason is required`);
    return;
  }
  if (!human.approver || human.approver === record.requester) {
    fail(`${record.task_id}: requester cannot approve human evidence`);
  }
  validateGitEvidence(repoRoot, human.evidence, `${record.task_id} human`);
  if (human.approver.startsWith("DEV-")) devTrust.add(`${record.task_id}:${human.approver}`);
}

function validateRecord(repoRoot, record, section, devTrust) {
  if (!record || typeof record !== "object") fail("record must be an object");
  if (record.status !== "ACCEPTED") fail(`${record.task_id}: status must be ACCEPTED`);
  if (!record.requester) fail(`${record.task_id}: requester is required`);
  assertCommit(repoRoot, record.target_commit, record.task_id);
  if (!Array.isArray(record.commands) || !record.commands.length) fail(`${record.task_id}: commands are required`);
  for (const command of record.commands) {
    if (!command?.command || command.exit_code !== 0) fail(`${record.task_id}: nonzero command or missing command`);
  }
  if (!Array.isArray(record.artifacts) || !record.artifacts.length) fail(`${record.task_id}: artifacts are required`);

  validateReview(repoRoot, record, devTrust);
  const type = section.match(/^- Type(?:\/model)?:.*$/mu)?.[0] ?? "";
  validateExternal(repoRoot, record, /external|Git\/PR/u.test(type), devTrust);
  validateHuman(repoRoot, record, /human/iu.test(type), devTrust);
}

function validateArtifact(repoRoot, record, artifact) {
  validateArtifactPath(repoRoot, artifact?.path);
  if (!/^[0-9a-f]{64}$/.test(artifact?.sha256 ?? "")) {
    fail(`${record.task_id}: artifact SHA-256 is required`);
  }
  const content = gitFile(repoRoot, record.target_commit, artifact.path, record.task_id);
  if (sha256(content) !== artifact.sha256) {
    fail(`${record.task_id}: artifact hash mismatch ${artifact.path}`);
  }
}

export function validateManifest(manifest, { repoRoot = process.cwd(), through, final = false } = {}) {
  const plan = loadImmutablePlan(repoRoot);
  if (
    !manifest?.plan ||
    manifest.plan.path !== PLAN_PATH ||
    manifest.plan.commit !== PLAN_COMMIT ||
    manifest.plan.blob !== PLAN_BLOB ||
    manifest.plan.sha256 !== PLAN_SHA256
  ) {
    fail("plan hash mismatch: manifest does not name the immutable Plan object");
  }
  if (Boolean(through) === Boolean(final)) fail("choose exactly one of --through or --final");
  const throughIndex = final ? EXPECTED_TASK_IDS.length - 1 : EXPECTED_TASK_IDS.indexOf(through);
  if (throughIndex < 0) fail(`unknown --through task ${through}`);
  const expected = EXPECTED_TASK_IDS.slice(0, throughIndex + 1);
  const records = manifest.records;
  if (!Array.isArray(records)) fail("manifest records must be an array");

  const seen = new Set();
  for (const record of records) {
    if (seen.has(record?.task_id)) fail(`duplicate task ${record.task_id}`);
    seen.add(record?.task_id);
  }
  if (records.length < expected.length) fail(`missing task ${expected[records.length]}`);
  if (records.length > expected.length) fail(`extra task ${records[expected.length]?.task_id}`);
  for (const [index, taskId] of expected.entries()) {
    if (records[index]?.task_id !== taskId) fail(`task out of order: expected ${taskId}`);
  }

  const devTrust = new Set();
  for (const record of records) {
    validateRecord(repoRoot, record, plan.sections.get(record.task_id), devTrust);
  }

  const recordById = new Map(records.map((record) => [record.task_id, record]));
  for (const record of records) {
    for (const dependency of DEPENDENCIES.get(record.task_id)) {
      const dependencyRecord = recordById.get(dependency);
      if (!dependencyRecord) fail(`${record.task_id}: missing dependency ${dependency}`);
      try {
        execFileSync("git", ["merge-base", "--is-ancestor", dependencyRecord.target_commit, record.target_commit], {
          cwd: repoRoot,
          stdio: "ignore",
        });
      } catch {
        fail(`${record.task_id}: dependency is not an ancestor: ${dependency}`);
      }
    }
  }

  for (const record of records) {
    for (const artifact of record.artifacts) validateArtifact(repoRoot, record, artifact);
  }

  const warnings = devTrust.size
    ? [
        `DEV-TRUST: ${devTrust.size} placeholder trust assignments are development-only; production acceptance is blocked.`,
      ]
    : [];
  return { taskCount: records.length, through: expected.at(-1), warnings };
}

function usage() {
  return "usage: validate-acceptance-manifest.mjs (--through TASK_ID | --final) MANIFEST";
}

function main(argv) {
  let through;
  let final = false;
  let manifestPath;
  if (argv[0] === "--through" && argv.length === 3) {
    [, through, manifestPath] = argv;
  } else if (argv[0] === "--final" && argv.length === 2) {
    final = true;
    [, manifestPath] = argv;
  } else {
    fail(usage());
  }
  const repoRoot = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const manifest = JSON.parse(fs.readFileSync(path.resolve(repoRoot, manifestPath), "utf8"));
  const result = validateManifest(manifest, { repoRoot, through, final });
  for (const warning of result.warnings) console.log(`WARNING: ${warning}`);
  console.log(`OK: validated ${result.taskCount} acceptance records through ${result.through}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
