// 根拠: FinalArch:MCP-001 / FinalArch:PRD-003 / FinalArch:PRD-005 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T01
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultRepoRoot, loadDocument } from "../check-contracts.mjs";
import { PINNED_IMAGE, validateGatewayConfig } from "./check-gateway-config.mjs";

const cloneConfig = () => structuredClone(loadDocument(defaultRepoRoot, "deploy/agentgateway/config.yaml"));
const cloneDeployment = () => structuredClone(loadDocument(defaultRepoRoot, "deploy/agentgateway/deployment.yaml"));

describe("agentgateway MCP/A2A-only config [FinalArch:MCP-001]", () => {
  it("accepts the governed MCP/A2A-only configuration [FinalArch:MCP-001]", () => {
    assert.deepEqual(validateGatewayConfig(), {
      mcpTargetCount: 0,
      mcpAuthorizationRuleCount: 1,
      a2aRouteCount: 1,
    });
  });

  it("rejects an LLM surface anywhere in the config (ADR-0023) [FinalArch:MCP-001]", () => {
    const withTopLevelLlm = cloneConfig();
    withTopLevelLlm.llm = { gateways: "default" };
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, withTopLevelLlm), /forbidden key "llm"/u);

    const withAiBackend = cloneConfig();
    withAiBackend.routes.push({
      name: "llm-smuggle",
      backends: [{ ai: { provider: { openAI: {} } } }],
    });
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, withAiBackend), /forbidden key "ai"/u);
  });

  it("rejects stdio targets (production stdio disabled) [FinalArch:MCP-001]", () => {
    const config = cloneConfig();
    config.mcp.targets.push({ name: "local", stdio: { cmd: "npx", args: ["x"] } });
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, config), /forbidden key "stdio"/u);
  });

  it("rejects a missing or empty mcpAuthorization allowlist (default deny) [FinalArch:MCP-001]", () => {
    const withoutPolicy = cloneConfig();
    delete withoutPolicy.mcp.policies.mcpAuthorization;
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, withoutPolicy), /non-empty allowlist/u);

    const emptyRules = cloneConfig();
    emptyRules.mcp.policies.mcpAuthorization.rules = [];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, emptyRules), /non-empty allowlist/u);
  });

  it("rejects weakened or missing jwtAuth on MCP and A2A surfaces [FinalArch:MCP-001]", () => {
    const permissive = cloneConfig();
    permissive.mcp.policies.jwtAuth.mode = "permissive";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, permissive), /jwtAuth must be strict/u);

    const unauthedA2a = cloneConfig();
    delete unauthedA2a.routes[0].policies.jwtAuth;
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, unauthedA2a), /must configure jwtAuth/u);

    const noA2a = cloneConfig();
    noA2a.routes = [];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, noA2a), /A2A marker route/u);
  });

  it("rejects an unpinned or drifted image and weakened posture [FinalArch:MCP-001]", () => {
    const floating = cloneDeployment();
    floating.provenance.image = "ghcr.io/agentgateway/agentgateway:latest";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, undefined, floating), /digest-pinned/u);

    const drifted = cloneDeployment();
    drifted.provenance.image = PINNED_IMAGE.replace(/@sha256:.{8}/u, "@sha256:00000000");
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, undefined, drifted), /reviewed reference/u);

    const adminOn = cloneConfig();
    adminOn.config.adminAddr = "0.0.0.0:15000";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, adminOn), /adminAddr must be off/u);

    const publicIngress = cloneDeployment();
    publicIngress.posture.ingress = "public";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, undefined, publicIngress), /internal-only/u);
  });
});
