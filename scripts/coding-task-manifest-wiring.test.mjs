// 根拠: FinalArch:COD-001 / FinalArch:COD-004 / FinalArch:COD-006 / ADV-FIX-04
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coding = fs.readFileSync(path.join(root, ".github/workflows/coding-task.yml"), "utf8");
const review = fs.readFileSync(path.join(root, ".github/workflows/coding-task-review.yml"), "utf8");

function position(source, text) {
  const index = source.indexOf(text);
  assert.notEqual(index, -1, `missing workflow fragment: ${text}`);
  return index;
}

function bindingProgram() {
  const marker = "node --input-type=module -";
  const start = coding.indexOf("<<'NODE'\n", position(coding, marker));
  const end = coding.indexOf("\n          NODE", start);
  assert.notEqual(start, -1, "missing manifest validator heredoc start");
  assert.notEqual(end, -1, "missing manifest validator heredoc end");
  return coding.slice(start + "<<'NODE'\n".length, end).replace(/^ {10}/gmu, "");
}

function issueManifest(taskId, agent) {
  const issuer = pathToFileURL(path.join(root, "packages/server/src/lib/codingTaskManifest.ts")).href;
  const source = `import { issueCodingTaskManifest } from ${JSON.stringify(issuer)}; process.stdout.write(issueCodingTaskManifest(${JSON.stringify({ taskId, agent })}).manifest);`;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", source], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function runBinding(manifest, taskId, agent) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiops-manifest-binding-"));
  try {
    const manifestPath = path.join(directory, "manifest.json");
    fs.writeFileSync(manifestPath, manifest);
    return spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-",
        manifestPath,
        path.join(root, "contracts/agent-task/manifest-validator.mjs"),
        taskId,
        agent,
      ],
      { input: bindingProgram(), encoding: "utf8" },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe("coding task manifest workflow wiring (ADV-FIX-04)", () => {
  it("materializes and checks authority before credentials, then runs post guard before commit/push credentials", () => {
    assert.match(coding, /manifest_base64:[\s\S]*?required: true/u);
    assert.match(coding, /manifest_sha256:[\s\S]*?required: true/u);
    assert.match(coding, /ref: \$\{\{ github\.sha \}\}/u);
    assert.match(coding, /actual_digest[\s\S]*?TRUSTED_DIGEST/u);
    const materialize = position(coding, "Materialize and validate task manifest authority");
    const pre = position(coding, "Record pre-agent path boundary");
    const credential = position(coding, "Issue job-scoped LiteLLM credential");
    const agent = position(coding, "Run coding agent (ADR-0006 composite action)");
    const post = position(coding, "Verify post-agent path boundary");
    const commit = position(coding, "Commit changes (no token in scope)");
    const pushCredential = position(coding, "Issue repository-scoped GitHub credential");
    assert.ok(materialize < pre && pre < credential && credential < agent && agent < post && post < commit);
    assert.ok(post < pushCredential);
  });

  it("binds the server-issued manifest to exact dispatch branch, task_id, and agent", () => {
    const taskId = "11111111-1111-4111-8111-111111111111";
    const otherTaskId = "22222222-2222-4222-8222-222222222222";
    const manifest = issueManifest(taskId, "claude-code");
    assert.equal(runBinding(manifest, taskId, "claude-code").status, 0);

    const branchSubstitution = JSON.parse(manifest);
    branchSubstitution.delivery.branch = `agent/${taskId}-caller-selected`;
    assert.match(
      runBinding(`${JSON.stringify(branchSubstitution)}\n`, taskId, "claude-code").stderr,
      /delivery branch/u,
    );

    assert.match(runBinding(issueManifest(otherTaskId, "claude-code"), taskId, "claude-code").stderr, /task_id/u);
    assert.match(runBinding(issueManifest(taskId, "droid"), taskId, "claude-code").stderr, /writer agent_id/u);
  });

  it("binds review collection to a required digest and always uploads findings", () => {
    assert.match(review, /manifest_digest:[\s\S]*?required: true/u);
    assert.match(review, /--manifest-digest\s+"\$MANIFEST_DIGEST"/u);
    const upload = review.slice(position(review, "Upload structured findings"));
    assert.match(upload, /if: \$\{\{ always\(\) \}\}/u);
  });
});
