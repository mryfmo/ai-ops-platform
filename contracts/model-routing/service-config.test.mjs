// 根拠: FinalArch:LLM-001 / FinalArch:LLM-003 / FinalArch:PRD-003 / FinalArch:FR-LLM-001..007 / ADR-0022 / ADR-0029
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultRepoRoot, loadDocument } from "../check-contracts.mjs";
import { registeredImages, validateRouteAllowlist, validateServiceConfig } from "./check-service-config.mjs";

const configPath = "deploy/litellm/config.yaml";
const cloneConfig = () => structuredClone(loadDocument(defaultRepoRoot, configPath));

describe("LiteLLM service config [FinalArch:LLM-001][FinalArch:LLM-003]", () => {
  it("accepts the inference-only proxy configuration [FinalArch:LLM-001]", () => {
    assert.deepEqual(validateServiceConfig(), {
      callbackCount: 1,
      healthEndpointCount: 2,
      anthropicCredentialEnvCount: 1,
      routeAllowlistCount: 10,
    });
  });

  it("rejects a route allowlist that opens passthrough/MCP/A2A surfaces [FinalArch:LLM-001]", () => {
    const fixture = loadDocument(defaultRepoRoot, "contracts/model-routing/fixtures/allowlist-passthrough.json");
    for (const prefix of fixture.forbidden) {
      assert.throws(() => validateRouteAllowlist(["/health", prefix]), /route allowlist|forbidden surface/u, prefix);
    }
    assert.throws(() => validateRouteAllowlist(["/v1/models"]), /must keep \/health/u);
  });

  it("rejects an undeclared or unbound runtime route boundary [FinalArch:LLM-001]", () => {
    const config = cloneConfig();
    delete config.aiops_deployment.route_boundary;
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /route boundary must be declared/u);
  });

  it("binds the image pins to the license register [FinalArch:LLM-001]", () => {
    for (const registered of registeredImages()) {
      assert.match(registered, /@sha256:[0-9a-f]{64}$/u);
    }
    const config = cloneConfig();
    config.provenance.image = "ghcr.io/mryfmo/aiops-litellm-oss:main-latest";
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /recorded in the license register/u);
  });

  it("rejects deploying the enterprise-bundling base image directly [FinalArch:LLM-003]", () => {
    const config = cloneConfig();
    config.provenance.image = config.provenance.base_image;
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /OSS-only derived build/u);
  });

  it("rejects enabled telemetry [FinalArch:LLM-001]", () => {
    const fixture = loadDocument(defaultRepoRoot, "contracts/model-routing/fixtures/telemetry-on.json");
    const config = cloneConfig();
    config.litellm_settings.telemetry = fixture.telemetry;
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /telemetry must be explicitly disabled/u);
  });

  it("rejects every enterprise path reference [FinalArch:LLM-003]", () => {
    const fixture = loadDocument(defaultRepoRoot, "contracts/model-routing/fixtures/enterprise-paths.json");
    assert.equal(fixture.markers.length, 6);
    for (const marker of fixture.markers) {
      const config = cloneConfig();
      config.litellm_settings.custom_note = `uses ${marker} module`;
      assert.throws(
        () => validateServiceConfig(defaultRepoRoot, config),
        /enterprise reference/u,
        `${marker} must be rejected`,
      );
    }
  });

  it("rejects an enterprise env reference [FinalArch:LLM-003]", () => {
    const fixture = loadDocument(defaultRepoRoot, "contracts/model-routing/fixtures/enterprise-env.json");
    const config = cloneConfig();
    config.general_settings.license = `os.environ/${fixture.env}`;
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /enterprise reference/u);
  });

  it("rejects MCP gateway config surface [FinalArch:LLM-001]", () => {
    const fixture = loadDocument(defaultRepoRoot, "contracts/model-routing/fixtures/mcp-enabled.json");
    const config = cloneConfig();
    config[fixture.key] = fixture.value;
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /forbidden MCP\/A2A\/passthrough/u);
  });

  it("rejects A2A agents config surface [FinalArch:LLM-001]", () => {
    const fixture = loadDocument(defaultRepoRoot, "contracts/model-routing/fixtures/a2a-agents.json");
    for (const key of fixture.keys) {
      const config = cloneConfig();
      config[key] = [];
      assert.throws(
        () => validateServiceConfig(defaultRepoRoot, config),
        /forbidden MCP\/A2A\/passthrough/u,
        `${key} must be rejected`,
      );
    }
  });

  it("rejects DB-backed object loading left at the v1.96.2 default [FinalArch:LLM-001]", () => {
    const config = cloneConfig();
    delete config.general_settings.supported_db_objects;
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /supported_db_objects/u);
    const enabled = cloneConfig();
    enabled.general_settings.supported_db_objects = ["mcp"];
    assert.throws(() => validateServiceConfig(defaultRepoRoot, enabled), /supported_db_objects/u);
  });

  it("rejects the ANTHROPIC_API_KEY passthrough fallback in the env contract [FinalArch:LLM-003]", () => {
    assert.throws(
      () => validateServiceConfig(defaultRepoRoot, undefined, "LITELLM_MASTER_KEY=\nANTHROPIC_API_KEY=\n"),
      /ANTHROPIC_API_KEY must not be part of the service env contract/u,
    );
  });

  it("rejects a literal master key [FinalArch:LLM-003]", () => {
    const config = cloneConfig();
    config.general_settings.master_key = "literal-master-key";
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /master key must come from the environment/u);
  });

  it("rejects re-enabled native fallbacks [FinalArch:LLM-001]", () => {
    const config = cloneConfig();
    config.router_settings = { fallbacks: [{ "claude-standard": ["claude-standard-fallback"] }] };
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /native fallbacks stay empty/u);
  });

  it("rejects a public endpoint declaration [FinalArch:LLM-001]", () => {
    const config = cloneConfig();
    config.aiops_deployment.public_endpoints = ["https://litellm.example.com"];
    assert.throws(() => validateServiceConfig(defaultRepoRoot, config), /no public endpoint/u);
  });
});
