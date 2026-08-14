// 根拠: FinalArch:MCP-001 / FinalArch:PRD-003 / FinalArch:PRD-005 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T01
// agentgateway 本番 config の MCP/A2A-only 不変条件を機械検分する。
// - LLM routes disabled: top-level `llm` なし、`ai` backend/policy なし
// - production stdio disabled: `stdio` target なし
// - default deny: MCP surface は jwtAuth strict + mcpAuthorization allowlist rules
//   （rules 非一致 tool は deny + tools list から filter される vendor 仕様）
// - posture: adminAddr off / readiness / stats / OTel / digest-pinned image

import assert from "node:assert/strict";

import { defaultRepoRoot, loadDocument } from "../check-contracts.mjs";

const CONFIG_PATH = "deploy/agentgateway/config.yaml";
const DEPLOYMENT_PATH = "deploy/agentgateway/deployment.yaml";

// 配備 image は license register 相当の provenance 台帳（deployment.yaml）と
// 完全一致で固定する。tag も digest も変えるには本 check の更新 = レビューが要る。
export const PINNED_IMAGE =
  "ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29";

// LLM 面（ADR-0023 で agentgateway では使わない）と stdio(本番禁止)の禁止キー。
// vendor schema 上これらが現れうる位置は問わず、config 全域の深い走査で拒否する。
const FORBIDDEN_KEYS = new Set(["llm", "ai", "stdio"]);

function forbidKeysDeep(node, trail = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => forbidKeysDeep(item, [...trail, String(index)]));
    return;
  }
  if (node === null || typeof node !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    assert(
      !FORBIDDEN_KEYS.has(key),
      `forbidden key "${key}" at ${[...trail, key].join(".")}: LLM routes and stdio targets must stay disabled`,
    );
    forbidKeysDeep(value, [...trail, key]);
  }
}

function assertJwtAuthStrict(policies, where) {
  const jwtAuth = policies?.jwtAuth;
  assert(jwtAuth && typeof jwtAuth === "object", `${where} must configure jwtAuth`);
  assert.equal(jwtAuth.mode, "strict", `${where} jwtAuth must be strict (fail-closed)`);
  assert(typeof jwtAuth.issuer === "string" && jwtAuth.issuer.length > 0, `${where} jwtAuth must pin an issuer`);
  assert(Array.isArray(jwtAuth.audiences) && jwtAuth.audiences.length > 0, `${where} jwtAuth must pin audiences`);
  assert(jwtAuth.jwks && (jwtAuth.jwks.file || jwtAuth.jwks.url), `${where} jwtAuth must configure a JWKS source`);
}

export function validateGatewayConfig(repoRoot = defaultRepoRoot, override, deploymentOverride) {
  const config = override ?? loadDocument(repoRoot, CONFIG_PATH);
  const deployment = deploymentOverride ?? loadDocument(repoRoot, DEPLOYMENT_PATH);

  // provenance: 単一 OSS image、digest 固定、check 内 pin と台帳の完全一致。
  const image = deployment?.provenance?.image;
  assert(typeof image === "string", "deployment.yaml must declare provenance.image");
  assert.match(image, /@sha256:[0-9a-f]{64}$/u, "image must be digest-pinned");
  assert.equal(image, PINNED_IMAGE, "image must stay pinned to the reviewed reference");

  // posture: 管理 UI 無効・health/metrics/OTel の各面が宣言どおり。
  assert.equal(config?.config?.adminAddr, "off", "adminAddr must be off");
  assert(config?.config?.readinessAddr, "readinessAddr must be configured");
  assert(config?.config?.statsAddr, "statsAddr must be configured");
  assert(config?.config?.tracing?.otlpEndpoint, "tracing.otlpEndpoint must be configured");
  assert.equal(deployment?.posture?.ingress, "internal-only", "posture.ingress must be internal-only");
  assert.equal(deployment?.posture?.mode, "mcp-a2a-only", "posture.mode must be mcp-a2a-only");

  // MCP/A2A-only: LLM 面と stdio を config 全域で拒否（FinalArch:MCP-001 の前提）。
  forbidKeysDeep(config);

  // MCP surface: fail-closed auth + allowlist authorization（default deny）。
  const mcp = config?.mcp;
  assert(mcp && typeof mcp === "object", "the MCP surface must be configured");
  assertJwtAuthStrict(mcp.policies, "mcp");
  const rules = mcp.policies?.mcpAuthorization?.rules;
  assert(
    Array.isArray(rules) && rules.length > 0,
    "mcpAuthorization.rules must be a non-empty allowlist (default deny)",
  );
  assert(Array.isArray(mcp.targets), "mcp.targets must be declared (empty until P4-T05..T08 onboarding)");

  // A2A surface: marker route が存在し、同じ fail-closed auth を通す。
  const a2aRoutes = (config?.routes ?? []).filter((route) => route?.policies && "a2a" in route.policies);
  assert(a2aRoutes.length > 0, "an A2A marker route must be configured");
  for (const route of a2aRoutes) {
    assertJwtAuthStrict(route.policies, `route ${route.name ?? "<unnamed>"}`);
  }

  return {
    mcpTargetCount: mcp.targets.length,
    mcpAuthorizationRuleCount: rules.length,
    a2aRouteCount: a2aRoutes.length,
  };
}
