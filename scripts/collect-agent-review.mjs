// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-006 / ADR-0027 / WBS P8-T06
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pathScopesOverlap } from "../contracts/agent-task/manifest-validator.mjs";
import { validateReviewArtifact, validateReviewFailureArtifact } from "../contracts/agent-review/review-validator.mjs";

const SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const RELATIVE_PATH =
  /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\\)(?!.*\/\/)[A-Za-z0-9._@()+{}[\]-]+(?:\/[A-Za-z0-9._@()+{}[\]-]+)*$/u;
const SPEC_REFERENCE = /\b(?:FinalArch:)?(?:PRD|FR|COD|ADR|REQ|SPEC(?:-INT|-EXT)?|TH|AC)-[A-Z0-9.-]+\b/gu;
const SECURITY_PATH =
  /(?:^\.github\/|^contracts\/|^deploy\/|(?:^|\/)(?:auth|credential|permission|policy|secret|security|workflow)[A-Za-z0-9._-]*\b)/iu;

function git(targetRoot, args, encoding = "utf8") {
  return execFileSync("git", ["-C", targetRoot, ...args], {
    encoding,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
}

function assertSha(value, label) {
  if (!SHA.test(value)) throw new TypeError(`${label} must be a full lowercase commit SHA`);
}

function matchingScope(scopes, file) {
  return scopes.some((scope) => pathScopesOverlap(scope, file));
}

export function collectReviewArtifact({
  manifest,
  targetRoot,
  baseSha,
  headSha,
  reviewerAgentId,
  reviewerExecutionProfile,
}) {
  assertSha(baseSha, "baseSha");
  assertSha(headSha, "headSha");
  const range = `${baseSha}...${headSha}`;
  const changedFiles = git(
    targetRoot,
    ["diff", "--name-only", "--diff-filter=ACDMRTUXB", "--no-ext-diff", "--no-textconv", "-z", range],
    "buffer",
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  if (changedFiles.some((file) => !RELATIVE_PATH.test(file))) throw new TypeError("diff contains an unsafe path");

  const patch = git(targetRoot, ["diff", "--unified=0", "--no-ext-diff", "--no-textconv", range]);
  const specReferences = [...new Set(patch.match(SPEC_REFERENCE) ?? [])].sort();
  const securitySensitiveFiles = changedFiles.filter((file) => SECURITY_PATH.test(file));
  const findings = [];
  for (const file of changedFiles) {
    if (matchingScope(manifest.paths.forbidden, file)) {
      findings.push({
        dimension: "security",
        severity: "critical",
        file,
        line: null,
        evidence: "Changed path matches manifest.paths.forbidden.",
        suggestion: "Restore the forbidden path or obtain an explicit task reassignment before editing it.",
      });
    } else if (!matchingScope(manifest.paths.allowed, file)) {
      findings.push({
        dimension: "spec_compliance",
        severity: "high",
        file,
        line: null,
        evidence: "Changed path is outside manifest.paths.allowed.",
        suggestion: "Restore the path or amend the task manifest before editing it.",
      });
    }
  }

  const artifact = {
    schema_version: "1.0",
    task_id: manifest.task_id,
    reviewer: { agent_id: reviewerAgentId, execution_profile: reviewerExecutionProfile },
    source: { base_sha: baseSha, head_sha: headSha },
    reviewed_dimensions: [...manifest.review.dimensions],
    collection: {
      changed_files: changedFiles,
      spec_references: specReferences,
      security_sensitive_files: securitySensitiveFiles,
    },
    findings,
  };
  return validateReviewArtifact(artifact, manifest);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new TypeError("arguments must be --name value pairs");
    options[key.slice(2)] = value;
  }
  const required = ["target", "manifest", "manifest-digest", "base", "head", "reviewer", "profile", "output"];
  if (Object.keys(options).sort().join() !== required.sort().join())
    throw new TypeError("unexpected or missing argument");
  return options;
}

function containedPath(root, relativePath) {
  if (!RELATIVE_PATH.test(relativePath)) throw new TypeError("manifest must be a safe repository-relative path");
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, relativePath);
  if (!resolved.startsWith(`${absoluteRoot}${path.sep}`)) throw new TypeError("manifest escapes review target");
  return resolved;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetRoot = path.resolve(options.target);
  const manifestRaw = fs.readFileSync(containedPath(targetRoot, options.manifest));
  const actualDigest = createHash("sha256").update(manifestRaw).digest("hex");
  if (!SHA256.test(options["manifest-digest"]) || options["manifest-digest"] !== actualDigest) {
    const failure = {
      schema_version: "failure-1.0",
      status: "failed",
      source: { base_sha: options.base, head_sha: options.head },
      findings: [
        {
          dimension: "security",
          severity: "critical",
          file: options.manifest,
          line: null,
          evidence: "Authoritative manifest digest is missing or does not match the review-target raw bytes.",
          suggestion: "Stop review and dispatch the immutable coding_tasks.manifest_sha256 authority.",
        },
      ],
    };
    fs.writeFileSync(options.output, `${JSON.stringify(validateReviewFailureArtifact(failure), null, 2)}\n`, {
      flag: "wx",
    });
    throw new TypeError("manifest digest is missing or mismatched");
  }
  const manifest = JSON.parse(manifestRaw.toString("utf8"));
  const artifact = collectReviewArtifact({
    manifest,
    targetRoot,
    baseSha: options.base,
    headSha: options.head,
    reviewerAgentId: options.reviewer,
    reviewerExecutionProfile: options.profile,
  });
  fs.writeFileSync(options.output, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx" });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
