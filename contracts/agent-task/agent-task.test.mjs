// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-003 / ADR-0027 / WBS P8-T01
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { assertOneWriter, findWriterOverlaps, validateAgentTaskManifest } from "./manifest-validator.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(directory, "fixtures/valid.manifest.json"), "utf8"));
const clone = () => structuredClone(fixture);

function peerManifest() {
  const peer = clone();
  peer.task_id = "P8-T02";
  peer.writer.agent_id = "claude-writer";
  peer.delivery.branch = "agent/P8-T02-path-guard";
  return peer;
}

describe("agent task manifest contract [FinalArch:FR-AGT-001..006]", () => {
  it("accepts a bounded, PR-only, callback-complete manifest", () => {
    assert.doesNotThrow(() => validateAgentTaskManifest(clone()));
  });

  it("rejects writer==reviewer, unknown roles, and malformed profile labels", () => {
    const sameAgent = clone();
    sameAgent.reviewer.agent_id = sameAgent.writer.agent_id;
    assert.throws(() => validateAgentTaskManifest(sameAgent), /writer and reviewer must differ/u);

    const unknownRole = clone();
    unknownRole.writer.role = "approver";
    assert.throws(() => validateAgentTaskManifest(unknownRole), /invalid Draft 2020-12 schema or fixture/u);

    const swappedRole = clone();
    swappedRole.writer.role = "reviewer";
    assert.throws(() => validateAgentTaskManifest(swappedRole), /roles do not match/u);

    const malformedProfile = clone();
    malformedProfile.writer.execution_profile = "GPT-5.6 Sol high";
    assert.throws(() => validateAgentTaskManifest(malformedProfile), /invalid Draft 2020-12 schema or fixture/u);
  });

  it("rejects overlapping allowed/forbidden scopes and malformed path globs", () => {
    const overlap = clone();
    overlap.paths.forbidden = ["contracts/agent-task/fixtures/**"];
    assert.throws(() => validateAgentTaskManifest(overlap), /allowed and forbidden paths overlap/u);

    for (const invalid of ["/contracts/**", "../contracts/**", "contracts/**/schema.json", "contracts\\schema.json"]) {
      const manifest = clone();
      manifest.paths.allowed = [invalid];
      assert.throws(() => validateAgentTaskManifest(manifest), /invalid Draft 2020-12 schema or fixture/u);
    }
  });

  it("rejects missing and non-positive budget limits", () => {
    const missing = clone();
    delete missing.budget.max_tool_calls;
    assert.throws(() => validateAgentTaskManifest(missing), /invalid Draft 2020-12 schema or fixture/u);

    for (const field of ["max_runtime_seconds", "max_cost_usd", "max_tokens", "max_tool_calls"]) {
      const manifest = clone();
      manifest.budget[field] = 0;
      assert.throws(() => validateAgentTaskManifest(manifest), /invalid Draft 2020-12 schema or fixture/u);
    }
  });

  it("rejects a branch for another task and incomplete callback evidence", () => {
    const wrongBranch = clone();
    wrongBranch.delivery.branch = "agent/P8-T99-unrelated";
    assert.throws(() => validateAgentTaskManifest(wrongBranch), /branch must belong to task/u);

    const malformedBranch = clone();
    malformedBranch.delivery.branch = "main";
    assert.throws(() => validateAgentTaskManifest(malformedBranch), /invalid Draft 2020-12 schema or fixture/u);

    const incomplete = clone();
    incomplete.callback.required_fields.pop();
    assert.throws(() => validateAgentTaskManifest(incomplete), /invalid Draft 2020-12 schema or fixture/u);
  });

  it("rejects unpinned runners and master/provider key or production-network access", () => {
    const unpinned = clone();
    unpinned.runner.cli[0].pin = "latest";
    assert.throws(() => validateAgentTaskManifest(unpinned), /invalid Draft 2020-12 schema or fixture/u);

    for (const field of ["master_key", "provider_keys"]) {
      const manifest = clone();
      manifest.runner.credential[field] = true;
      assert.throws(() => validateAgentTaskManifest(manifest), /invalid Draft 2020-12 schema or fixture/u);
    }

    const network = clone();
    network.runner.direct_production_network = true;
    assert.throws(() => validateAgentTaskManifest(network), /invalid Draft 2020-12 schema or fixture/u);
  });
});

describe("One Writer overlap gate [FinalArch:COD-003]", () => {
  it("rejects concurrent writers whose allowed path scopes intersect", () => {
    const peer = peerManifest();
    peer.paths.allowed = ["contracts/agent-task/fixtures/**"];
    assert.deepEqual(findWriterOverlaps([fixture, peer]), [
      {
        kind: "path",
        leftTaskId: "P8-T01",
        rightTaskId: "P8-T02",
        leftPath: "contracts/agent-task/**",
        rightPath: "contracts/agent-task/fixtures/**",
      },
    ]);
    assert.throws(() => assertOneWriter([fixture, peer]), /One Writer conflict/u);
  });

  it("rejects duplicate task or branch claims even when paths are disjoint", () => {
    const sameTask = clone();
    sameTask.writer.agent_id = "claude-writer";
    sameTask.paths.allowed = ["packages/server/src/taskManifest.ts"];
    assert.deepEqual(
      findWriterOverlaps([fixture, sameTask]).map(({ kind }) => kind),
      ["task", "branch"],
    );
    assert.throws(() => assertOneWriter([fixture, sameTask]), /One Writer conflict/u);
  });

  it("accepts pairwise-disjoint concurrent assignments", () => {
    const peer = peerManifest();
    peer.paths.allowed = ["packages/server/src/taskManifest.ts"];
    assert.deepEqual(findWriterOverlaps([fixture, peer]), []);
    assert.doesNotThrow(() => assertOneWriter([fixture, peer]));
  });
});
