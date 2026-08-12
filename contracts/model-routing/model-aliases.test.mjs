// 根拠: FinalArch:LLM-002 / FinalArch:PRD-003 / FinalArch:FR-LLM-001..007 / ADR-0022
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultRepoRoot, loadDocument, validateJsonSchemaDocument } from "../check-contracts.mjs";
import { validateModelAliases } from "./check-model-aliases.mjs";

const manifestPath = "deploy/litellm/model-aliases.yaml";
const schema = loadDocument(defaultRepoRoot, "contracts/model-routing/model-aliases.schema.json");
const cloneManifest = () => structuredClone(loadDocument(defaultRepoRoot, manifestPath));

describe("model alias manifest [FinalArch:LLM-002]", () => {
  it("matches the canonical routing contract and LiteLLM config shape [FinalArch:LLM-002]", () => {
    assert.deepEqual(validateModelAliases(), { aliasCount: 5, bindingCount: 8, fallbackCount: 3 });
  });

  it("rejects an application-visible raw provider model ID [FinalArch:LLM-002]", () => {
    const fixture = loadDocument(defaultRepoRoot, "contracts/model-routing/fixtures/raw-model-id.json");
    const manifest = cloneManifest();
    manifest.model_list[0].litellm_params.model = fixture.model;
    assert.throws(() => validateJsonSchemaDocument(schema, manifest), /invalid Draft 2020-12 schema or fixture/u);
  });

  it("rejects a fallback without preserved data classifications [FinalArch:LLM-002]", () => {
    const fixture = loadDocument(
      defaultRepoRoot,
      "contracts/model-routing/fixtures/fallback-missing-classification.json",
    );
    const manifest = cloneManifest();
    delete manifest.aiops_settings.fallbacks[0][fixture.remove];
    assert.throws(() => validateJsonSchemaDocument(schema, manifest), /invalid Draft 2020-12 schema or fixture/u);
  });

  it("fails closed for an unknown fallback error [FinalArch:LLM-002]", () => {
    const manifest = cloneManifest();
    manifest.aiops_settings.unknown_fallback_action = "fallback";
    assert.throws(() => validateJsonSchemaDocument(schema, manifest), /invalid Draft 2020-12 schema or fixture/u);
  });

  it("rejects an unguarded native LiteLLM fallback [FinalArch:LLM-002]", () => {
    const manifest = cloneManifest();
    manifest.router_settings.fallbacks = [{ "claude-standard": ["claude-standard-fallback"] }];
    assert.throws(() => validateJsonSchemaDocument(schema, manifest), /invalid Draft 2020-12 schema or fixture/u);
  });

  it("rejects classification drift between a source alias and its fallback binding [FinalArch:LLM-002]", () => {
    const manifest = cloneManifest();
    manifest.model_list.find(
      ({ model_name }) => model_name === "claude-standard-fallback",
    ).model_info.data_classifications = ["public"];
    assert.throws(() => validateModelAliases(defaultRepoRoot, manifest), /target classifications/u);
  });
});
