// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-006 / ADR-0027 / WBS P8-T06
import fs from "node:fs";

import { validateAgentTaskManifest } from "../agent-task/manifest-validator.mjs";
import { defaultRepoRoot, validateJsonSchemaDocument } from "../check-contracts.mjs";

const schema = JSON.parse(fs.readFileSync(new URL("./review-artifact.schema.json", import.meta.url), "utf8"));

export function validateReviewArtifact(artifact, manifest, repoRoot = defaultRepoRoot) {
  validateAgentTaskManifest(manifest, repoRoot);
  validateJsonSchemaDocument(schema, artifact, repoRoot);

  if (artifact.task_id !== manifest.task_id) throw new TypeError("review task_id does not match manifest");
  if (artifact.reviewer.agent_id !== manifest.reviewer.agent_id) {
    throw new TypeError("reviewer agent_id does not match manifest");
  }
  if (artifact.reviewer.execution_profile !== manifest.reviewer.execution_profile) {
    throw new TypeError("reviewer execution_profile does not match manifest");
  }
  if (JSON.stringify(artifact.reviewed_dimensions) !== JSON.stringify(manifest.review.dimensions)) {
    throw new TypeError("review dimensions do not match manifest");
  }
  if (artifact.source.base_sha === artifact.source.head_sha) throw new TypeError("review source must contain a diff");

  const changed = new Set(artifact.collection.changed_files);
  for (const file of artifact.collection.security_sensitive_files) {
    if (!changed.has(file)) throw new TypeError(`security path was not changed: ${file}`);
  }
  for (const finding of artifact.findings) {
    if (!changed.has(finding.file)) throw new TypeError(`finding file was not changed: ${finding.file}`);
  }
  return artifact;
}
