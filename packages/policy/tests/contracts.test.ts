// 根拠: FinalArch:CON-004, FinalArch:CON-005, ADR-0023
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { isRiskLevel, POLICY_BUNDLE_VERSION, RISK_LEVELS, type RiskLevel } from "../src/index.js";

interface CanonicalCatalog {
  levels: Record<RiskLevel, { default: string }>;
  initial_tools: Array<{
    server: string;
    tool_group: string;
    risk: RiskLevel;
    operations: string[];
  }>;
  globally_forbidden: string[];
}

interface BundleCatalog {
  aiops: {
    tool_risk_catalog: {
      dispositions: Record<RiskLevel, string>;
      globally_forbidden: string[];
      tools: Array<{ server: string; group: string; operation: string; risk: RiskLevel }>;
    };
  };
}

const canonical = YAML.parse(
  readFileSync(
    new URL("../../../docs/plans/2026-08-final-architecture/05_contracts/tool-risk-catalog.yaml", import.meta.url),
    "utf8",
  ),
) as CanonicalCatalog;
const bundle = YAML.parse(
  readFileSync(new URL("../policies/risk_catalog.yaml", import.meta.url), "utf8"),
) as BundleCatalog;
const policySource = readFileSync(new URL("../policies/policy.rego", import.meta.url), "utf8");
const deployment = YAML.parse(
  readFileSync(new URL("../../../deploy/opa/deployment.yaml", import.meta.url), "utf8"),
) as { provenance: { image: string }; posture: { bundle_revision: string } };

describe("policy contracts [FinalArch:CON-004, FinalArch:CON-005]", () => {
  it("represents every canonical risk level from L0 through L6", () => {
    expect(RISK_LEVELS).toEqual(["L0", "L1", "L2", "L3", "L4", "L5", "L6"]);
  });

  it("rejects an unknown risk level at the TypeScript boundary", () => {
    expect(isRiskLevel("L6")).toBe(true);
    expect(isRiskLevel("L7")).toBe(false);
    expect(isRiskLevel(1)).toBe(false);
  });

  it("keeps bundle data equivalent to the canonical tool-risk catalog", () => {
    const expectedDispositions = Object.fromEntries(
      RISK_LEVELS.map((level) => [level, canonical.levels[level].default]),
    );
    const expectedTools = canonical.initial_tools.flatMap(({ server, tool_group: group, risk, operations }) =>
      operations.map((operation) => ({ server, group, operation, risk })),
    );
    const key = ({ server, group, operation, risk }: BundleCatalog["aiops"]["tool_risk_catalog"]["tools"][number]) =>
      `${server}.${group}.${operation}.${risk}`;

    expect(bundle.aiops.tool_risk_catalog.dispositions).toEqual(expectedDispositions);
    expect([...bundle.aiops.tool_risk_catalog.globally_forbidden].sort()).toEqual(
      [...canonical.globally_forbidden].sort(),
    );
    expect([...bundle.aiops.tool_risk_catalog.tools].sort((a, b) => key(a).localeCompare(key(b)))).toEqual(
      expectedTools.sort((a, b) => key(a).localeCompare(key(b))),
    );
  });

  it("binds client, deployment, and Rego to one bundle revision [FinalArch:MCP-002]", () => {
    expect(policySource).toContain(`bundle_version := "${POLICY_BUNDLE_VERSION}"`);
    expect(deployment.posture.bundle_revision).toBe(POLICY_BUNDLE_VERSION);
    expect(deployment.provenance.image).toMatch(
      /^docker\.io\/openpolicyagent\/opa:1\.19\.0-static@sha256:[0-9a-f]{64}$/u,
    );
  });
});
