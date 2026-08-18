// 根拠: FinalArch:COD-001 / FinalArch:COD-004 / FinalArch:COD-006 / ADV-FIX-04
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coding = fs.readFileSync(path.join(root, ".github/workflows/coding-task.yml"), "utf8");
const review = fs.readFileSync(path.join(root, ".github/workflows/coding-task-review.yml"), "utf8");

function position(source, text) {
  const index = source.indexOf(text);
  assert.notEqual(index, -1, `missing workflow fragment: ${text}`);
  return index;
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

  it("binds review collection to a required digest and always uploads findings", () => {
    assert.match(review, /manifest_digest:[\s\S]*?required: true/u);
    assert.match(review, /--manifest-digest\s+"\$MANIFEST_DIGEST"/u);
    const upload = review.slice(position(review, "Upload structured findings"));
    assert.match(upload, /if: \$\{\{ always\(\) \}\}/u);
  });
});
