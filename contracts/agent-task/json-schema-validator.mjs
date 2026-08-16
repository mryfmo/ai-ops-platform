// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-003 / FinalArch:COD-004 / ADR-0027 / WBS P8-T01 / WBS P8-T02
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
export const defaultRepoRoot = path.resolve(directory, "../..");
const SUPPORTED_KEYWORDS = new Set([
  "$comment",
  "$defs",
  "$id",
  "$ref",
  "$schema",
  "additionalProperties",
  "const",
  "contains",
  "enum",
  "exclusiveMinimum",
  "items",
  "maxItems",
  "maxLength",
  "minItems",
  "minLength",
  "minimum",
  "pattern",
  "properties",
  "required",
  "type",
  "uniqueItems",
]);

function fail(location, rule) {
  throw new TypeError(`${location} ${rule}`);
}

function resolveRef(root, ref) {
  if (!ref.startsWith("#/")) fail("schema", `uses unsupported reference ${ref}`);
  let value = root;
  for (const token of ref.slice(2).split("/")) {
    value = value?.[token.replaceAll("~1", "/").replaceAll("~0", "~")];
  }
  if (value === undefined) fail("schema", `has unresolved reference ${ref}`);
  return value;
}

function assertSupportedSchema(schema, location = "schema") {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) fail(location, "must be an object");
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) fail(location, `uses unsupported keyword ${keyword}`);
  }
  for (const [name, child] of Object.entries(schema.$defs ?? {})) {
    assertSupportedSchema(child, `${location}/$defs/${name}`);
  }
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    assertSupportedSchema(child, `${location}/properties/${name}`);
  }
  if ("items" in schema) assertSupportedSchema(schema.items, `${location}/items`);
  if ("contains" in schema) assertSupportedSchema(schema.contains, `${location}/contains`);
  if ("additionalProperties" in schema && schema.additionalProperties !== false) {
    fail(location, "uses unsupported additionalProperties form");
  }
}

function matchesType(type, value) {
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}

function validate(schema, value, root, location) {
  if (schema.$ref) validate(resolveRef(root, schema.$ref), value, root, location);
  if ("const" in schema && !isDeepStrictEqual(value, schema.const)) fail(location, "does not match const");
  if (schema.enum && !schema.enum.some((item) => isDeepStrictEqual(item, value))) fail(location, "is not in enum");
  if (schema.type && !matchesType(schema.type, value)) fail(location, `must be ${schema.type}`);

  if (typeof value === "string") {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) fail(location, "is too short");
    if (schema.maxLength !== undefined && length > schema.maxLength) fail(location, "is too long");
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) fail(location, "does not match pattern");
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) fail(location, "is below minimum");
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      fail(location, "is below exclusive minimum");
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(location, "has too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(location, "has too many items");
    if (
      schema.uniqueItems &&
      value.some((item, index) => value.slice(index + 1).some((peer) => isDeepStrictEqual(item, peer)))
    ) {
      fail(location, "has duplicate items");
    }
    if (schema.contains && !value.some((item, index) => isValid(schema.contains, item, root, `${location}/${index}`))) {
      fail(location, "does not contain a required item");
    }
    if (schema.items) value.forEach((item, index) => validate(schema.items, item, root, `${location}/${index}`));
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) fail(location, `is missing ${required}`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) fail(`${location}/${key}`, "is not allowed");
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) validate(childSchema, value[key], root, `${location}/${key}`);
    }
  }
}

function isValid(schema, value, root, location) {
  try {
    validate(schema, value, root, location);
    return true;
  } catch {
    return false;
  }
}

export function validateJsonSchemaDocument(schema, instance, _repoRoot = defaultRepoRoot) {
  try {
    assertSupportedSchema(schema);
    validate(schema, instance, schema, "$");
  } catch (error) {
    throw new TypeError(`invalid Draft 2020-12 schema or fixture\n${error.message}`);
  }
}
