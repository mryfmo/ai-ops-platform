// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-003 / ADR-0027 / WBS P8-T01
import fs from "node:fs";

import { defaultRepoRoot, validateJsonSchemaDocument } from "./json-schema-validator.mjs";

const schema = JSON.parse(fs.readFileSync(new URL("./agent-task.schema.json", import.meta.url), "utf8"));

function parsedScope(scope) {
  return scope.endsWith("/**") ? { base: scope.slice(0, -3), subtree: true } : { base: scope, subtree: false };
}

function contains(base, candidate) {
  return candidate === base || candidate.startsWith(`${base}/`);
}

export function pathScopesOverlap(left, right) {
  const a = parsedScope(left);
  const b = parsedScope(right);
  if (!a.subtree && !b.subtree) return a.base === b.base;
  return (a.subtree && contains(a.base, b.base)) || (b.subtree && contains(b.base, a.base));
}

export function validateAgentTaskManifest(manifest, repoRoot = defaultRepoRoot) {
  validateJsonSchemaDocument(schema, manifest, repoRoot);
  const { writer, reviewer } = manifest;
  if (writer.role !== "writer" || reviewer.role !== "reviewer") {
    throw new TypeError("assignment roles do not match their manifest slots");
  }
  if (writer.agent_id === reviewer.agent_id) throw new TypeError("writer and reviewer must differ");

  for (const allowed of manifest.paths.allowed) {
    for (const forbidden of manifest.paths.forbidden) {
      if (pathScopesOverlap(allowed, forbidden)) {
        throw new TypeError(`allowed and forbidden paths overlap: ${allowed} <> ${forbidden}`);
      }
    }
  }

  const taskBranch = `agent/${manifest.task_id}`;
  if (manifest.delivery.branch !== taskBranch && !manifest.delivery.branch.startsWith(`${taskBranch}-`)) {
    throw new TypeError("branch must belong to task");
  }
  return manifest;
}

export function findWriterOverlaps(manifests) {
  const conflicts = [];
  for (let leftIndex = 0; leftIndex < manifests.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < manifests.length; rightIndex += 1) {
      const left = manifests[leftIndex];
      const right = manifests[rightIndex];
      const base = { leftTaskId: left.task_id, rightTaskId: right.task_id };
      if (left.task_id === right.task_id) conflicts.push({ kind: "task", ...base });
      if (left.delivery.branch === right.delivery.branch) conflicts.push({ kind: "branch", ...base });
      for (const leftPath of left.paths.allowed) {
        for (const rightPath of right.paths.allowed) {
          if (pathScopesOverlap(leftPath, rightPath)) {
            conflicts.push({ kind: "path", ...base, leftPath, rightPath });
          }
        }
      }
    }
  }
  return conflicts;
}

export function assertOneWriter(manifests, repoRoot = defaultRepoRoot) {
  manifests.forEach((manifest) => validateAgentTaskManifest(manifest, repoRoot));
  const conflicts = findWriterOverlaps(manifests);
  if (conflicts.length > 0) throw new TypeError(`One Writer conflict: ${JSON.stringify(conflicts)}`);
}
