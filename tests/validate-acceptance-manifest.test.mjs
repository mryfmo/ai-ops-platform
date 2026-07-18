// 根拠: P010-F01-T10 — acceptance manifest の自己申告・path・hash・依存関係を否定試験する。
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PHASE_COUNTS,
  EXPECTED_TASK_IDS,
  loadImmutablePlan,
  validateArtifactPath,
  validateManifest,
} from "../scripts/validate-acceptance-manifest.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "verification/acceptance-manifest.json");
const GOLDEN_PHASE_COUNTS = {
  F00: 4,
  F01: 11,
  F02: 14,
  F03: 8,
  F04: 8,
  F05: 20,
  F06: 18,
  F07: 3,
};
const GOLDEN_TASK_IDS = Object.entries(GOLDEN_PHASE_COUNTS).flatMap(([phase, count]) =>
  Array.from({ length: count }, (_, index) => `P010-${phase}-T${String(index + 1).padStart(2, "0")}`),
);

function manifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function manifestThroughT09() {
  const value = manifest();
  const t09Index = value.records.findIndex(({ task_id: taskId }) => taskId === "P010-F01-T09");
  assert.notEqual(t09Index, -1);
  value.records = value.records.slice(0, t09Index + 1);
  return value;
}

function runCli(value) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acceptance-manifest-"));
  const fixturePath = path.join(root, "fixture.json");
  try {
    fs.writeFileSync(fixturePath, JSON.stringify(value));
    return spawnSync(
      process.execPath,
      ["scripts/validate-acceptance-manifest.mjs", "--through", "P010-F01-T09", fixturePath],
      { cwd: repoRoot, encoding: "utf8" },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function clone(value) {
  return structuredClone(value);
}

test("P010-F01-T10 extracts the exact 86-task golden universe", () => {
  const plan = loadImmutablePlan(repoRoot);
  assert.deepEqual(EXPECTED_TASK_IDS, GOLDEN_TASK_IDS);
  assert.deepEqual(EXPECTED_PHASE_COUNTS, GOLDEN_PHASE_COUNTS);
  assert.deepEqual(plan.taskIds, GOLDEN_TASK_IDS);
  assert.deepEqual(plan.phaseCounts, GOLDEN_PHASE_COUNTS);
});

test("P010-F01-T10 accepts the tracked manifest through T09 with a visible DEV-TRUST warning", () => {
  const result = validateManifest(manifestThroughT09(), { repoRoot, through: "P010-F01-T09" });
  assert.equal(result.taskCount, 13);
  assert.match(result.warnings.join("\n"), /DEV-TRUST/);
});

test("P010-F01-T10 CLI accepts through T09 and never passes DEV defaults silently", () => {
  const result = runCli(manifestThroughT09());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DEV-TRUST/);
  assert.match(result.stdout, /validated 13 acceptance records/);
});

test("P010-F01-T10 CLI exits 1 for an invalid receipt", () => {
  const invalid = manifestThroughT09();
  invalid.records[0].commands[0].exit_code = 1;
  const result = runCli(invalid);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /nonzero command/);
});

test("P010-F01-T10 rejects missing, extra, duplicate, and out-of-order task records", () => {
  const missing = manifestThroughT09();
  missing.records.pop();
  assert.throws(() => validateManifest(missing, { repoRoot, through: "P010-F01-T09" }), /missing task/);

  const extra = manifestThroughT09();
  extra.records.push({ ...clone(extra.records.at(-1)), task_id: "P010-F01-T10" });
  assert.throws(() => validateManifest(extra, { repoRoot, through: "P010-F01-T09" }), /extra task/);

  const duplicate = manifestThroughT09();
  duplicate.records[1].task_id = duplicate.records[0].task_id;
  assert.throws(() => validateManifest(duplicate, { repoRoot, through: "P010-F01-T09" }), /duplicate task/);

  const outOfOrder = manifestThroughT09();
  [outOfOrder.records[1], outOfOrder.records[2]] = [outOfOrder.records[2], outOfOrder.records[1]];
  assert.throws(() => validateManifest(outOfOrder, { repoRoot, through: "P010-F01-T09" }), /out of order/);
});

test("P010-F01-T10 rejects blocked status, plan mismatch, nonzero command, and required null", () => {
  const blocked = manifestThroughT09();
  blocked.records[0].status = "BLOCKED";
  assert.throws(() => validateManifest(blocked, { repoRoot, through: "P010-F01-T09" }), /status must be ACCEPTED/);

  const planMismatch = manifestThroughT09();
  planMismatch.plan.sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(planMismatch, { repoRoot, through: "P010-F01-T09" }), /plan hash mismatch/);

  const nonzero = manifestThroughT09();
  nonzero.records[0].commands[0].exit_code = 1;
  assert.throws(() => validateManifest(nonzero, { repoRoot, through: "P010-F01-T09" }), /nonzero command/);

  const requiredNull = manifestThroughT09();
  requiredNull.records[0].external = null;
  assert.throws(() => validateManifest(requiredNull, { repoRoot, through: "P010-F01-T09" }), /external is required/);
});

test("P010-F01-T10 rejects missing artifacts and non-ancestor dependencies", () => {
  const missingArtifact = manifestThroughT09();
  missingArtifact.records[0].artifacts[0].path = "docs/audit/does-not-exist.md";
  assert.throws(() => validateManifest(missingArtifact, { repoRoot, through: "P010-F01-T09" }), /missing artifact/);

  const nonAncestor = manifestThroughT09();
  nonAncestor.records[5].target_commit = nonAncestor.records[3].target_commit;
  assert.throws(
    () => validateManifest(nonAncestor, { repoRoot, through: "P010-F01-T09" }),
    /dependency is not an ancestor/,
  );
});

test("P010-F01-T10 rejects symlink artifacts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acceptance-artifact-"));
  try {
    fs.writeFileSync(path.join(root, "target"), "content");
    fs.symlinkSync("target", path.join(root, "link"));
    assert.throws(() => validateArtifactPath(root, "link"), /symlink artifact/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("P010-F01-T10 rejects repository escape and artifact hash mismatch", () => {
  const outside = manifestThroughT09();
  outside.records[0].artifacts[0].path = "../outside";
  assert.throws(() => validateManifest(outside, { repoRoot, through: "P010-F01-T09" }), /outside repository/);

  const mismatch = manifestThroughT09();
  mismatch.records[0].artifacts[0].sha256 = "0".repeat(64);
  assert.throws(() => validateManifest(mismatch, { repoRoot, through: "P010-F01-T09" }), /artifact hash mismatch/);
});

test("P010-F01-T10 rejects self-reported review and ENV evidence", () => {
  const selfReportedReview = manifestThroughT09();
  selfReportedReview.records[0].review.evidence = { kind: "self_reported", outcome: "ACCEPTED" };
  assert.throws(
    () => validateManifest(selfReportedReview, { repoRoot, through: "P010-F01-T09" }),
    /git-derived review evidence/,
  );

  const selfReportedEnv = manifestThroughT09();
  const mergeRecord = selfReportedEnv.records.find(({ task_id }) => task_id === "P010-F00-T04");
  mergeRecord.external.evidence = { kind: "self_reported", outcome: "green" };
  assert.throws(
    () => validateManifest(selfReportedEnv, { repoRoot, through: "P010-F01-T09" }),
    /git-derived external evidence/,
  );
});

test("P010-F01-T10 rejects requester self-review and self-approval", () => {
  const selfReview = manifestThroughT09();
  selfReview.records[0].review.reviewer = selfReview.records[0].review.requester;
  assert.throws(() => validateManifest(selfReview, { repoRoot, through: "P010-F01-T09" }), /requester cannot review/);

  const selfApproval = manifestThroughT09();
  const mergeRecord = selfApproval.records.find(({ task_id }) => task_id === "P010-F00-T04");
  mergeRecord.external.approver = mergeRecord.requester;
  assert.throws(
    () => validateManifest(selfApproval, { repoRoot, through: "P010-F01-T09" }),
    /requester cannot approve/,
  );
});

test("P010-F01-T10 --final rejects the incomplete real manifest", () => {
  assert.throws(() => validateManifest(manifest(), { repoRoot, final: true }), /missing task/);
});
