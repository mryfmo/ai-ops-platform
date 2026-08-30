// 根拠: JIRA-GH-GOV-001 — Jira/PJ/GitHub mappingを外部I/O前にfail-closedで検証する。
import fs from "node:fs";
import { createPublicKey, verify } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOP_LEVEL_FIELDS = ["_evidence", "contract_version", "environment", "provenance", "projects"];
const PROVENANCE_FIELDS = [
  "approved_by",
  "approval_basis",
  "signature",
  "replace_before_go_live",
  "replace_before_go_live_declaration",
];
const PROJECT_FIELDS = [
  "mapping_version",
  "jira_cloud_id",
  "jira_project_id",
  "jira_project_key",
  "authorized_url",
  "github_repository",
  "allowed_status_ids",
  "protected_status_ids",
  "sprint_field_id",
];
const REQUIRED_PROJECT_FIELDS = PROJECT_FIELDS.filter((field) => field !== "sprint_field_id");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROJECT_ID = /^PJ-[0-9]+$/u;
const JIRA_PROJECT_ID = /^[1-9][0-9]{0,19}$/u;
const JIRA_PROJECT_KEY = /^[A-Z][A-Z0-9]{1,29}$/u;
const JIRA_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const SPRINT_FIELD = /^customfield_[1-9][0-9]{0,15}$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const DEV_DECLARATION =
  "This DEV-DEFAULT Jira mapping must be replaced with owner-signed real environment values before go-live.";
const PROD_DECLARATION = "Owner-signed production Jira mapping; DEV-DEFAULT values are forbidden.";

const fail = (message) => {
  throw new Error(message);
};

function assertExactObject(value, required, allowed, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${label}: expected object`);
  for (const field of required) if (!(field in value)) fail(`${label}: missing field ${field}`);
  for (const field of Object.keys(value)) if (!allowed.includes(field)) fail(`${label}: unknown field ${field}`);
}

function validateProvenance(provenance, environment) {
  assertExactObject(provenance, PROVENANCE_FIELDS, PROVENANCE_FIELDS, "provenance");
  if (typeof provenance.approved_by !== "string" || !provenance.approved_by.trim()) {
    fail("provenance.approved_by must be non-empty");
  }
  if (typeof provenance.approval_basis !== "string" || !provenance.approval_basis.trim()) {
    fail("provenance.approval_basis must be non-empty");
  }
  if (environment === "development") {
    if (
      provenance.signature !== "DEV-DEFAULT-unsigned" ||
      provenance.replace_before_go_live !== true ||
      provenance.replace_before_go_live_declaration !== DEV_DECLARATION
    ) {
      fail("development Jira mapping must require replacement before go-live");
    }
    return;
  }
  if (
    typeof provenance.signature !== "string" ||
    provenance.signature.length < 16 ||
    !BASE64.test(provenance.signature) ||
    provenance.signature === "DEV-DEFAULT-unsigned"
  ) {
    fail("production Jira mapping requires owner signature");
  }
  if (
    provenance.replace_before_go_live !== false ||
    provenance.replace_before_go_live_declaration !== PROD_DECLARATION
  ) {
    fail("production Jira mapping must contain no DEV-DEFAULT replacement gate");
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function productionSigningBytes(value) {
  const unsigned = structuredClone(value);
  delete unsigned.provenance.signature;
  return Buffer.from(JSON.stringify(canonicalize(unsigned)), "utf8");
}

function parseOwnerPublicKey(value) {
  if (typeof value !== "string" || !value.trim())
    fail("production Jira mapping requires JIRA_MAPPING_OWNER_PUBLIC_KEY");
  try {
    const trimmed = value.trim();
    const key = trimmed.includes("-----BEGIN")
      ? createPublicKey(trimmed)
      : createPublicKey({ key: Buffer.from(trimmed, "base64"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519") fail("JIRA_MAPPING_OWNER_PUBLIC_KEY must be an Ed25519 public key");
    return key;
  } catch (error) {
    if (error instanceof Error && error.message.includes("JIRA_MAPPING_OWNER_PUBLIC_KEY")) throw error;
    fail("JIRA_MAPPING_OWNER_PUBLIC_KEY is not valid PEM or base64-SPKI");
  }
}

function verifyProductionSignature(value, ownerPublicKey) {
  const key = parseOwnerPublicKey(ownerPublicKey);
  if (!verify(null, productionSigningBytes(value), key, Buffer.from(value.provenance.signature, "base64"))) {
    fail("production Jira mapping signature verification failed");
  }
}

function validateAuthorizedUrl(value, environment, projectKey) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("authorized_url must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) {
    fail("authorized_url must be HTTPS without userinfo, query, or fragment");
  }
  if (!url.pathname.includes(projectKey)) fail("authorized_url must be scoped to jira_project_key");
  if (environment === "development" && url.hostname !== "jira.invalid") {
    fail("development authorized_url must use jira.invalid");
  }
  if (environment === "production" && url.hostname.endsWith(".invalid")) {
    fail("production authorized_url must not use an invalid placeholder host");
  }
}

function assertIdArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a non-empty array`);
  const set = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !JIRA_ID.test(item)) fail(`${label} contains an invalid Jira ID`);
    if (set.has(item)) fail(`${label} contains duplicate Jira ID ${item}`);
    set.add(item);
  }
  return set;
}

export function validateJiraEnvironmentMapping(value, ownerPublicKey = process.env.JIRA_MAPPING_OWNER_PUBLIC_KEY) {
  assertExactObject(value, TOP_LEVEL_FIELDS, TOP_LEVEL_FIELDS, "mapping");
  if (value._evidence !== "JIRA-GH-GOV-001 / 2026-08-28") fail("_evidence mismatch");
  if (value.contract_version !== "1.0.0") fail("contract_version must be 1.0.0");
  if (value.environment !== "development" && value.environment !== "production") {
    fail("environment must be development or production");
  }
  validateProvenance(value.provenance, value.environment);
  if (typeof value.projects !== "object" || value.projects === null || Array.isArray(value.projects)) {
    fail("projects must be an object");
  }
  const projectIds = Object.keys(value.projects).sort();
  if (projectIds.length === 0) fail("projects must not be empty");

  const jiraProjectPairs = new Set();
  const jiraProjectKeys = new Set();
  const repositories = new Set();
  for (const projectId of projectIds) {
    if (!PROJECT_ID.test(projectId)) fail(`projects: canonical PJ-* key required: ${projectId}`);
    const project = value.projects[projectId];
    assertExactObject(project, REQUIRED_PROJECT_FIELDS, PROJECT_FIELDS, `projects.${projectId}`);
    if (!Number.isSafeInteger(project.mapping_version) || project.mapping_version < 1) {
      fail(`${projectId}: mapping_version must be a positive safe integer`);
    }
    if (!UUID.test(project.jira_cloud_id)) fail(`${projectId}: invalid jira_cloud_id`);
    if (!JIRA_PROJECT_ID.test(project.jira_project_id)) fail(`${projectId}: invalid jira_project_id`);
    if (!JIRA_PROJECT_KEY.test(project.jira_project_key)) fail(`${projectId}: invalid jira_project_key`);
    if (!REPOSITORY.test(project.github_repository)) fail(`${projectId}: invalid github_repository`);
    if (project.sprint_field_id !== undefined && !SPRINT_FIELD.test(project.sprint_field_id)) {
      fail(`${projectId}: invalid sprint_field_id`);
    }
    const allowed = assertIdArray(project.allowed_status_ids, `${projectId}.allowed_status_ids`);
    const protectedIds = assertIdArray(project.protected_status_ids, `${projectId}.protected_status_ids`);
    for (const id of protectedIds) {
      if (!allowed.has(id)) fail(`${projectId}: protected_status_ids must be a subset of allowed_status_ids`);
    }
    const pair = `${project.jira_cloud_id}:${project.jira_project_id}`;
    if (jiraProjectPairs.has(pair)) fail(`${projectId}: duplicate Jira cloud/project mapping`);
    jiraProjectPairs.add(pair);
    if (jiraProjectKeys.has(project.jira_project_key)) fail(`${projectId}: duplicate jira_project_key`);
    jiraProjectKeys.add(project.jira_project_key);
    if (repositories.has(project.github_repository)) fail(`${projectId}: duplicate github_repository mapping`);
    repositories.add(project.github_repository);
    validateAuthorizedUrl(project.authorized_url, value.environment, project.jira_project_key);
  }
  if (value.environment === "production") verifyProductionSignature(value, ownerPublicKey);

  return {
    environment: value.environment,
    projectIds,
    warning:
      value.environment === "development"
        ? "DEV-DEFAULT: replace Jira mapping before go-live with owner-signed production values."
        : null,
  };
}

function main(argv) {
  if (argv.length !== 1) fail("usage: validate-jira-environment-mapping.mjs MAPPING");
  let value;
  try {
    value = JSON.parse(fs.readFileSync(path.resolve(argv[0]), "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) fail(`invalid JSON: ${error.message}`);
    throw error;
  }
  const result = validateJiraEnvironmentMapping(value);
  if (result.warning) console.log(`WARNING: ${result.warning}`);
  console.log(`OK: validated ${result.projectIds.length} Jira project mappings.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
