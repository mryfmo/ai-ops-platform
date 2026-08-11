// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / FinalArch:CON-004 / FinalArch:CON-005 / FinalArch:PRD-003 / FinalArch:FR-CP-001 / ADR-0020
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import YAML from "yaml";

const CONTRACT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const defaultRepoRoot = path.resolve(CONTRACT_DIR, "..");

const STRUCTURAL_CONTAINERS = new Set([
  "$defs",
  "channels",
  "components",
  "content",
  "messages",
  "operations",
  "paths",
  "properties",
  "responses",
  "schemas",
]);
const HTTP_METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put", "trace"]);
const EXACT_PROTOCOL_KEYS = new Set(["action", "address", "in", "name", "operationId"]);
const CONSTRAINT_ARRAYS = new Set(["allOf", "anyOf", "oneOf", "prefixItems", "security"]);
const REQUIRED_PROTOCOL_KEYS = new Set([
  "action",
  "address",
  "channel",
  "content",
  "headers",
  "messages",
  "payload",
  "requestBody",
  "schema",
]);

function fail(message) {
  throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readText(repoRoot, relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

export function loadDocument(repoRoot, relativePath) {
  const source = readText(repoRoot, relativePath);
  return relativePath.endsWith(".json") ? JSON.parse(source) : YAML.parse(source, { uniqueKeys: true });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function decodePointerToken(token) {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolveInternalRef(document, ref) {
  if (!ref.startsWith("#/")) return;
  let value = document;
  for (const token of ref.slice(2).split("/").map(decodePointerToken)) {
    if (!isObject(value) && !Array.isArray(value)) fail(`unresolved internal ref ${ref}`);
    if (!(token in value)) fail(`unresolved internal ref ${ref}`);
    value = value[token];
  }
}

function assertInternalRefs(document) {
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!isObject(value)) return;
    if (typeof value.$ref === "string") resolveInternalRef(document, value.$ref);
    Object.values(value).forEach(visit);
  };
  visit(document);
}

function assertContractShape(entry, document, contractVersion) {
  if (!isObject(document)) fail(`${entry.current}: root must be an object`);
  if (entry.kind === "openapi") {
    if (document.openapi !== "3.1.0") fail(`${entry.current}: openapi must be 3.1.0`);
    if (document.info?.version !== contractVersion) fail(`${entry.current}: unexpected info.version`);
    if (document["x-aiops-contract-version"] !== "v1") fail(`${entry.current}: missing version marker`);
    if (!isObject(document.paths) || !isObject(document.components?.schemas)) {
      fail(`${entry.current}: paths and components.schemas are required`);
    }
  } else if (entry.kind === "asyncapi") {
    if (document.asyncapi !== "3.0.0") fail(`${entry.current}: asyncapi must be 3.0.0`);
    if (document.info?.version !== contractVersion) fail(`${entry.current}: unexpected info.version`);
    if (document["x-aiops-contract-version"] !== "v1") fail(`${entry.current}: missing version marker`);
    if (!isObject(document.channels) || !isObject(document.operations) || !isObject(document.components?.schemas)) {
      fail(`${entry.current}: channels, operations, and components.schemas are required`);
    }
  } else if (entry.kind === "json-schema") {
    if (document.$schema !== "https://json-schema.org/draft/2020-12/schema") {
      fail(`${entry.current}: JSON Schema draft must be 2020-12`);
    }
    if (typeof document.$id !== "string" || !document.$id.endsWith("/v1")) {
      fail(`${entry.current}: $id must identify v1`);
    }
    if (document.type !== "object") fail(`${entry.current}: root type must be object`);
  } else {
    fail(`${entry.current}: unsupported contract kind ${entry.kind}`);
  }
  assertInternalRefs(document);
}

function lintApiContracts(repoRoot) {
  const executable = path.join(repoRoot, "contracts", "node_modules", ".bin", "spectral");
  if (!fs.existsSync(executable)) fail("contract linter missing; run pnpm --dir contracts install");
  execFileSync(
    executable,
    [
      "lint",
      "--ruleset",
      path.join(repoRoot, "contracts", ".spectral.yaml"),
      "--fail-severity",
      "error",
      path.join(repoRoot, "contracts", "openapi", "*.yaml"),
      path.join(repoRoot, "contracts", "asyncapi", "*.yaml"),
    ],
    { stdio: "pipe" },
  );
}

function lintSchemaInstance(executable, directory, schema, instance, name) {
  const ruleset = path.join(directory, `${name}.ruleset.json`);
  const fixture = path.join(directory, `${name}.fixture.json`);
  fs.writeFileSync(
    ruleset,
    JSON.stringify({
      rules: {
        [name]: {
          severity: "error",
          given: "$",
          then: { function: "schema", functionOptions: { dialect: "draft2020-12", schema } },
        },
      },
    }),
  );
  fs.writeFileSync(fixture, JSON.stringify(instance));
  return spawnSync(executable, ["lint", "--ruleset", ruleset, "--fail-severity", "error", fixture], {
    encoding: "utf8",
  });
}

export function validateJsonSchemaDocument(schema, instance, repoRoot = defaultRepoRoot) {
  const executable = path.join(repoRoot, "contracts", "node_modules", ".bin", "spectral");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiops-json-schema-"));
  try {
    const result = lintSchemaInstance(executable, directory, schema, instance, "schema-validation");
    if (result.status !== 0) fail(`invalid Draft 2020-12 schema or fixture\n${result.stdout}${result.stderr}`);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
}

function assertJsonSchemaFixtures(repoRoot, documents) {
  const executable = path.join(repoRoot, "contracts", "node_modules", ".bin", "spectral");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiops-schema-contract-"));
  try {
    const policyInput = JSON.parse(readText(repoRoot, "contracts/fixtures/policy-input.valid.json"));
    const policyDecision = JSON.parse(readText(repoRoot, "contracts/fixtures/policy-decision.valid.json"));
    for (const [name, schema, fixture] of [
      ["domain-schema", documents.get("domain"), {}],
      ["policy-input-schema", documents.get("policy-input"), policyInput],
      ["policy-decision-schema", documents.get("policy-decision"), policyDecision],
    ]) {
      const result = lintSchemaInstance(executable, directory, schema, fixture, name);
      if (result.status !== 0) fail(`${name} is invalid\n${result.stdout}${result.stderr}`);
    }

    const unknown = JSON.parse(readText(repoRoot, "contracts/fixtures/policy-input.unknown-field.json"));
    const oversized = structuredClone(policyInput);
    oversized.actor.groups = Array.from({ length: 1001 }, (_, index) => `group-${index}`);
    if (
      lintSchemaInstance(executable, directory, documents.get("policy-input"), unknown, "unknown-field").status === 0
    ) {
      fail("policy schema accepted an unknown nested field");
    }
    if (lintSchemaInstance(executable, directory, documents.get("policy-input"), oversized, "oversized").status === 0) {
      fail("policy schema accepted oversized input");
    }
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
}

function assertGeneratedClient(openapi) {
  const operations = [];
  for (const [route, pathItem] of Object.entries(openapi.paths)) {
    for (const method of HTTP_METHODS) {
      if (!pathItem[method]) continue;
      operations.push({
        id: pathItem[method].operationId ?? `${method}:${route}`,
        method: method.toUpperCase(),
        route,
      });
    }
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aiops-openapi-client-"));
  const clientPath = path.join(directory, "client.mjs");
  try {
    fs.writeFileSync(
      clientPath,
      `export const operations = ${JSON.stringify(operations)};\n` +
        "export const createClient = (baseUrl, request = fetch) => Object.fromEntries(operations.map((operation) => [operation.id, (body) => request(new URL(operation.route.replace(/^\\//u, ''), `${baseUrl.replace(/\\/?$/u, '/')}`), { method: operation.method, body: body === undefined ? undefined : JSON.stringify(body) })]));\n",
    );
    const url = pathToFileURL(clientPath).href;
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `const client = await import(${JSON.stringify(url)}); let requested; await client.createClient("https://host.example/api/control/v1", (url) => { requested = url.href; })[client.operations[0].id](); if (client.operations.length !== ${operations.length} || requested !== "https://host.example/api/control/v1/workflows") process.exit(1);`,
      ],
      { stdio: "pipe" },
    );
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
}

function extractedStringArray(source, constantName) {
  const declaration = new RegExp(`export const ${constantName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`, "u").exec(
    source,
  );
  if (!declaration) fail(`could not read ${constantName}`);
  return [...declaration[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

function extractedStringUnion(source, typeName) {
  const declaration = new RegExp(`export type ${typeName}\\s*=\\s*([^;]+);`, "u").exec(source);
  if (!declaration) fail(`could not read ${typeName}`);
  return [...declaration[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

function extractedSchemaVersion(source) {
  const declaration = /interface VersionedPayload<[^>]+>[\s\S]*?schemaVersion:\s*([0-9]+);/u.exec(source);
  if (!declaration) fail("could not read VersionedPayload.schemaVersion");
  return Number(declaration[1]);
}

function assertSameArray(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertRuntimeConsistency(repoRoot, manifest, documents) {
  const controlPlaneSource = readText(repoRoot, "packages/control-plane/src/contracts/index.ts");
  const workflowKinds = extractedStringArray(controlPlaneSource, "WORKFLOW_KINDS");
  const openapi = documents.get("control-api");
  const domain = documents.get("domain");
  const events = documents.get("events");
  const schemaVersion = extractedSchemaVersion(controlPlaneSource);
  if (manifest.controlPlane.versionedPayloadSchemaVersion !== schemaVersion) {
    fail("provenance schemaVersion must match VersionedPayload.schemaVersion");
  }

  assertSameArray(
    openapi.components.schemas.StartWorkflowRequest.properties.workflowType.enum,
    workflowKinds,
    "OpenAPI workflow kinds",
  );
  assertSameArray(domain.$defs.workflowKind.enum, workflowKinds, "domain workflow kinds");

  for (const [label, schema] of [
    ["OpenAPI VersionedPayload", openapi.components.schemas.VersionedPayload],
    ["domain versionedPayload", domain.$defs.versionedPayload],
  ]) {
    if (schema?.additionalProperties !== false) fail(`${label}: additionalProperties must be false`);
    assertSameArray(schema.required, ["schemaVersion", "payload"], `${label} required`);
    if (schema.properties?.schemaVersion?.const !== schemaVersion) {
      fail(`${label}: schemaVersion must be ${schemaVersion}`);
    }
  }

  const eventVersion = events.components.schemas.EventEnvelope.properties.schemaVersion;
  if (eventVersion.type !== "string" || eventVersion.pattern !== "^v[0-9]+$") {
    fail("AsyncAPI event schemaVersion must retain its explicit vN protocol version");
  }

  const policySource = readText(repoRoot, "packages/policy/src/contracts.ts");
  const policyInput = documents.get("policy-input");
  const policyDecision = documents.get("policy-decision");
  for (const [label, actual, expected] of [
    [
      "policy risk levels",
      policyInput.properties.action.properties.riskLevel.enum,
      extractedStringArray(policySource, "RISK_LEVELS"),
    ],
    ["actor types", policyInput.properties.actor.properties.type.enum, extractedStringUnion(policySource, "ActorType")],
    ["agent kinds", policyInput.properties.agent.properties.kind.enum, extractedStringUnion(policySource, "AgentKind")],
    [
      "tool protocols",
      policyInput.properties.action.properties.protocol.enum,
      extractedStringUnion(policySource, "ToolProtocol"),
    ],
    [
      "resource classifications",
      policyInput.properties.resource.properties.classification.enum,
      extractedStringUnion(policySource, "ResourceClassification"),
    ],
    [
      "policy environments",
      policyInput.properties.context.properties.environment.enum,
      extractedStringUnion(policySource, "PolicyEnvironment"),
    ],
    [
      "provider candidates",
      policyInput.properties.context.properties.providerCandidate.enum,
      extractedStringUnion(policySource, "ProviderCandidate"),
    ],
    [
      "source trust values",
      policyInput.properties.context.properties.sourceTrust.enum,
      extractedStringUnion(policySource, "SourceTrust"),
    ],
    [
      "policy decisions",
      policyDecision.properties.decision.enum,
      extractedStringUnion(policySource, "PolicyDecisionValue"),
    ],
    [
      "decision providers",
      policyDecision.properties.obligations.properties.allowedProvider.enum,
      extractedStringUnion(policySource, "ProviderCandidate"),
    ],
  ]) {
    assertSameArray(actual, expected, label);
  }
  for (const name of ["actor", "agent", "action", "resource", "context"]) {
    if (policyInput.properties[name].additionalProperties !== false) {
      fail(`policy input ${name}: additionalProperties must be false`);
    }
  }
  if (policyDecision.properties.obligations.additionalProperties !== false) {
    fail("policy decision obligations: additionalProperties must be false");
  }
}

function parameterIdentity(value) {
  if (!isObject(value)) return JSON.stringify(value);
  return value.$ref ?? `${value.in ?? ""}:${value.name ?? ""}`;
}

function compareArray(baseline, current, pointer, issues) {
  const key = pointer.at(-1);
  if (key === "required") {
    for (const item of current)
      if (!baseline.includes(item)) issues.push(`${pointer.join("/")}: added required ${item}`);
    for (const item of baseline)
      if (!current.includes(item)) issues.push(`${pointer.join("/")}: removed required ${item}`);
    return;
  }
  if (key === "enum") {
    for (const item of baseline) if (!current.includes(item)) issues.push(`${pointer.join("/")}: removed enum ${item}`);
    for (const item of current) if (!baseline.includes(item)) issues.push(`${pointer.join("/")}: added enum ${item}`);
    return;
  }
  if (key === "parameters") {
    const baselineIds = new Set(baseline.map(parameterIdentity));
    for (const baselineParameter of baseline) {
      const identity = parameterIdentity(baselineParameter);
      const currentParameter = current.find((candidate) => parameterIdentity(candidate) === identity);
      if (!currentParameter) issues.push(`${pointer.join("/")}: removed parameter ${identity}`);
      else compareNode(baselineParameter, currentParameter, [...pointer, identity], issues);
    }
    for (const currentParameter of current) {
      const identity = parameterIdentity(currentParameter);
      if (!baselineIds.has(identity) && currentParameter?.required === true) {
        issues.push(`${pointer.join("/")}: added required parameter ${identity}`);
      }
    }
    return;
  }
  if (key === "security" && JSON.stringify(current) !== JSON.stringify(baseline)) {
    issues.push(`${pointer.join("/")}: changed security requirements`);
  } else if (CONSTRAINT_ARRAYS.has(key) && current.length > baseline.length) {
    issues.push(`${pointer.join("/")}: added constraint item`);
  }
  for (let index = 0; index < baseline.length; index += 1) {
    if (index >= current.length) issues.push(`${pointer.join("/")}: removed item ${index}`);
    else compareNode(baseline[index], current[index], [...pointer, String(index)], issues);
  }
}

function compareConstraints(baseline, current, pointer, issues) {
  const label = pointer.join("/") || "root";
  const baselineType = typeof baseline.type === "string" || Array.isArray(baseline.type) ? baseline.type : undefined;
  const currentType = typeof current.type === "string" || Array.isArray(current.type) ? current.type : undefined;
  if (
    (baselineType !== undefined || currentType !== undefined) &&
    JSON.stringify(currentType) !== JSON.stringify(baselineType)
  ) {
    issues.push(`${label}: changed type`);
  }
  const baselineRef = typeof baseline.$ref === "string" ? baseline.$ref : undefined;
  const currentRef = typeof current.$ref === "string" ? current.$ref : undefined;
  if ((baselineRef !== undefined || currentRef !== undefined) && currentRef !== baselineRef) {
    issues.push(`${label}: changed $ref`);
  }
  if ("const" in baseline && JSON.stringify(current.const) !== JSON.stringify(baseline.const)) {
    issues.push(`${label}: changed const`);
  } else if (!("const" in baseline) && "const" in current) {
    issues.push(`${label}: added const`);
  }
  if (!Array.isArray(baseline.enum) && Array.isArray(current.enum)) {
    issues.push(`${label}: added enum constraint`);
  }
  if (!Array.isArray(baseline.required) && Array.isArray(current.required) && current.required.length > 0) {
    issues.push(`${label}: added required fields`);
  }
  for (const key of ["allOf", "anyOf", "oneOf", "not"]) {
    if (!(key in baseline) && key in current) issues.push(`${label}: added ${key} constraint`);
  }
  for (const key of ["format", "pattern"]) {
    if (key in current && current[key] !== baseline[key]) issues.push(`${label}: added or changed ${key}`);
  }
  for (const key of ["minimum", "exclusiveMinimum", "minLength", "minItems", "minProperties", "minContains"]) {
    if (key in current && (!(key in baseline) || current[key] > baseline[key]))
      issues.push(`${label}: tightened ${key}`);
  }
  for (const key of ["maximum", "exclusiveMaximum", "maxLength", "maxItems", "maxProperties", "maxContains"]) {
    if (key in current && (!(key in baseline) || current[key] < baseline[key]))
      issues.push(`${label}: tightened ${key}`);
  }
  if (baseline.additionalProperties !== false && current.additionalProperties === false) {
    issues.push(`${label}: disallowed additional properties`);
  }
  if (
    baseline.additionalProperties !== false &&
    isObject(current.additionalProperties) &&
    JSON.stringify(current.additionalProperties) !== JSON.stringify(baseline.additionalProperties)
  ) {
    issues.push(`${label}: restricted additional properties`);
  }
  if (baseline.unevaluatedProperties !== false && current.unevaluatedProperties === false) {
    issues.push(`${label}: disallowed unevaluated properties`);
  }
  if (baseline.uniqueItems !== true && current.uniqueItems === true) issues.push(`${label}: required unique items`);
  if ("multipleOf" in current && current.multipleOf !== baseline.multipleOf) {
    issues.push(`${label}: added or changed multipleOf`);
  }
  for (const key of ["contains", "propertyNames", "dependentRequired", "dependentSchemas", "if", "then", "else"]) {
    if (!(key in baseline) && key in current) issues.push(`${label}: added ${key} constraint`);
  }
  if (baseline.required !== true && current.required === true) issues.push(`${label}: made request member required`);
  if (!("requestBody" in baseline) && current.requestBody?.required === true) {
    issues.push(`${label}: added required request body`);
  }
}

function compareNode(baseline, current, pointer, issues) {
  if (Array.isArray(baseline)) {
    if (!Array.isArray(current)) issues.push(`${pointer.join("/")}: changed array shape`);
    else compareArray(baseline, current, pointer, issues);
    return;
  }
  if (!isObject(baseline)) {
    const key = pointer.at(-1);
    if (EXACT_PROTOCOL_KEYS.has(key) && baseline !== current) {
      issues.push(`${pointer.join("/")}: changed value`);
    }
    return;
  }
  if (!isObject(current)) {
    issues.push(`${pointer.join("/")}: changed object shape`);
    return;
  }

  if (
    ("security" in baseline || "security" in current) &&
    JSON.stringify(current.security) !== JSON.stringify(baseline.security)
  ) {
    issues.push(`${[...pointer, "security"].join("/")}: changed security requirements`);
  }
  compareConstraints(baseline, current, pointer, issues);
  const container = pointer.at(-1);
  for (const [key, baselineValue] of Object.entries(baseline)) {
    if (key === "security") continue;
    if (!(key in current)) {
      if (
        STRUCTURAL_CONTAINERS.has(container) ||
        HTTP_METHODS.has(key) ||
        REQUIRED_PROTOCOL_KEYS.has(key) ||
        key === "$ref" ||
        key === "type"
      ) {
        issues.push(`${[...pointer, key].join("/")}: removed`);
      }
      continue;
    }
    compareNode(baselineValue, current[key], [...pointer, key], issues);
  }
}

export function compatibilityIssues(baseline, current) {
  const issues = [];
  compareNode(baseline, current, [], issues);
  return issues;
}

export function validateContracts(repoRoot = defaultRepoRoot) {
  lintApiContracts(repoRoot);
  const manifest = JSON.parse(readText(repoRoot, "contracts/provenance.json"));
  const documents = new Map();
  for (const entry of manifest.contracts) {
    const actualCanonicalHash = sha256(readText(repoRoot, entry.canonical));
    if (actualCanonicalHash !== entry.canonicalSha256) {
      fail(`${entry.id}: canonical source hash drifted; import a new version explicitly`);
    }
    const current = loadDocument(repoRoot, entry.current);
    const baseline = loadDocument(repoRoot, entry.baseline);
    const canonical = loadDocument(repoRoot, entry.canonical);
    assertContractShape(entry, current, manifest.contractVersion);
    assertContractShape({ ...entry, current: entry.baseline }, baseline, manifest.contractVersion);
    const canonicalIssues = compatibilityIssues(canonical, current).sort();
    const allowedCanonicalIssues = [...(entry.canonicalCompatibilityExceptions ?? [])].sort();
    if (JSON.stringify(canonicalIssues) !== JSON.stringify(allowedCanonicalIssues)) {
      fail(
        `${entry.id}: derived contract drifted from its canonical source\nexpected ${JSON.stringify(allowedCanonicalIssues)}\ngot ${JSON.stringify(canonicalIssues)}`,
      );
    }
    const issues = compatibilityIssues(baseline, current);
    if (issues.length > 0) fail(`${entry.id}: backward compatibility failed\n- ${issues.join("\n- ")}`);
    documents.set(entry.id, current);
  }
  assertRuntimeConsistency(repoRoot, manifest, documents);
  assertJsonSchemaFixtures(repoRoot, documents);
  assertGeneratedClient(documents.get("control-api"));
  return { contractCount: manifest.contracts.length, contractVersion: manifest.contractVersion };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = validateContracts();
  console.log(`OK: ${result.contractCount} versioned contracts (${result.contractVersion}) are valid and compatible.`);
}
