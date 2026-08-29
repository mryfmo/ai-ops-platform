import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateJiraEnvironmentMapping } from "../scripts/validate-jira-environment-mapping.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repoRoot, "docs/contracts/fixtures/jira-environment-mapping.dev.json");
const fixture = () => JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function productionFixture() {
  const value = fixture();
  value.environment = "production";
  value.provenance = {
    approved_by: "mryfmo",
    approval_basis: "JIRA-GH-GOV-001 owner approval",
    signature: "b3duZXItc2lnbmVkLWppcmEtbWFwcGluZw==",
    replace_before_go_live: false,
    replace_before_go_live_declaration: "Owner-signed production Jira mapping; DEV-DEFAULT values are forbidden.",
  };
  for (const project of Object.values(value.projects)) {
    project.authorized_url = project.authorized_url.replace("jira.invalid", "company.atlassian.net");
  }
  return value;
}

function runCli(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jira-mapping-"));
  const inputPath = path.join(root, "mapping.json");
  try {
    fs.writeFileSync(inputPath, content);
    return spawnSync(process.execPath, ["scripts/validate-jira-environment-mapping.mjs", inputPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("accepts tracked development mapping and emits go-live replacement warning", () => {
  const result = validateJiraEnvironmentMapping(fixture());
  assert.deepEqual(result.projectIds, ["PJ-001", "PJ-002"]);
  assert.match(result.warning, /replace Jira mapping before go-live/i);
  const cli = runCli(fs.readFileSync(fixturePath));
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /validated 2 Jira project mappings/);
});

test("accepts owner-signed production mapping", () => {
  const result = validateJiraEnvironmentMapping(productionFixture());
  assert.equal(result.environment, "production");
  assert.equal(result.warning, null);
});

test("rejects unknown fields, malformed JSON, and noncanonical PJ keys", () => {
  assert.equal(runCli("{").status, 1);
  const unknown = fixture();
  unknown.projects["PJ-001"].unexpected = true;
  assert.throws(() => validateJiraEnvironmentMapping(unknown), /unknown field/);
  const badKey = fixture();
  badKey.projects["pj-001"] = badKey.projects["PJ-001"];
  delete badKey.projects["PJ-001"];
  assert.throws(() => validateJiraEnvironmentMapping(badKey), /canonical PJ-\* key/);
});

test("rejects duplicate Jira or GitHub mappings", () => {
  const duplicateProject = fixture();
  duplicateProject.projects["PJ-002"].jira_project_id = duplicateProject.projects["PJ-001"].jira_project_id;
  assert.throws(() => validateJiraEnvironmentMapping(duplicateProject), /duplicate Jira cloud\/project/);
  const duplicateRepo = fixture();
  duplicateRepo.projects["PJ-002"].github_repository = duplicateRepo.projects["PJ-001"].github_repository;
  assert.throws(() => validateJiraEnvironmentMapping(duplicateRepo), /duplicate github_repository/);
});

test("rejects unknown/protected statuses and unsafe URLs", () => {
  const unknownProtected = fixture();
  unknownProtected.projects["PJ-001"].protected_status_ids = ["99999"];
  assert.throws(() => validateJiraEnvironmentMapping(unknownProtected), /subset/);
  const duplicateStatus = fixture();
  duplicateStatus.projects["PJ-001"].allowed_status_ids.push("10000");
  assert.throws(() => validateJiraEnvironmentMapping(duplicateStatus), /duplicate Jira ID/);
  const httpUrl = fixture();
  httpUrl.projects["PJ-001"].authorized_url = "http://jira.invalid/projects/AICOE";
  assert.throws(() => validateJiraEnvironmentMapping(httpUrl), /authorized_url/);
});

test("rejects stale versions and incomplete production replacement", () => {
  const stale = fixture();
  stale.contract_version = "0.9.0";
  assert.throws(() => validateJiraEnvironmentMapping(stale), /contract_version/);
  const unsigned = productionFixture();
  unsigned.provenance.signature = "DEV-DEFAULT-unsigned";
  assert.throws(() => validateJiraEnvironmentMapping(unsigned), /requires owner signature/);
  const invalidHost = productionFixture();
  invalidHost.projects["PJ-001"].authorized_url = fixture().projects["PJ-001"].authorized_url;
  assert.throws(() => validateJiraEnvironmentMapping(invalidHost), /production authorized_url/);
});
