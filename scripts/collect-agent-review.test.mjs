// 根拠: FinalArch:COD-006 / WBS P8-T06 / ADV-FIX-04
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collector = path.join(repoRoot, "scripts/collect-agent-review.mjs");
const sourceManifest = path.join(repoRoot, "contracts/agent-task/fixtures/valid.manifest.json");

function fixture() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "aiops-authority-review-"));
  execFileSync("git", ["init", "-b", "main", target]);
  execFileSync("git", ["-C", target, "config", "user.name", "review-test"]);
  execFileSync("git", ["-C", target, "config", "user.email", "review-test@example.invalid"]);
  fs.mkdirSync(path.join(target, "contracts/agent-task"), { recursive: true });
  fs.writeFileSync(path.join(target, "contracts/agent-task/change.md"), "base\n");
  execFileSync("git", ["-C", target, "add", "."]);
  execFileSync("git", ["-C", target, "commit", "-m", "base"]);
  const base = execFileSync("git", ["-C", target, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  fs.appendFileSync(path.join(target, "contracts/agent-task/change.md"), "head\n");
  execFileSync("git", ["-C", target, "add", "."]);
  execFileSync("git", ["-C", target, "commit", "-m", "head"]);
  const head = execFileSync("git", ["-C", target, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  fs.copyFileSync(sourceManifest, path.join(target, "task-manifest.json"));
  const digest = createHash("sha256")
    .update(fs.readFileSync(path.join(target, "task-manifest.json")))
    .digest("hex");
  return { target, base, head, digest };
}

function run({ target, base, head, digest }, output, manifestDigest = digest) {
  return spawnSync(
    process.execPath,
    [
      collector,
      "--target",
      target,
      "--manifest",
      "task-manifest.json",
      "--manifest-digest",
      manifestDigest,
      "--base",
      base,
      "--head",
      head,
      "--reviewer",
      "claude-reviewer",
      "--profile",
      "review",
      "--output",
      output,
    ],
    { encoding: "utf8" },
  );
}

describe("review manifest authority (ADV-FIX-04)", () => {
  it("accepts an exact raw-byte digest", () => {
    const data = fixture();
    try {
      const output = path.join(data.target, "review.json");
      const result = run(data, output);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(fs.readFileSync(output, "utf8")).findings, []);
    } finally {
      fs.rmSync(data.target, { recursive: true, force: true });
    }
  });

  for (const [label, digest] of [
    ["missing", ""],
    ["mismatched", "0".repeat(64)],
  ]) {
    it(`writes a critical machine finding and exits nonzero for ${label} digest`, () => {
      const data = fixture();
      try {
        const output = path.join(data.target, "review.json");
        const result = run(data, output, digest);
        assert.notEqual(result.status, 0);
        const artifact = JSON.parse(fs.readFileSync(output, "utf8"));
        assert.equal(artifact.findings[0].severity, "critical");
        assert.equal(artifact.findings[0].dimension, "security");
        assert.match(artifact.findings[0].evidence, /manifest digest/u);
      } finally {
        fs.rmSync(data.target, { recursive: true, force: true });
      }
    });
  }
});
