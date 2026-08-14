// 根拠: FinalArch:MCP-001 / FinalArch:PRD-003 / FinalArch:PRD-005 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T01
// agentgateway 本番 config の MCP/A2A-only 不変条件を機械検分する。
//
// 方式は「禁止キーの blocklist」ではなく「許可形の allowlist」（P4-T01-002 是正）:
// vendor schema は generic route / routeGroups / 再利用 backends / top-level ui 等で
// 禁止キーなしに LLM proxy や管理 UI を構成できるため、本 check は
// 「レビュー済みの構成形と完全一致すること」を検分し、想定外のキー・route・
// backend の追加をすべて reject する。緩め方向のいかなる drift も
// 本ファイルの更新（= レビュー）なしには CI を通らない。
//
// 現在の許可形（P4-T02 registry generator 導入までの deny-all 準備構成）:
// - top-level は config / gateways / mcp / routes の 4 キーのみ
// - mcp.targets は空、mcpAuthorization.rules は恒偽 sentinel ["false"] に固定
// - routes は backend を持たない A2A 503 marker の 1 本のみ
// - jwtAuth は MCP / A2A 両面とも下記の canonical 定数と完全一致（P4-T01-003 是正）

import assert from "node:assert/strict";

import { defaultRepoRoot, loadDocument } from "../check-contracts.mjs";

const CONFIG_PATH = "deploy/agentgateway/config.yaml";
const DEPLOYMENT_PATH = "deploy/agentgateway/deployment.yaml";
const SMOKE_FIXTURE_PATH = "deploy/agentgateway/smoke-fixture.config.yaml";

// 配備 image は provenance 台帳（deployment.yaml）と完全一致で固定する。
// tag も digest も変えるには本 check の更新 = レビューが要る。
export const PINNED_IMAGE =
  "ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29";

// P4-T01-003: platform identity の canonical 定数。issuer / audience / JWKS は
// 完全一致で pin し、JWKS は file mount のみ（URL 取得は攻撃者 JWKS への
// すり替え面になるため reject）。MCP / A2A は同一 binding を共有する。
export const PLATFORM_JWT_AUTH = Object.freeze({
  mode: "strict",
  issuer: "https://auth.aiops.internal/realms/platform",
  audiences: Object.freeze(["aiops-mcp-gateway"]),
  jwks: Object.freeze({ file: "/etc/agentgateway/jwks/platform.json" }),
});

// P4-T01-001: P4-T02 の registry generator 導入まで、authorization は
// 恒偽 sentinel との完全一致に固定する（["true"] 等の broad rule 化を reject）。
export const DENY_ALL_SENTINEL = Object.freeze(["false"]);

function assertKeys(node, allowed, where) {
  assert(node !== null && typeof node === "object" && !Array.isArray(node), `${where} must be a mapping`);
  const actual = Object.keys(node);
  const extra = actual.filter((key) => !allowed.includes(key));
  assert.deepEqual(extra, [], `${where} allows only [${allowed.join(", ")}]; unexpected: [${extra.join(", ")}]`);
}

function assertPlatformJwtAuth(jwtAuth, where) {
  assert.deepEqual(
    structuredClone(jwtAuth ?? null),
    structuredClone(PLATFORM_JWT_AUTH),
    `${where} jwtAuth must equal the canonical platform binding (strict / pinned issuer+audience / file-only JWKS)`,
  );
}

function assertA2aMarkerRoute(route) {
  const where = `route ${route?.name ?? "<unnamed>"}`;
  assertKeys(route, ["name", "gateways", "matches", "policies"], where);
  assert.equal(route.gateways, "default", `${where} must attach to the default gateway`);
  assert(!("backends" in route), `${where} must stay backend-free`);
  assert.deepEqual(route.matches, [{ path: { pathPrefix: "/a2a" } }], `${where} must match only the /a2a prefix`);
  assertKeys(route.policies, ["a2a", "jwtAuth", "directResponse"], `${where} policies`);
  assert.deepEqual(route.policies.a2a, {}, `${where} must carry the a2a marker`);
  assertPlatformJwtAuth(route.policies.jwtAuth, where);
  assert.equal(route.policies.directResponse?.status, 503, `${where} must answer 503 until A2A onboarding`);
  assertKeys(route.policies.directResponse, ["status", "bodyExpression"], `${where} directResponse`);
}

export function validateGatewayConfig(repoRoot = defaultRepoRoot, override, deploymentOverride) {
  const config = override ?? loadDocument(repoRoot, CONFIG_PATH);
  const deployment = deploymentOverride ?? loadDocument(repoRoot, DEPLOYMENT_PATH);

  // provenance: 単一 OSS image、digest 固定、check 内 pin と台帳の完全一致。
  const image = deployment?.provenance?.image;
  assert(typeof image === "string", "deployment.yaml must declare provenance.image");
  assert.match(image, /@sha256:[0-9a-f]{64}$/u, "image must be digest-pinned");
  assert.equal(image, PINNED_IMAGE, "image must stay pinned to the reviewed reference");
  assert.equal(deployment?.posture?.ingress, "internal-only", "posture.ingress must be internal-only");
  assert.equal(deployment?.posture?.mode, "mcp-a2a-only", "posture.mode must be mcp-a2a-only");

  // 許可形 allowlist（P4-T01-002）: top-level に llm / ui / binds / routeGroups /
  // backends / services / workloads / policies 等が現れた時点で reject。
  assertKeys(config, ["config", "gateways", "mcp", "routes"], "top-level config");

  // 運用面: 管理 UI off / readiness / stats / OTel。
  assertKeys(config.config, ["adminAddr", "readinessAddr", "statsAddr", "tracing"], "config");
  assert.equal(config.config.adminAddr, "off", "adminAddr must be off");
  assert(config.config.readinessAddr, "readinessAddr must be configured");
  assert(config.config.statsAddr, "statsAddr must be configured");
  assertKeys(config.config.tracing, ["otlpEndpoint", "otlpProtocol"], "config.tracing");
  assert(config.config.tracing.otlpEndpoint, "tracing.otlpEndpoint must be configured");

  // gateway entrypoint は default:3000 の単一 HTTP listener のみ。
  assert.deepEqual(config.gateways, { default: { port: 3000 } }, "gateways must expose only default:3000");

  // MCP surface: fail-closed auth + deny-all sentinel（P4-T01-001/003）。
  assertKeys(config.mcp, ["gateways", "policies", "targets"], "mcp");
  assert.equal(config.mcp.gateways, "default", "mcp must attach to the default gateway");
  assertKeys(config.mcp.policies, ["jwtAuth", "mcpAuthorization"], "mcp.policies");
  assertPlatformJwtAuth(config.mcp.policies.jwtAuth, "mcp");
  assertKeys(config.mcp.policies.mcpAuthorization, ["rules"], "mcp.policies.mcpAuthorization");
  assert.deepEqual(
    structuredClone(config.mcp.policies.mcpAuthorization.rules),
    structuredClone(DENY_ALL_SENTINEL),
    "mcpAuthorization.rules must equal the deny-all sentinel until the P4-T02 generator owns it",
  );
  assert.deepEqual(config.mcp.targets, [], "mcp.targets must stay empty until P4-T05..T08 onboarding");

  // A2A surface: backend-free な 503 marker 1 本のみ。それ以外の route は
  // （generic host backend 経由の LLM proxy 化を含め）すべて reject。
  assert(Array.isArray(config.routes) && config.routes.length === 1, "routes must contain exactly the A2A marker");
  assertA2aMarkerRoute(config.routes[0]);

  return {
    mcpTargetCount: config.mcp.targets.length,
    mcpAuthorizationRuleCount: config.mcp.policies.mcpAuthorization.rules.length,
    a2aRouteCount: 1,
  };
}

// smoke の authenticated fixture（synthetic target 1 本のみ governed config と
// 異なる）が、security 関連部分で drift していないことを検分する。
// fixture 側で rules / jwtAuth / 管理面を緩めると smoke の証明力が崩れるため。
export function validateSmokeFixture(repoRoot = defaultRepoRoot, fixtureOverride) {
  const governed = structuredClone(loadDocument(repoRoot, CONFIG_PATH));
  const fixture = structuredClone(fixtureOverride ?? loadDocument(repoRoot, SMOKE_FIXTURE_PATH));

  const targets = fixture?.mcp?.targets;
  assert(
    Array.isArray(targets) && targets.length === 1 && targets[0]?.name === "synthetic",
    "smoke fixture must add exactly one synthetic MCP target",
  );
  assertKeys(targets[0], ["name", "mcp"], "smoke fixture target");
  assertKeys(targets[0].mcp, ["host", "port", "path"], "smoke fixture target.mcp");

  // synthetic target 以外は governed config と byte 同値でなければならない。
  fixture.mcp.targets = [];
  assert.deepEqual(fixture, governed, "smoke fixture may differ from the governed config only in mcp.targets");
  return { syntheticTargetCount: 1 };
}
