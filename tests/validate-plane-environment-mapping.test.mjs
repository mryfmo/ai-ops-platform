// 根拠: ADR-0019 / P014-FA-T02 — Plane mapping の認可境界と go-live gate を否定試験する。
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validatePlaneEnvironmentMapping } from "../scripts/validate-plane-environment-mapping.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repoRoot, "docs/contracts/fixtures/plane-environment-mapping.dev.json");

function fixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function productionFixture() {
  const value = fixture();
  value.environment = "production";
  value.provenance = {
    approved_by: "mryfmo",
    approval_basis: "ADR-0019 owner approval 2026-07-19",
    signature: "b3duZXItc2lnbmVkLXBsYW5lLW1hcHBpbmc=",
    replace_before_go_live: false,
    replace_before_go_live_declaration: "Owner-signed production mapping; DEV-DEFAULT values are forbidden.",
  };
  for (const project of Object.values(value.projects)) {
    project.authorized_url = project.authorized_url.replace("plane.invalid", "plane.example.com");
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function runCli(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plane-mapping-"));
  const inputPath = path.join(root, "mapping.json");
  try {
    fs.writeFileSync(inputPath, content);
    return spawnSync(process.execPath, ["scripts/validate-plane-environment-mapping.mjs", inputPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("ADR-0019 P014-FA-T02 accepts the tracked development mapping with an explicit replacement warning", () => {
  const result = validatePlaneEnvironmentMapping(fixture());
  assert.deepEqual(result.projectIds, ["PJ-001", "PJ-002", "PJ-404"]);
  assert.match(result.warning, /replace before go-live/i);

  const cli = runCli(fs.readFileSync(fixturePath));
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /WARNING:.*replace before go-live/i);
  assert.match(cli.stdout, /validated 3 Plane project mappings/);
});

test("ADR-0019 P014-FA-T02 accepts an owner-signed production mapping without DEV defaults", () => {
  const result = validatePlaneEnvironmentMapping(productionFixture());
  assert.equal(result.environment, "production");
  assert.equal(result.warning, null);
});

test("ADR-0019 P014-FA-T02 rejects malformed JSON and unknown properties", () => {
  const malformed = runCli("{");
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /invalid JSON/);

  for (const mutate of [
    (value) => (value.unknown = true),
    (value) => (value.provenance.unknown = true),
    (value) => (value.projects["PJ-001"].unknown = true),
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => validatePlaneEnvironmentMapping(value), /unknown field/);
  }
});

test("ADR-0019 P014-FA-T02 rejects duplicate and cross-project Plane UUID mappings", () => {
  const duplicateProject = fixture();
  duplicateProject.projects["PJ-002"].plane_project_id = duplicateProject.projects["PJ-001"].plane_project_id;
  assert.throws(() => validatePlaneEnvironmentMapping(duplicateProject), /duplicate plane_project_id/);

  const duplicateWithinRow = fixture();
  duplicateWithinRow.projects["PJ-001"].plane_project_id = duplicateWithinRow.projects["PJ-001"].plane_workspace_id;
  assert.throws(() => validatePlaneEnvironmentMapping(duplicateWithinRow), /workspace and project UUIDs must differ/);

  const crossProjectWorkspace = fixture();
  crossProjectWorkspace.projects["PJ-002"].plane_workspace_id =
    crossProjectWorkspace.projects["PJ-001"].plane_workspace_id;
  crossProjectWorkspace.projects["PJ-002"].plane_workspace_slug = "foreign-workspace";
  assert.throws(() => validatePlaneEnvironmentMapping(crossProjectWorkspace), /workspace UUID maps to multiple slugs/);
});

test("ADR-0019 P014-FA-T02 rejects unsafe URLs and noncanonical project identities", () => {
  for (const url of [
    "http://plane.invalid/dev-workspace/projects/00000000-0000-4000-8000-000000000001",
    "https://user:password@plane.invalid/dev-workspace",
  ]) {
    const value = fixture();
    value.projects["PJ-001"].authorized_url = url;
    assert.throws(() => validatePlaneEnvironmentMapping(value), /authorized_url/);
  }

  const noncanonical = fixture();
  noncanonical.projects["pj-001"] = noncanonical.projects["PJ-001"];
  delete noncanonical.projects["PJ-001"];
  assert.throws(() => validatePlaneEnvironmentMapping(noncanonical), /canonical PJ-\* key/);
});

test("ADR-0019 P014-FA-T02 rejects stale versions and incomplete go-live replacement", () => {
  const stale = fixture();
  stale.contract_version = "0.9.0";
  assert.throws(() => validatePlaneEnvironmentMapping(stale), /contract_version/);

  const unsafeDevelopment = fixture();
  unsafeDevelopment.provenance.replace_before_go_live = false;
  assert.throws(
    () => validatePlaneEnvironmentMapping(unsafeDevelopment),
    /development mapping must require replacement/,
  );

  const unsignedProduction = productionFixture();
  unsignedProduction.provenance.signature = "DEV-DEFAULT-unsigned";
  assert.throws(
    () => validatePlaneEnvironmentMapping(unsignedProduction),
    /production mapping requires owner signature/,
  );

  const devHostInProduction = productionFixture();
  devHostInProduction.projects["PJ-001"].authorized_url = fixture().projects["PJ-001"].authorized_url;
  assert.throws(() => validatePlaneEnvironmentMapping(devHostInProduction), /production authorized_url/);
});
