// 根拠: FinalArch:LLM-002 / FinalArch:PRD-003 / FinalArch:FR-LLM-001..007 / ADR-0022
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defaultRepoRoot, loadDocument, validateJsonSchemaDocument } from "../check-contracts.mjs";

const MANIFEST_PATH = "deploy/litellm/model-aliases.yaml";
const SCHEMA_PATH = "contracts/model-routing/model-aliases.schema.json";
const canonicalModel = (envName) => `os.environ/${envName}`;

function assertSame(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} must match the canonical contract`);
}

export function validateModelAliases(repoRoot = defaultRepoRoot, override) {
  const manifest = override ?? loadDocument(repoRoot, MANIFEST_PATH);
  const schema = loadDocument(repoRoot, SCHEMA_PATH);
  validateJsonSchemaDocument(schema, manifest, repoRoot);

  const canonicalPath = manifest.provenance.canonical_path;
  const canonicalSource = fs.readFileSync(path.join(repoRoot, canonicalPath), "utf8");
  const canonicalSha = createHash("sha256").update(canonicalSource).digest("hex");
  assert.equal(manifest.provenance.canonical_sha256, canonicalSha, "canonical SHA-256 drifted");

  const canonical = loadDocument(repoRoot, canonicalPath);
  const canonicalAliases = Object.keys(canonical.aliases);
  const expectedFallbackCount = Object.values(canonical.aliases).filter(({ fallback }) => fallback !== null).length;
  assertSame(manifest.application_aliases, canonicalAliases, "application aliases");

  const bindings = new Map(manifest.model_list.map((binding) => [binding.model_name, binding]));
  assert.equal(bindings.size, manifest.model_list.length, "model_name values must be unique");
  assert.equal(bindings.size, canonicalAliases.length + expectedFallbackCount, "unexpected model binding count");
  const fallbacks = new Map(manifest.aiops_settings.fallbacks.map((fallback) => [fallback.source_alias, fallback]));
  assert.equal(fallbacks.size, manifest.aiops_settings.fallbacks.length, "fallback sources must be unique");
  assert.equal(fallbacks.size, expectedFallbackCount, "unexpected fallback policy count");

  for (const [alias, route] of Object.entries(canonical.aliases)) {
    const primary = bindings.get(alias);
    assert(primary, `${alias} primary binding is missing`);
    assert.equal(primary.model_info.access, "application", `${alias} must be application-facing`);
    assert.equal(primary.litellm_params.custom_llm_provider, route.default_provider, `${alias} provider drifted`);
    assert.equal(primary.litellm_params.model, canonicalModel(route.model_id_env), `${alias} model env drifted`);
    assertSame(primary.model_info.data_classifications, route.allowed_classifications, `${alias} classifications`);

    const fallback = fallbacks.get(alias);
    if (route.fallback === null) {
      assert.equal(fallback, undefined, `${alias} must not gain a fallback`);
      continue;
    }

    assert(fallback, `${alias} fallback policy is missing`);
    assertSame(fallback.data_classifications, route.allowed_classifications, `${alias} fallback classifications`);
    assertSame(fallback.on_errors, canonical.fallback_allowed_errors, `${alias} fallback errors`);
    const target = bindings.get(fallback.target_alias);
    assert(target, `${alias} fallback target binding is missing`);
    assert.equal(target.model_info.access, "internal_fallback", `${alias} fallback target must be internal`);
    assert.equal(target.litellm_params.custom_llm_provider, route.fallback, `${alias} fallback provider drifted`);
    assert.equal(
      target.litellm_params.model,
      canonicalModel(route.fallback_model_id_env),
      `${alias} fallback env drifted`,
    );
    assertSame(
      target.model_info.data_classifications,
      route.allowed_classifications,
      `${alias} target classifications`,
    );
  }

  assertSame(
    manifest.aiops_settings.fallback_forbidden_errors,
    canonical.fallback_forbidden_errors,
    "forbidden fallback errors",
  );
  assertSame(
    manifest.aiops_settings.disabled_litellm_features,
    canonical.disabled_litellm_features,
    "disabled LiteLLM features",
  );

  return {
    aliasCount: manifest.application_aliases.length,
    bindingCount: manifest.model_list.length,
    fallbackCount: manifest.aiops_settings.fallbacks.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validateModelAliases()));
}
