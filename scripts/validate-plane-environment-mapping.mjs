// 根拠: ADR-0019 / P014-FA-T02 — Plane mapping を外部I/O前にfail-closedで検証する。
import fs from "node:fs";
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
const PROJECT_FIELDS = ["plane_workspace_id", "plane_workspace_slug", "plane_project_id", "authorized_url"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const PROJECT_ID = /^PJ-[0-9]+$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const DEV_DECLARATION =
  "This DEV-DEFAULT mapping must be replaced with owner-signed real environment values before go-live.";
const PROD_DECLARATION = "Owner-signed production mapping; DEV-DEFAULT values are forbidden.";

const fail = (message) => {
  throw new Error(message);
};

function assertExactObject(value, fields, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${label}: expected object`);
  for (const field of fields) {
    if (!(field in value)) fail(`${label}: missing field ${field}`);
  }
  for (const field of Object.keys(value)) {
    if (!fields.includes(field)) fail(`${label}: unknown field ${field}`);
  }
}

function validateProvenance(provenance, environment) {
  assertExactObject(provenance, PROVENANCE_FIELDS, "provenance");
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
      fail("development mapping must require replacement before go-live");
    }
    return;
  }

  if (
    typeof provenance.signature !== "string" ||
    provenance.signature.length < 16 ||
    !BASE64.test(provenance.signature) ||
    provenance.signature === "DEV-DEFAULT-unsigned"
  ) {
    fail("production mapping requires owner signature");
  }
  if (
    provenance.replace_before_go_live !== false ||
    provenance.replace_before_go_live_declaration !== PROD_DECLARATION
  ) {
    fail("production mapping must contain no DEV-DEFAULT replacement gate");
  }
}

function validateAuthorizedUrl(value, environment) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("authorized_url must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) {
    fail("authorized_url must be HTTPS without userinfo, query, or fragment");
  }
  if (environment === "development" && url.hostname !== "plane.invalid") {
    fail("development authorized_url must use plane.invalid");
  }
  if (environment === "production" && url.hostname.endsWith(".invalid")) {
    fail("production authorized_url must not use an invalid placeholder host");
  }
}

export function validatePlaneEnvironmentMapping(value) {
  assertExactObject(value, TOP_LEVEL_FIELDS, "mapping");
  if (value._evidence !== "ADR-0019 / P014-FA-T02") fail("_evidence mismatch");
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

  const planeProjectIds = new Set();
  const workspaceSlugs = new Map();
  for (const projectId of projectIds) {
    if (!PROJECT_ID.test(projectId)) fail(`projects: canonical PJ-* key required: ${projectId}`);
    const project = value.projects[projectId];
    assertExactObject(project, PROJECT_FIELDS, `projects.${projectId}`);
    if (!UUID.test(project.plane_workspace_id)) fail(`${projectId}: invalid plane_workspace_id`);
    if (!UUID.test(project.plane_project_id)) fail(`${projectId}: invalid plane_project_id`);
    if (!SLUG.test(project.plane_workspace_slug)) fail(`${projectId}: invalid plane_workspace_slug`);
    if (project.plane_workspace_id === project.plane_project_id) {
      fail(`${projectId}: workspace and project UUIDs must differ`);
    }
    if (planeProjectIds.has(project.plane_project_id)) {
      fail(`${projectId}: duplicate plane_project_id`);
    }
    planeProjectIds.add(project.plane_project_id);

    const knownSlug = workspaceSlugs.get(project.plane_workspace_id);
    if (knownSlug && knownSlug !== project.plane_workspace_slug) {
      fail(`${projectId}: workspace UUID maps to multiple slugs`);
    }
    workspaceSlugs.set(project.plane_workspace_id, project.plane_workspace_slug);
    validateAuthorizedUrl(project.authorized_url, value.environment);
  }

  return {
    environment: value.environment,
    projectIds,
    warning:
      value.environment === "development"
        ? "DEV-DEFAULT: replace before go-live with owner-signed production values."
        : null,
  };
}

function main(argv) {
  if (argv.length !== 1) fail("usage: validate-plane-environment-mapping.mjs MAPPING");
  let value;
  try {
    value = JSON.parse(fs.readFileSync(path.resolve(argv[0]), "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) fail(`invalid JSON: ${error.message}`);
    throw error;
  }
  const result = validatePlaneEnvironmentMapping(value);
  if (result.warning) console.log(`WARNING: ${result.warning}`);
  console.log(`OK: validated ${result.projectIds.length} Plane project mappings.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
