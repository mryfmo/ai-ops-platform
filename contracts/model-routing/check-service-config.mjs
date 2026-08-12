// 根拠: FinalArch:LLM-001 / FinalArch:LLM-003 / FinalArch:PRD-003 / FinalArch:FR-LLM-001..007 / ADR-0022 / ADR-0029
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defaultRepoRoot, loadDocument } from "../check-contracts.mjs";

const CONFIG_PATH = "deploy/litellm/config.yaml";
const ENV_EXAMPLE_PATH = "deploy/litellm/env.example";
const MANIFEST_PATH = "deploy/litellm/model-aliases.yaml";
const LICENSE_REGISTER_PATH = "docs/security/2026-08-10-license-service-review-register.md";

const IMAGE_REF_PATTERN =
  /ghcr\.io\/[a-z0-9._-]+\/[a-z0-9._-]*litellm[a-z0-9._-]*:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}/gu;

// Packaged-but-disabled proof (Owner ruling 2026-08-12): none of these names
// may be referenced by the deployed configuration or its env contract. The
// list mirrors the enterprise tree paths named in the license register.
const ENTERPRISE_MARKERS = [
  "cloudformation_stack",
  "dist",
  "enterprise_hooks",
  "enterprise_ui",
  "litellm_enterprise",
  "LITELLM_LICENSE",
];

// Inference-only boundary: no MCP/A2A/passthrough config surface. `agents` and
// `agent_list` are LiteLLM v1.96.2's actual A2A surfaces.
const FORBIDDEN_KEY_PATTERN = /(^|_)(mcp|a2a)(_|$)|pass_through|^agents$|^agent_list$/iu;

// Long-lived provider credentials are forbidden in the service env (LLM-003).
// ANTHROPIC_API_KEY is forbidden by name: the always-mounted /anthropic
// passthrough route falls back to it, so the deployment credential must use a
// different name (bound per-model via litellm_params.api_key).
const FORBIDDEN_ENV_ASSIGNMENTS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "LITELLM_LICENSE",
  "ANTHROPIC_API_KEY",
];

const SECRET_LITERAL_PATTERN = /sk-(?!smoke)[A-Za-z0-9]|AKIA[0-9A-Z]{16}|-----BEGIN/u;

const OSS_CALLBACK_ALLOWLIST = new Set(["otel"]);

// Route prefixes that must never appear in the runtime boundary allowlist:
// provider passthrough surfaces plus MCP/A2A and their management routes.
const FORBIDDEN_ROUTE_PREFIXES = [
  "/anthropic",
  "/bedrock",
  "/vertex",
  "/gemini",
  "/azure",
  "/openai",
  "/cohere",
  "/mcp",
  "/a2a",
  "/v1/agents",
  "/v1/mcp",
  "/agents",
];

export function validateRouteAllowlist(prefixes) {
  assert(Array.isArray(prefixes) && prefixes.length > 0, "route allowlist must be a non-empty array");
  for (const prefix of prefixes) {
    assert.match(String(prefix), /^\/[A-Za-z0-9/_-]*$/u, `malformed route prefix: ${prefix}`);
    for (const forbidden of FORBIDDEN_ROUTE_PREFIXES) {
      assert(
        !String(prefix).startsWith(forbidden),
        `route allowlist must not open the ${forbidden} surface (got ${prefix})`,
      );
    }
    assert(!/(^|[/_])(mcp|a2a|agents|pass_through)([/_]|$)/iu.test(prefix), `forbidden surface in prefix: ${prefix}`);
  }
  assert(prefixes.includes("/health"), "route allowlist must keep /health");
  return prefixes.length;
}

export function registeredImages(repoRoot = defaultRepoRoot) {
  const register = fs.readFileSync(path.join(repoRoot, LICENSE_REGISTER_PATH), "utf8");
  const refs = new Set(register.match(IMAGE_REF_PATTERN) ?? []);
  assert(refs.size > 0, "the license register must pin the LiteLLM image references");
  return refs;
}

function* walk(node, trail = "") {
  if (Array.isArray(node)) {
    for (const [index, value] of node.entries()) yield* walk(value, `${trail}[${index}]`);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      yield { key, trail: `${trail}.${key}` };
      yield* walk(value, `${trail}.${key}`);
    }
  }
}

function assertNoEnterpriseReference(serialized, label) {
  for (const marker of ENTERPRISE_MARKERS) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])${marker}([^A-Za-z0-9_]|$)`, "u");
    assert(!pattern.test(serialized), `enterprise reference ${marker} must not appear in ${label}`);
  }
}

export function validateServiceConfig(repoRoot = defaultRepoRoot, override, envOverride) {
  const config = override ?? loadDocument(repoRoot, CONFIG_PATH);

  const registered = registeredImages(repoRoot);
  const image = String(config.provenance?.image);
  const baseImage = String(config.provenance?.base_image);
  assert(registered.has(image), "image must stay pinned to a reference recorded in the license register");
  assert(registered.has(baseImage), "base_image must stay pinned to a reference recorded in the license register");
  assert.match(image, /@sha256:[0-9a-f]{64}$/u, "image must be digest-pinned");
  assert.match(baseImage, /@sha256:[0-9a-f]{64}$/u, "base_image must be digest-pinned");
  assert.notEqual(image, baseImage, "the deployed image must be the OSS-only derived build, not the base image");
  assert.equal(config.provenance?.dockerfile, "deploy/litellm/Dockerfile", "the derived build recipe must be declared");
  assert.equal(config.provenance?.litellm_version, "v1.96.2", "LiteLLM version pin drifted");
  assert.deepEqual(config.include, ["model-aliases.yaml"], "the governed alias manifest must be the only model source");

  assert.equal(config.litellm_settings?.telemetry, false, "telemetry must be explicitly disabled");
  const callbacks = config.litellm_settings?.callbacks ?? [];
  for (const callback of callbacks) {
    assert(OSS_CALLBACK_ALLOWLIST.has(callback), `callback ${callback} is not on the OSS allowlist`);
  }

  const generalSettings = config.general_settings ?? {};
  assert.match(String(generalSettings.master_key), /^os\.environ\//u, "master key must come from the environment");
  assert.match(String(generalSettings.database_url), /^os\.environ\//u, "database URL must come from the environment");
  assert.equal(generalSettings.store_model_in_db, false, "runtime model registration would bypass the alias contract");
  // v1.96.2 defaults to loading every DB-backed object (mcp, agents,
  // pass_through_endpoints, ...) when supported_db_objects is unset.
  assert.deepEqual(
    generalSettings.supported_db_objects,
    [],
    "supported_db_objects must be an explicit empty list so no DB-backed MCP/A2A/passthrough object loads",
  );

  for (const { key, trail } of walk(config)) {
    if (trail === ".general_settings.supported_db_objects") continue;
    assert(!FORBIDDEN_KEY_PATTERN.test(key), `forbidden MCP/A2A/passthrough surface at ${trail}`);
  }

  assertNoEnterpriseReference(JSON.stringify(config), "the service config");

  const nativeFallbacks = config.router_settings?.fallbacks ?? [];
  assert.equal(nativeFallbacks.length, 0, "native fallbacks stay empty; aiops_settings governs fallback selection");

  const deployment = config.aiops_deployment;
  assert.equal(deployment?.private_ingress, true, "the proxy is internal-only");
  assert.deepEqual(deployment?.public_endpoints, [], "no public endpoint may be declared");
  assert(deployment?.database?.name && deployment?.database?.role, "dedicated logical DB and role must be named");
  assert(deployment?.health_endpoints?.length > 0, "health endpoints must be declared");
  assert.equal(
    deployment?.route_boundary?.enforcement,
    "sitecustomize-asgi-middleware",
    "the runtime route boundary must be declared",
  );
  assert.equal(
    deployment?.route_boundary?.allowlist,
    "route-allowlist.json",
    "the route boundary must bind the shared allowlist file",
  );
  const allowlistDocument = loadDocument(repoRoot, "deploy/litellm/route-allowlist.json");
  const allowlistCount = validateRouteAllowlist(allowlistDocument.allowed_route_prefixes);
  for (const healthEndpoint of deployment.health_endpoints) {
    assert(
      allowlistDocument.allowed_route_prefixes.some(
        (prefix) => healthEndpoint === prefix || healthEndpoint.startsWith(`${prefix}/`),
      ),
      `declared health endpoint ${healthEndpoint} is not reachable through the route allowlist`,
    );
  }

  const dockerfile = fs.readFileSync(path.join(repoRoot, "deploy/litellm/Dockerfile"), "utf8");
  assert(dockerfile.includes(`FROM ${baseImage}`), "Dockerfile FROM must match provenance.base_image");
  assert(dockerfile.includes("COPY route-allowlist.json"), "Dockerfile must ship the route allowlist");
  assert(dockerfile.includes("COPY sitecustomize.py"), "Dockerfile must install the route boundary");

  const manifest = loadDocument(repoRoot, MANIFEST_PATH);
  const credentialEnvs = new Set();
  for (const { model_name, litellm_params } of manifest.model_list) {
    if (litellm_params.custom_llm_provider !== "anthropic") continue;
    // Without a per-deployment credential the SDK would fall back to
    // ANTHROPIC_API_KEY, which must stay unset to starve the passthrough route.
    assert.match(
      String(litellm_params.api_key),
      /^os\.environ\/(?!ANTHROPIC_API_KEY$)[A-Z][A-Z0-9_]*$/u,
      `${model_name} must bind a dedicated anthropic credential env`,
    );
    credentialEnvs.add(litellm_params.api_key.replace("os.environ/", ""));
  }

  if (override === undefined || envOverride !== undefined) {
    const rawConfig = fs.readFileSync(path.join(repoRoot, CONFIG_PATH), "utf8");
    assert(!SECRET_LITERAL_PATTERN.test(rawConfig), "secret-looking literal in service config");

    const rawEnv = envOverride ?? fs.readFileSync(path.join(repoRoot, ENV_EXAMPLE_PATH), "utf8");
    assert(!SECRET_LITERAL_PATTERN.test(rawEnv), "secret-looking literal in env contract");
    assertNoEnterpriseReference(
      rawEnv
        .split("\n")
        .filter((line) => !line.startsWith("#"))
        .join("\n"),
      "the env contract",
    );
    const assignments = rawEnv
      .split("\n")
      .filter((line) => /^[A-Z0-9_]+=/u.test(line))
      .map((line) => line.split("=", 1)[0]);
    for (const forbidden of FORBIDDEN_ENV_ASSIGNMENTS) {
      assert(!assignments.includes(forbidden), `${forbidden} must not be part of the service env contract`);
    }
    for (const line of rawEnv.split("\n")) {
      assert.match(line, /^([A-Z0-9_]+=|#|$)/u, `env contract line must stay valueless or commented: ${line}`);
      assert(!/^[A-Z0-9_]+=.+/u.test(line), `env contract must not carry a value: ${line}`);
    }
    const requiredEnv = new Set([
      "LITELLM_MASTER_KEY",
      "LITELLM_DATABASE_URL",
      manifest.aiops_settings.pricing_revision_env,
      ...manifest.model_list.map(({ litellm_params }) => litellm_params.model.replace("os.environ/", "")),
      ...credentialEnvs,
    ]);
    for (const name of requiredEnv) {
      assert(assignments.includes(name), `env contract is missing ${name}`);
    }
  }

  return {
    callbackCount: callbacks.length,
    healthEndpointCount: deployment.health_endpoints.length,
    anthropicCredentialEnvCount: credentialEnvs.size,
    routeAllowlistCount: allowlistCount,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validateServiceConfig()));
}
