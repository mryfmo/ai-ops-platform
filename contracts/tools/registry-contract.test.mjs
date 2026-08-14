// 根拠: FinalArch:MCP-001 / FinalArch:MCP-004 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T02
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import YAML from "yaml";

import { defaultRepoRoot, loadDocument, validateJsonSchemaDocument } from "../check-contracts.mjs";

const tools = path.join(defaultRepoRoot, "contracts/tools");
const generator = path.join(tools, "generate-agentgateway.mjs");
const tsx = path.join(defaultRepoRoot, "node_modules/.bin/tsx");
const schema = loadDocument(defaultRepoRoot, "contracts/tools/mcp-registry.schema.yaml");
const registry = loadDocument(defaultRepoRoot, "contracts/tools/mcp-registry.yaml");
const ledger = loadDocument(defaultRepoRoot, "contracts/tools/tool-risk.yaml");
const approvedHash = fs
  .readFileSync(path.join(tools, "mcp-registry.schema.sha256"), "utf8")
  .split(/\r?\n/u)
  .find((line) => /^[0-9a-f]{64}$/u.test(line));

function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalized(value[key])]),
    );
  }
  return value;
}

function schemaHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(normalized(value)))
    .digest("hex");
}

function runGenerator(args) {
  return spawnSync(tsx, [generator, ...args], { cwd: defaultRepoRoot, encoding: "utf8" });
}

describe("MCP registry contract gate [FinalArch:MCP-001][FinalArch:MCP-004]", () => {
  it("pins the normalized schema hash and validates the disabled canonical registry [FinalArch:MCP-001]", () => {
    assert.equal(schemaHash(schema), approvedHash);
    assert.equal(registry.schema_hash, approvedHash);
    validateJsonSchemaDocument(schema, registry);
    assert(registry.entries.length > 0);
    assert(registry.entries.every((entry) => entry.enabled === false && !("endpoint" in entry)));
  });

  it("rejects unapproved schema drift and enabled entries without endpoints [FinalArch:MCP-001]", () => {
    const driftedSchema = structuredClone(schema);
    driftedSchema.properties.entries.maxItems = 5;
    assert.notEqual(schemaHash(driftedSchema), approvedHash);

    const missingEndpoint = structuredClone(registry);
    missingEndpoint.entries[0].enabled = true;
    assert.throws(() => validateJsonSchemaDocument(schema, missingEndpoint), /schema or fixture/u);
  });

  it("matches the governed config and the enabled-mixed golden output byte-for-byte [FinalArch:MCP-001]", () => {
    const canonical = runGenerator(["--check"]);
    assert.equal(canonical.status, 0, canonical.stderr);
    assert.match(canonical.stdout, /REGISTRY CONFIG PASS: enabled=0/u);

    const generated = runGenerator([
      "--print-sections",
      "--registry",
      path.join(tools, "fixtures/enabled-mixed.registry.yaml"),
      "--schema-hash",
      path.join(tools, "fixtures/test-schema.sha256"),
    ]);
    assert.equal(generated.status, 0, generated.stderr);
    assert.equal(generated.stdout, fs.readFileSync(path.join(tools, "fixtures/enabled-mixed.generated.yaml"), "utf8"));
  });

  it("rejects hand-edited generated config and high-risk registry operations [FinalArch:MCP-004]", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiops-mcp-registry-"));
    try {
      const configPath = path.join(directory, "config.yaml");
      const config = fs.readFileSync(path.join(defaultRepoRoot, "deploy/agentgateway/config.yaml"), "utf8");
      const handEditedSource = config.replace('        - "false"', '        - "true"');
      fs.writeFileSync(configPath, handEditedSource);
      const handEdited = runGenerator(["--check", "--config", configPath]);
      assert.notEqual(handEdited.status, 0);
      assert.match(handEdited.stderr, /generated MCP targets\/rules drift/u);

      const highRiskRegistry = structuredClone(registry);
      highRiskRegistry.entries[0].operations = ["merge_pull_request"];
      highRiskRegistry.entries[0].risk = "L1";
      const weakenedLedger = structuredClone(ledger);
      weakenedLedger.operations.merge_pull_request = "L1";
      fs.writeFileSync(path.join(directory, "registry.yaml"), YAML.stringify(highRiskRegistry));
      fs.writeFileSync(path.join(directory, "tool-risk.yaml"), YAML.stringify(weakenedLedger));
      const highRisk = runGenerator([
        "--check",
        "--registry",
        path.join(directory, "registry.yaml"),
        "--ledger",
        path.join(directory, "tool-risk.yaml"),
      ]);
      assert.notEqual(highRisk.status, 0);
      assert.match(highRisk.stderr, /high-risk operation/u);
    } finally {
      fs.rmSync(directory, { recursive: true });
    }
  });
});
