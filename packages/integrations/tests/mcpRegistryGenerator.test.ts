// 根拠: FinalArch:MCP-001 / FinalArch:MCP-004 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T02
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { generateGatewaySections, renderGatewayConfig, renderGatewaySections } from "../src/mcp/registryGenerator.js";

const schemaHash = "a".repeat(64);
const emptyRegistry = { schema_version: "1.0", schema_hash: schemaHash, entries: [] };
const riskLedger = {
  schema_version: "1.0",
  levels: Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [`L${index}`, { description: `level ${index}`, default: "deny" }]),
  ),
  operations: { ask: "L1", draft: "L2", get_schema: "L1", inspect_checks: "L1", read: "L1", search: "L1" },
  forbidden_operation_tokens: ["merge", "deploy", "delete", "permission"],
};

const loadYaml = (relativePath: string): unknown =>
  YAML.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"), { uniqueKeys: true });

describe("MCP registry generator [FinalArch:MCP-001][FinalArch:MCP-004]", () => {
  it("renders an empty registry as the byte-stable deny-all sentinel [FinalArch:MCP-001]", () => {
    const sections = generateGatewaySections(emptyRegistry, riskLedger, schemaHash);
    expect(sections).toEqual({ rules: ["false"], targets: [] });
    expect(generateGatewaySections(emptyRegistry, riskLedger, schemaHash)).toEqual(sections);
  });

  it("maps enabled endpoints and caller-scoped operations to the golden output [FinalArch:MCP-001]", () => {
    const registry = loadYaml("../../../contracts/tools/fixtures/enabled-mixed.registry.yaml");
    const expected = readFileSync(
      new URL("../../../contracts/tools/fixtures/enabled-mixed.generated.yaml", import.meta.url),
      "utf8",
    );

    expect(renderGatewaySections(generateGatewaySections(registry, riskLedger, schemaHash))).toBe(expected);
  });

  it("keeps the all-disabled canonical registry byte-identical to the governed config [FinalArch:MCP-001]", () => {
    const registry = loadYaml("../../../contracts/tools/mcp-registry.yaml");
    const ledger = loadYaml("../../../contracts/tools/tool-risk.yaml");
    const config = readFileSync(new URL("../../../deploy/agentgateway/config.yaml", import.meta.url), "utf8");

    expect(renderGatewayConfig(config, generateGatewaySections(registry, ledger, registrySchemaHash(registry)))).toBe(
      config,
    );
  });

  it("rejects an invalid or mismatched risk before generation [FinalArch:MCP-004]", () => {
    const registry = structuredClone(loadYaml("../../../contracts/tools/fixtures/enabled-mixed.registry.yaml")) as {
      entries: Array<Record<string, unknown>>;
    };
    registry.entries[0].risk = "L7";
    expect(() => generateGatewaySections(registry, riskLedger, schemaHash)).toThrow(/risk/u);
  });

  it("rejects forbidden high-risk operations even if the ledger misclassifies them [FinalArch:MCP-004]", () => {
    const registry = structuredClone(loadYaml("../../../contracts/tools/fixtures/enabled-mixed.registry.yaml")) as {
      entries: Array<Record<string, unknown>>;
    };
    const ledger = structuredClone(riskLedger);
    ledger.operations = { ...ledger.operations, merge_pull_request: "L1" };
    registry.entries[0].operations = ["merge_pull_request"];
    expect(() => generateGatewaySections(registry, ledger, schemaHash)).toThrow(/high-risk operation/u);
  });

  it("requires an exact endpoint only for enabled entries and cannot express stdio or ai [FinalArch:MCP-001]", () => {
    const missingEndpoint = structuredClone(
      loadYaml("../../../contracts/tools/fixtures/enabled-mixed.registry.yaml"),
    ) as { entries: Array<Record<string, unknown>> };
    delete missingEndpoint.entries[0].endpoint;
    expect(() => generateGatewaySections(missingEndpoint, riskLedger, schemaHash)).toThrow(/endpoint/u);

    const invalidDisabledEndpoint = structuredClone(
      loadYaml("../../../contracts/tools/fixtures/enabled-mixed.registry.yaml"),
    ) as { entries: Array<Record<string, unknown>> };
    invalidDisabledEndpoint.entries[0].enabled = false;
    invalidDisabledEndpoint.entries[0].endpoint = { host: "github.example.com", port: 0, path: "/mcp" };
    expect(() => generateGatewaySections(invalidDisabledEndpoint, riskLedger, schemaHash)).toThrow(/port/u);

    const stdio = structuredClone(missingEndpoint);
    stdio.entries[0].enabled = false;
    stdio.entries[0].transport = "stdio";
    expect(() => generateGatewaySections(stdio, riskLedger, schemaHash)).toThrow(/transport/u);

    const ai = structuredClone(missingEndpoint);
    ai.entries[0].enabled = false;
    ai.entries[0].protocol = "ai";
    expect(() => generateGatewaySections(ai, riskLedger, schemaHash)).toThrow(/protocol/u);
  });
});

function registrySchemaHash(registry: unknown): string {
  return (registry as { schema_hash: string }).schema_hash;
}
