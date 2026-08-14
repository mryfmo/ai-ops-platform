// 根拠: FinalArch:MCP-001 / FinalArch:PRD-003 / FinalArch:PRD-005 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T01
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultRepoRoot, loadDocument } from "../check-contracts.mjs";
import { PINNED_IMAGE, validateGatewayConfig, validateSmokeFixture } from "./check-gateway-config.mjs";

const cloneConfig = () => structuredClone(loadDocument(defaultRepoRoot, "deploy/agentgateway/config.yaml"));
const cloneDeployment = () => structuredClone(loadDocument(defaultRepoRoot, "deploy/agentgateway/deployment.yaml"));
const cloneFixture = () =>
  structuredClone(loadDocument(defaultRepoRoot, "deploy/agentgateway/smoke-fixture.config.yaml"));

describe("agentgateway MCP/A2A-only config [FinalArch:MCP-001]", () => {
  it("accepts the governed MCP/A2A-only configuration [FinalArch:MCP-001]", () => {
    assert.deepEqual(validateGatewayConfig(), {
      mcpTargetCount: 0,
      mcpAuthorizationRuleCount: 1,
      a2aRouteCount: 1,
    });
  });

  it("rejects broad authorization rules — only the deny-all sentinel is allowed (P4-T01-001) [FinalArch:MCP-001]", () => {
    const allowAll = cloneConfig();
    allowAll.mcp.policies.mcpAuthorization.rules = ["true"];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, allowAll), /deny-all sentinel/u);

    const extraRule = cloneConfig();
    extraRule.mcp.policies.mcpAuthorization.rules = ["false", 'mcp.tool.name == "anything"'];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, extraRule), /deny-all sentinel/u);

    const withoutPolicy = cloneConfig();
    delete withoutPolicy.mcp.policies.mcpAuthorization;
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, withoutPolicy), /must be a mapping/u);

    const emptyRules = cloneConfig();
    emptyRules.mcp.policies.mcpAuthorization.rules = [];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, emptyRules), /deny-all sentinel/u);

    const withTargets = cloneConfig();
    withTargets.mcp.targets.push({ name: "early", mcp: { host: "example.internal", port: 443, path: "/mcp" } });
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, withTargets), /targets must stay empty/u);
  });

  it("rejects LLM surfaces including generic host-backend routes (P4-T01-002 / ADR-0023) [FinalArch:MCP-001]", () => {
    const withTopLevelLlm = cloneConfig();
    withTopLevelLlm.llm = { gateways: "default" };
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, withTopLevelLlm), /top-level config allows only/u);

    // レビュー指摘の実変異: 禁止キーなしの generic proxy route。
    const genericProxy = cloneConfig();
    genericProxy.routes.push({
      name: "llm-smuggle",
      matches: [{ path: { pathPrefix: "/v1/chat/completions" } }],
      backends: [{ host: "api.openai.com:443" }],
    });
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, genericProxy), /exactly the A2A marker/u);

    const aiBackend = cloneConfig();
    aiBackend.routes = [{ name: "ai", backends: [{ ai: { provider: { openAI: {} } } }] }];
    assert.throws(
      () => validateGatewayConfig(defaultRepoRoot, aiBackend),
      /allows only \[name, gateways, matches, policies\]/u,
    );

    for (const key of ["routeGroups", "backends", "services", "workloads", "binds", "policies"]) {
      const smuggled = cloneConfig();
      smuggled[key] = [];
      assert.throws(() => validateGatewayConfig(defaultRepoRoot, smuggled), /top-level config allows only/u, key);
    }
  });

  it("rejects a management UI attachment and admin re-enablement (P4-T01-002) [FinalArch:MCP-001]", () => {
    const withUi = cloneConfig();
    withUi.ui = { gateways: "default" };
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, withUi), /top-level config allows only/u);

    const adminOn = cloneConfig();
    adminOn.config.adminAddr = "0.0.0.0:15000";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, adminOn), /adminAddr must be off/u);
  });

  it("pins the JWT identity: issuer, audience, file-only JWKS, shared across surfaces (P4-T01-003) [FinalArch:MCP-001]", () => {
    const wrongIssuer = cloneConfig();
    wrongIssuer.mcp.policies.jwtAuth.issuer = "https://attacker.invalid";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, wrongIssuer), /canonical platform binding/u);

    const wrongAudience = cloneConfig();
    wrongAudience.mcp.policies.jwtAuth.audiences = ["attacker-audience"];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, wrongAudience), /canonical platform binding/u);

    const urlJwks = cloneConfig();
    urlJwks.mcp.policies.jwtAuth.jwks = { url: "https://attacker.invalid/jwks.json" };
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, urlJwks), /canonical platform binding/u);

    const crossSurfaceDrift = cloneConfig();
    crossSurfaceDrift.routes[0].policies.jwtAuth.audiences = ["other-audience"];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, crossSurfaceDrift), /canonical platform binding/u);

    const permissive = cloneConfig();
    permissive.mcp.policies.jwtAuth.mode = "permissive";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, permissive), /canonical platform binding/u);
  });

  it("pins the A2A marker: backend-free, /a2a only, 503 (P4-T01-002) [FinalArch:MCP-001]", () => {
    const withBackend = cloneConfig();
    withBackend.routes[0].backends = [{ host: "agents.internal:443" }];
    assert.throws(
      () => validateGatewayConfig(defaultRepoRoot, withBackend),
      /allows only \[name, gateways, matches, policies\]/u,
    );

    const widenedMatch = cloneConfig();
    widenedMatch.routes[0].matches = [{ path: { pathPrefix: "/" } }];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, widenedMatch), /match only the \/a2a prefix/u);

    const noDirectResponse = cloneConfig();
    delete noDirectResponse.routes[0].policies.directResponse;
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, noDirectResponse), /policies allows only|503/u);

    const noRoutes = cloneConfig();
    noRoutes.routes = [];
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, noRoutes), /exactly the A2A marker/u);
  });

  it("pins operational values: OTLP sink, ports, A2A body, deployment consistency (P4-T01-007) [FinalArch:MCP-001]", () => {
    const externalOtlp = cloneConfig();
    externalOtlp.config.tracing.otlpEndpoint = "https://attacker.invalid:4317";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, externalOtlp), /tracing must stay pinned/u);

    const httpOtlp = cloneConfig();
    httpOtlp.config.tracing.otlpProtocol = "http";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, httpOtlp), /tracing must stay pinned/u);

    const readinessDrift = cloneConfig();
    readinessDrift.config.readinessAddr = "0.0.0.0:25021";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, readinessDrift), /readinessAddr must stay pinned/u);

    const statsDrift = cloneConfig();
    statsDrift.config.statsAddr = "0.0.0.0:25020";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, statsDrift), /statsAddr must stay pinned/u);

    const gatewayPortDrift = cloneConfig();
    gatewayPortDrift.gateways.default.port = 3001;
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, gatewayPortDrift), /default:3000/u);

    const a2aBodyDrift = cloneConfig();
    a2aBodyDrift.routes[0].policies.directResponse.bodyExpression = '"drifted"';
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, a2aBodyDrift), /pinned 503 direct response/u);

    const deploymentPortDrift = cloneDeployment();
    deploymentPortDrift.posture.ports.gateway = 3001;
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, undefined, deploymentPortDrift), /posture\.ports/u);

    const deploymentOtlpDrift = cloneDeployment();
    deploymentOtlpDrift.posture.otlp_endpoint = "https://attacker.invalid:4317";
    assert.throws(
      () => validateGatewayConfig(defaultRepoRoot, undefined, deploymentOtlpDrift),
      /posture\.otlp_endpoint/u,
    );
  });

  it("rejects an unpinned or drifted image and weakened posture [FinalArch:MCP-001]", () => {
    const floating = cloneDeployment();
    floating.provenance.image = "ghcr.io/agentgateway/agentgateway:latest";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, undefined, floating), /digest-pinned/u);

    const drifted = cloneDeployment();
    drifted.provenance.image = PINNED_IMAGE.replace(/@sha256:.{8}/u, "@sha256:00000000");
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, undefined, drifted), /reviewed reference/u);

    const publicIngress = cloneDeployment();
    publicIngress.posture.ingress = "public";
    assert.throws(() => validateGatewayConfig(defaultRepoRoot, undefined, publicIngress), /internal-only/u);
  });
});

describe("agentgateway smoke fixture equivalence (P4-T01-001) [FinalArch:MCP-001]", () => {
  it("accepts the checked-in fixture (governed config + exactly one synthetic target)", () => {
    assert.deepEqual(validateSmokeFixture(), { syntheticTargetCount: 1 });
  });

  it("rejects a fixture that weakens authorization or auth relative to the governed config", () => {
    const weakenedRules = cloneFixture();
    weakenedRules.mcp.policies.mcpAuthorization.rules = ["true"];
    assert.throws(() => validateSmokeFixture(defaultRepoRoot, weakenedRules), /only in mcp\.targets/u);

    const weakenedAuth = cloneFixture();
    weakenedAuth.mcp.policies.jwtAuth.mode = "permissive";
    assert.throws(() => validateSmokeFixture(defaultRepoRoot, weakenedAuth), /only in mcp\.targets/u);

    const extraTarget = cloneFixture();
    extraTarget.mcp.targets.push({ name: "second", mcp: { host: "x", port: 1, path: "/mcp" } });
    assert.throws(() => validateSmokeFixture(defaultRepoRoot, extraTarget), /exactly one synthetic/u);

    const stdioTarget = cloneFixture();
    stdioTarget.mcp.targets = [{ name: "synthetic", stdio: { cmd: "npx" } }];
    assert.throws(
      () => validateSmokeFixture(defaultRepoRoot, stdioTarget),
      /target allows only|endpoint must stay pinned/u,
    );
  });

  it("rejects endpoint drift toward a decoy target (P4-T01-006)", () => {
    const decoyPort = cloneFixture();
    decoyPort.mcp.targets[0].mcp.port = 8932;
    assert.throws(() => validateSmokeFixture(defaultRepoRoot, decoyPort), /endpoint must stay pinned/u);

    const decoyHost = cloneFixture();
    decoyHost.mcp.targets[0].mcp.host = "203.0.113.10";
    assert.throws(() => validateSmokeFixture(defaultRepoRoot, decoyHost), /endpoint must stay pinned/u);

    const decoyPath = cloneFixture();
    decoyPath.mcp.targets[0].mcp.path = "/decoy";
    assert.throws(() => validateSmokeFixture(defaultRepoRoot, decoyPath), /endpoint must stay pinned/u);
  });
});
