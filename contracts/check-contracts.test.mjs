// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / FinalArch:CON-004 / FinalArch:CON-005 / FinalArch:FR-CP-001 / ADR-0020
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compatibilityIssues,
  defaultRepoRoot,
  loadDocument,
  validateContracts,
  validateJsonSchemaDocument,
} from "./check-contracts.mjs";

const clone = (value) => structuredClone(value);
const baselineOpenApi = loadDocument(defaultRepoRoot, "contracts/baseline/v1/openapi/control-api.v1.yaml");
const baselineDomain = loadDocument(defaultRepoRoot, "contracts/baseline/v1/schemas/domain.v1.schema.json");
const baselinePolicyInput = loadDocument(defaultRepoRoot, "contracts/baseline/v1/schemas/policy-input.v1.schema.json");
const baselineEvents = loadDocument(defaultRepoRoot, "contracts/baseline/v1/asyncapi/events.v1.yaml");

describe("versioned contract validation [FinalArch:CON-001, FinalArch:CON-002, FinalArch:CON-004, FinalArch:CON-005]", () => {
  it("validates provenance, refs, runtime parity, and the stored baseline [FinalArch:CON-001, FinalArch:CON-002]", () => {
    assert.deepEqual(validateContracts(), { contractCount: 5, contractVersion: "1.0.0-draft" });
  });

  it("rejects a removed OpenAPI operation [FinalArch:CON-001]", () => {
    const current = clone(baselineOpenApi);
    delete current.paths["/workflows"].post;
    assert.match(compatibilityIssues(baselineOpenApi, current).join("\n"), /post: removed/u);
  });

  it("rejects newly required fields and removed enum values [FinalArch:CON-002, FinalArch:CON-004]", () => {
    const domain = clone(baselineDomain);
    domain.$defs.sourceReference.required.push("version");
    assert.match(compatibilityIssues(baselineDomain, domain).join("\n"), /added required version/u);

    const policy = clone(baselinePolicyInput);
    policy.properties.action.properties.riskLevel.enum.pop();
    assert.match(compatibilityIssues(baselinePolicyInput, policy).join("\n"), /removed enum L6/u);

    const constrained = clone(baselineDomain);
    constrained.$defs.sourceReference.properties.approvalStatus.enum = ["approved"];
    assert.match(compatibilityIssues(baselineDomain, constrained).join("\n"), /added enum constraint/u);
  });

  it("rejects a newly required OpenAPI parameter [FinalArch:CON-001]", () => {
    const current = clone(baselineOpenApi);
    current.paths["/workflows/{workflowId}"].get.parameters.push({
      name: "tenantId",
      in: "header",
      required: true,
      schema: { type: "string" },
    });
    assert.match(compatibilityIssues(baselineOpenApi, current).join("\n"), /added required parameter header:tenantId/u);
  });

  it("rejects protocol scalar and constraint-array changes [FinalArch:CON-001, FinalArch:CON-002]", () => {
    const events = clone(baselineEvents);
    events.channels.workflowEvents.address = "renamed.events.v1";
    assert.match(compatibilityIssues(baselineEvents, events).join("\n"), /address: changed value/u);

    const secured = clone(baselineOpenApi);
    secured.paths["/health/live"].get.security = [{ bearerAuth: [] }];
    assert.match(compatibilityIssues(baselineOpenApi, secured).join("\n"), /security: changed security requirements/u);

    const response = clone(baselineOpenApi);
    delete response.paths["/workflows"].post.responses["202"].content;
    assert.match(compatibilityIssues(baselineOpenApi, response).join("\n"), /content: removed/u);

    const publicOperation = clone(baselineOpenApi);
    publicOperation.paths["/workflows"].post.security = [];
    assert.match(compatibilityIssues(baselineOpenApi, publicOperation).join("\n"), /security requirements/u);

    const inheritedSecurity = clone(baselineOpenApi);
    delete inheritedSecurity.paths["/health/live"].get.security;
    assert.match(compatibilityIssues(baselineOpenApi, inheritedSecurity).join("\n"), /security requirements/u);
  });

  it("preserves required event fields for N-1 consumers [FinalArch:CON-002]", () => {
    const events = clone(baselineEvents);
    events.components.schemas.EventEnvelope.required = events.components.schemas.EventEnvelope.required.filter(
      (field) => field !== "correlationId",
    );
    assert.match(compatibilityIssues(baselineEvents, events).join("\n"), /removed required correlationId/u);
  });

  it("rejects less-common tightened JSON Schema constraints [FinalArch:CON-004]", () => {
    const minimum = clone(baselineDomain);
    minimum.$defs.evidenceItem.properties.confidence.exclusiveMinimum = 0;
    assert.match(compatibilityIssues(baselineDomain, minimum).join("\n"), /tightened exclusiveMinimum/u);

    const unique = clone(baselineDomain);
    unique.$defs.agentTaskManifest.properties.allowedPaths.uniqueItems = true;
    assert.match(compatibilityIssues(baselineDomain, unique).join("\n"), /required unique items/u);

    const multiple = clone(baselineDomain);
    multiple.$defs.evidenceItem.properties.confidence.multipleOf = 0.1;
    assert.match(compatibilityIssues(baselineDomain, multiple).join("\n"), /added or changed multipleOf/u);

    const additionalProperties = clone(baselineDomain);
    additionalProperties.$defs.agentTaskManifest.properties.forbiddenPaths.additionalProperties = { type: "string" };
    assert.match(
      compatibilityIssues(baselineDomain, additionalProperties).join("\n"),
      /restricted additional properties/u,
    );

    const objectConst = clone(baselineDomain);
    objectConst.$defs.agentTaskManifest.properties.forbiddenPaths.const = {};
    assert.match(compatibilityIssues(baselineDomain, objectConst).join("\n"), /added const/u);
  });

  it("rejects unknown and oversized policy input [FinalArch:CON-004]", () => {
    assert.doesNotThrow(() => validateContracts());
  });

  it("rejects malformed Draft 2020-12 schemas [FinalArch:CON-001, FinalArch:CON-004]", () => {
    const malformed = clone(baselineDomain);
    malformed.$defs.evidenceItem.properties.confidence.minimum = "not-a-number";
    assert.throws(() => validateJsonSchemaDocument(malformed, {}), /invalid Draft 2020-12 schema/u);
  });

  it("allows an optional additive field [FinalArch:CON-001]", () => {
    const current = clone(baselineDomain);
    current.$defs.sourceReference.properties.displayName = { type: "string" };
    assert.deepEqual(compatibilityIssues(baselineDomain, current), []);
  });
});
