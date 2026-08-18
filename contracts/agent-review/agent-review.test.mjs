// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-006 / ADR-0027 / WBS P8-T06
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { collectReviewArtifact } from "../../scripts/collect-agent-review.mjs";
import { validateReviewArtifact } from "./review-validator.mjs";
import { validateReviewWorkflow } from "./workflow-validator.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(directory, "../..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "contracts/agent-task/fixtures/valid.manifest.json"), "utf8"),
);
const review = JSON.parse(fs.readFileSync(path.join(directory, "fixtures/valid.review.json"), "utf8"));
const workflow = YAML.parse(fs.readFileSync(path.join(repoRoot, ".github/workflows/coding-task-review.yml"), "utf8"), {
  uniqueKeys: true,
});
const clone = (value) => structuredClone(value);

describe("independent review artifact contract [FinalArch:FR-AGT-005 / FinalArch:COD-006]", () => {
  it("accepts structured findings that match the manifest reviewer and profile", () => {
    assert.doesNotThrow(() => validateReviewArtifact(clone(review), clone(manifest)));
  });

  it("accepts the shared lowercase UUID task_id shape and rejects malformed variants", () => {
    const uuid = "11111111-1111-1111-1111-111111111111";
    const runtimeManifest = clone(manifest);
    const runtimeReview = clone(review);
    runtimeManifest.task_id = uuid;
    runtimeManifest.delivery.branch = `agent/${uuid}`;
    runtimeReview.task_id = uuid;
    assert.doesNotThrow(() => validateReviewArtifact(runtimeReview, runtimeManifest));

    runtimeReview.task_id = "11111111-1111-1111-1111-11111111111G";
    assert.throws(
      () => validateReviewArtifact(runtimeReview, runtimeManifest),
      /invalid Draft 2020-12 schema or fixture/u,
    );
  });

  it("rejects missing finding fields and reviewer or profile substitution", () => {
    for (const field of ["dimension", "severity", "file", "line", "evidence", "suggestion"]) {
      const invalid = clone(review);
      delete invalid.findings[0][field];
      assert.throws(() => validateReviewArtifact(invalid, clone(manifest)), /invalid Draft 2020-12 schema or fixture/u);
    }

    for (const field of ["agent_id", "execution_profile"]) {
      const invalid = clone(review);
      invalid.reviewer[field] = "substituted-reviewer";
      assert.throws(() => validateReviewArtifact(invalid, clone(manifest)), /reviewer .* does not match manifest/u);
    }
  });

  it("rejects incomplete dimensions and collection evidence inconsistent with the diff", () => {
    const missingDimension = clone(review);
    missingDimension.reviewed_dimensions.pop();
    assert.throws(
      () => validateReviewArtifact(missingDimension, clone(manifest)),
      /invalid Draft 2020-12 schema or fixture/u,
    );

    const unrelatedSecurityPath = clone(review);
    unrelatedSecurityPath.collection.security_sensitive_files = ["scripts/unrelated.mjs"];
    assert.throws(
      () => validateReviewArtifact(unrelatedSecurityPath, clone(manifest)),
      /security path was not changed/u,
    );
  });
});

describe("review workflow security [FinalArch:COD-006]", () => {
  it("allows only a read-only token and a credential-free, data-only target checkout", () => {
    assert.doesNotThrow(() => validateReviewWorkflow(clone(workflow)));
  });

  it("requires the manifest digest dispatch authority to reach the trusted collector unchanged", () => {
    const missing = clone(workflow);
    delete missing.on.workflow_dispatch.inputs.manifest_digest;
    assert.throws(() => validateReviewWorkflow(missing), /inputs must be exactly/u);

    const substituted = clone(workflow);
    substituted.jobs["independent-review"].steps.find((step) =>
      String(step.run ?? "").includes("node scripts/collect-agent-review.mjs"),
    ).env.MANIFEST_DIGEST = "writer-controlled";
    assert.throws(() => validateReviewWorkflow(substituted), /manifest digest must come from the dispatch input/u);
  });

  it("rejects write scope, persisted checkout credentials, and branch mutation", () => {
    const writeScope = clone(workflow);
    writeScope.permissions.contents = "write";
    assert.throws(() => validateReviewWorkflow(writeScope), /contents: read/u);

    const persistedCredential = clone(workflow);
    persistedCredential.jobs["independent-review"].steps.find((step) => step.name === "Checkout review target").with[
      "persist-credentials"
    ] = true;
    assert.throws(() => validateReviewWorkflow(persistedCredential), /persist-credentials: false/u);

    const mutation = clone(workflow);
    mutation.jobs["independent-review"].steps.push({ name: "Mutate writer branch", run: "git push origin HEAD" });
    assert.throws(() => validateReviewWorkflow(mutation), /branch mutation command/u);

    const secret = clone(workflow);
    secret.jobs["independent-review"].steps.push({
      name: "Read secret",
      env: { TOKEN: "${{ secrets.REVIEW_TOKEN }}" },
      run: "true",
    });
    assert.throws(() => validateReviewWorkflow(secret), /must not receive secrets/u);

    const targetExecution = clone(workflow);
    targetExecution.jobs["independent-review"].steps.push({
      name: "Execute review target",
      "working-directory": "review-target",
      run: "node untrusted.mjs",
    });
    assert.throws(() => validateReviewWorkflow(targetExecution), /data-only/u);

    const unpinned = clone(workflow);
    unpinned.jobs["independent-review"].steps.find(
      (step) => step.name === "Checkout trusted review implementation",
    ).uses = "actions/checkout@v7";
    assert.throws(() => validateReviewWorkflow(unpinned), /SHA-pinned/u);
  });
});

describe("mechanical review collection [FinalArch:FR-AGT-005]", () => {
  it("rejects abbreviated revisions and manifest path traversal before diff collection", () => {
    assert.throws(
      () =>
        collectReviewArtifact({
          manifest: clone(manifest),
          targetRoot: repoRoot,
          baseSha: "HEAD~1",
          headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          reviewerAgentId: manifest.reviewer.agent_id,
          reviewerExecutionProfile: manifest.reviewer.execution_profile,
        }),
      /full lowercase commit SHA/u,
    );

    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts/collect-agent-review.mjs"),
        "--target",
        repoRoot,
        "--manifest",
        "../manifest.json",
        "--manifest-digest",
        "0".repeat(64),
        "--base",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "--head",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "--reviewer",
        manifest.reviewer.agent_id,
        "--profile",
        manifest.reviewer.execution_profile,
        "--output",
        path.join(os.tmpdir(), "must-not-exist-review.json"),
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /manifest must be a safe repository-relative path/u);
  });

  it("collects diff/spec/security evidence and reports forbidden paths without executing target code", () => {
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aiops-review-target-"));
    try {
      execFileSync("git", ["init", "-b", "main", targetRoot]);
      execFileSync("git", ["-C", targetRoot, "config", "user.name", "review-test"]);
      execFileSync("git", ["-C", targetRoot, "config", "user.email", "review-test@example.invalid"]);
      fs.mkdirSync(path.join(targetRoot, "src"));
      fs.writeFileSync(path.join(targetRoot, "src/allowed.ts"), "export const base = true;\n");
      execFileSync("git", ["-C", targetRoot, "add", "src/allowed.ts"]);
      execFileSync("git", ["-C", targetRoot, "commit", "-m", "base"]);
      const baseSha = execFileSync("git", ["-C", targetRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

      fs.mkdirSync(path.join(targetRoot, ".github/workflows"), { recursive: true });
      fs.writeFileSync(
        path.join(targetRoot, ".github/workflows/untrusted.yml"),
        "# FinalArch:FR-AGT-005\nname: must-not-run\n",
      );
      fs.mkdirSync(path.join(targetRoot, "docs"));
      fs.writeFileSync(path.join(targetRoot, "docs/outside.md"), "outside the manifest allowlist\n");
      execFileSync("git", ["-C", targetRoot, "add", ".github/workflows/untrusted.yml", "docs/outside.md"]);
      execFileSync("git", ["-C", targetRoot, "commit", "-m", "head"]);
      const headSha = execFileSync("git", ["-C", targetRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

      const task = clone(manifest);
      task.paths.allowed = ["src/**"];
      task.paths.forbidden = [".github/**"];
      const artifact = collectReviewArtifact({
        manifest: task,
        targetRoot,
        baseSha,
        headSha,
        reviewerAgentId: task.reviewer.agent_id,
        reviewerExecutionProfile: task.reviewer.execution_profile,
      });

      assert.deepEqual(artifact.collection.changed_files, [".github/workflows/untrusted.yml", "docs/outside.md"]);
      assert.deepEqual(artifact.collection.spec_references, ["FinalArch:FR-AGT-005"]);
      assert.deepEqual(artifact.collection.security_sensitive_files, [".github/workflows/untrusted.yml"]);
      assert.deepEqual(artifact.findings, [
        {
          dimension: "security",
          severity: "critical",
          file: ".github/workflows/untrusted.yml",
          line: null,
          evidence: "Changed path matches manifest.paths.forbidden.",
          suggestion: "Restore the forbidden path or obtain an explicit task reassignment before editing it.",
        },
        {
          dimension: "spec_compliance",
          severity: "high",
          file: "docs/outside.md",
          line: null,
          evidence: "Changed path is outside manifest.paths.allowed.",
          suggestion: "Restore the path or amend the task manifest before editing it.",
        },
      ]);
      assert.doesNotThrow(() => validateReviewArtifact(artifact, task));
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
