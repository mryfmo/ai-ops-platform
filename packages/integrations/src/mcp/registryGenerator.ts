// 根拠: FinalArch:MCP-001 / FinalArch:MCP-004 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T02

export const RISK_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"] as const;
export const FORBIDDEN_OPERATION_TOKENS = ["merge", "deploy", "delete", "permission"] as const;
const OWNERS = ["ai-coe", "devops", "prjops", "knowledge", "m365"] as const;
const AUTH_MODES = ["oauth", "github-app-or-oauth", "oauth-or-dedicated-integration", "delegated-obo"] as const;
const CALLERS = ["control-plane", "claude-runner", "droid-runner"] as const;

type RiskLevel = (typeof RISK_LEVELS)[number];
type Endpoint = { host: string; port: number; path: string };

export type GeneratedGatewaySections = {
  rules: string[];
  targets: Array<{ name: string; mcp: Endpoint }>;
};

const RULES_START = "      # BEGIN GENERATED P4-T02 MCP AUTHORIZATION RULES";
const RULES_END = "      # END GENERATED P4-T02 MCP AUTHORIZATION RULES";
const TARGETS_START = "  # BEGIN GENERATED P4-T02 MCP TARGETS";
const TARGETS_END = "  # END GENERATED P4-T02 MCP TARGETS";
const SAFE_NAME = /^[a-z][a-z0-9-]*$/u;
const SAFE_OPERATION = /^[a-z][a-z0-9_]*$/u;
const SAFE_HOST = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${where} must be a mapping`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[], where: string): void {
  const keys = Object.keys(value);
  const missing = required.filter((key) => !(key in value));
  const extra = keys.filter((key) => !required.includes(key) && !optional.includes(key));
  if (missing.length || extra.length) fail(`${where} keys invalid; missing=[${missing}] extra=[${extra}]`);
}

function string(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`${where} must be a non-empty string`);
  return value;
}

function strings(value: unknown, where: string, pattern: RegExp): string[] {
  if (!Array.isArray(value) || value.length === 0) fail(`${where} must be a non-empty array`);
  const result = value.map((item, index) => {
    const parsed = string(item, `${where}[${index}]`);
    if (!pattern.test(parsed)) fail(`${where}[${index}] has an invalid value`);
    return parsed;
  });
  if (new Set(result).size !== result.length) fail(`${where} must not contain duplicates`);
  return result;
}

function risk(value: unknown, where: string): RiskLevel {
  if (typeof value !== "string" || !(RISK_LEVELS as readonly string[]).includes(value)) {
    fail(`${where} must be a risk from L0 through L6`);
  }
  return value as RiskLevel;
}

function endpoint(value: unknown, where: string): Endpoint {
  const parsed = record(value, where);
  exactKeys(parsed, ["host", "port", "path"], [], where);
  const host = string(parsed.host, `${where}.host`);
  if (!SAFE_HOST.test(host)) fail(`${where}.host must be a hostname without scheme or port`);
  if (!Number.isInteger(parsed.port) || (parsed.port as number) < 1 || (parsed.port as number) > 65_535) {
    fail(`${where}.port must be an integer from 1 through 65535`);
  }
  const path = string(parsed.path, `${where}.path`);
  if (!path.startsWith("/") || /\s/u.test(path)) fail(`${where}.path must be an absolute path without whitespace`);
  return { host, port: parsed.port as number, path };
}

function validateLedger(value: unknown): Map<string, RiskLevel> {
  const ledger = record(value, "tool-risk ledger");
  exactKeys(ledger, ["schema_version", "levels", "operations", "forbidden_operation_tokens"], [], "tool-risk ledger");
  if (ledger.schema_version !== "1.0") fail("tool-risk ledger schema_version must be 1.0");

  const levels = record(ledger.levels, "tool-risk ledger levels");
  exactKeys(levels, [...RISK_LEVELS], [], "tool-risk ledger levels");
  for (const level of RISK_LEVELS) {
    const definition = record(levels[level], `tool-risk ledger levels.${level}`);
    exactKeys(definition, ["description", "default"], [], `tool-risk ledger levels.${level}`);
    string(definition.description, `tool-risk ledger levels.${level}.description`);
    string(definition.default, `tool-risk ledger levels.${level}.default`);
  }

  if (
    !Array.isArray(ledger.forbidden_operation_tokens) ||
    JSON.stringify(ledger.forbidden_operation_tokens) !== JSON.stringify(FORBIDDEN_OPERATION_TOKENS)
  ) {
    fail(`tool-risk forbidden_operation_tokens must equal [${FORBIDDEN_OPERATION_TOKENS.join(",")}]`);
  }

  const operations = record(ledger.operations, "tool-risk ledger operations");
  const result = new Map<string, RiskLevel>();
  for (const [operation, level] of Object.entries(operations)) {
    if (!SAFE_OPERATION.test(operation)) fail(`tool-risk operation ${operation} is invalid`);
    if (FORBIDDEN_OPERATION_TOKENS.some((token) => operation.includes(token))) {
      fail(`tool-risk operation ${operation} is a high-risk operation`);
    }
    const operationRisk = risk(level, `tool-risk operation ${operation}`);
    if (RISK_LEVELS.indexOf(operationRisk) >= RISK_LEVELS.indexOf("L4")) {
      fail(`tool-risk operation ${operation} cannot register runner-only or higher risk`);
    }
    result.set(operation, operationRisk);
  }
  return result;
}

function replaceGeneratedBlock(source: string, start: string, end: string, body: string): string {
  const startIndex = source.indexOf(start);
  const secondStart = source.indexOf(start, startIndex + start.length);
  const bodyStart = source.indexOf("\n", startIndex) + 1;
  const endIndex = source.indexOf(end, bodyStart);
  if (startIndex < 0 || secondStart >= 0 || bodyStart === 0 || endIndex < 0) {
    fail(`gateway config must contain exactly one ${start} / ${end} marker pair`);
  }
  return `${source.slice(0, bodyStart)}${body}${source.slice(endIndex)}`;
}

function yamlRule(rule: string): string {
  return rule === "false" ? JSON.stringify(rule) : `'${rule.replaceAll("'", "''")}'`;
}

export function generateGatewaySections(
  registryValue: unknown,
  ledgerValue: unknown,
  expectedSchemaHash: string,
): GeneratedGatewaySections {
  if (!/^[0-9a-f]{64}$/u.test(expectedSchemaHash)) fail("expected registry schema hash must be sha256 hex");
  const operationRisks = validateLedger(ledgerValue);
  const registry = record(registryValue, "MCP registry");
  exactKeys(registry, ["schema_version", "schema_hash", "entries"], [], "MCP registry");
  if (registry.schema_version !== "1.0") fail("MCP registry schema_version must be 1.0");
  if (registry.schema_hash !== expectedSchemaHash) fail("MCP registry schema_hash does not match the approved schema");
  if (!Array.isArray(registry.entries)) fail("MCP registry entries must be an array");

  const seenIds = new Set<string>();
  const enabled = registry.entries.map((entryValue, index) => {
    const where = `MCP registry entries[${index}]`;
    const entry = record(entryValue, where);
    exactKeys(
      entry,
      [
        "id",
        "enabled",
        "protocol",
        "transport",
        "owner",
        "version",
        "risk",
        "operations",
        "resources",
        "auth",
        "allowed_callers",
      ],
      ["endpoint"],
      where,
    );
    const id = string(entry.id, `${where}.id`);
    if (!SAFE_NAME.test(id)) fail(`${where}.id is invalid`);
    if (seenIds.has(id)) fail(`MCP registry id ${id} is duplicated`);
    seenIds.add(id);
    if (typeof entry.enabled !== "boolean") fail(`${where}.enabled must be boolean`);
    if (entry.protocol !== "mcp") fail(`${where}.protocol must be mcp`);
    if (entry.transport !== "streamable-http") fail(`${where}.transport must be streamable-http`);
    if (typeof entry.owner !== "string" || !(OWNERS as readonly string[]).includes(entry.owner)) {
      fail(`${where}.owner is not approved`);
    }
    if (entry.version !== "pinned") fail(`${where}.version must be pinned`);
    const declaredRisk = risk(entry.risk, `${where}.risk`);
    const operations = strings(entry.operations, `${where}.operations`, SAFE_OPERATION);
    string(entry.resources, `${where}.resources`);
    if (typeof entry.auth !== "string" || !(AUTH_MODES as readonly string[]).includes(entry.auth)) {
      fail(`${where}.auth is not approved`);
    }
    const callers = strings(entry.allowed_callers, `${where}.allowed_callers`, SAFE_NAME);
    if (callers.some((caller) => !(CALLERS as readonly string[]).includes(caller))) {
      fail(`${where}.allowed_callers contains an unapproved caller`);
    }

    const risks = operations.map((operation) => {
      if (FORBIDDEN_OPERATION_TOKENS.some((token) => operation.includes(token))) {
        fail(`${where} contains high-risk operation ${operation}`);
      }
      const operationRisk = operationRisks.get(operation);
      if (!operationRisk) fail(`${where} operation ${operation} is absent from the tool-risk ledger`);
      return operationRisk;
    });
    const maximumRisk = risks.reduce((maximum, current) =>
      RISK_LEVELS.indexOf(current) > RISK_LEVELS.indexOf(maximum) ? current : maximum,
    );
    if (declaredRisk !== maximumRisk) fail(`${where}.risk must equal operation ceiling ${maximumRisk}`);

    const parsedEndpoint = entry.endpoint === undefined ? undefined : endpoint(entry.endpoint, `${where}.endpoint`);
    if (entry.enabled && !parsedEndpoint) fail(`${where}.endpoint is required when enabled=true`);
    return { id, enabled: entry.enabled, operations, callers, endpoint: parsedEndpoint };
  });

  const entries = enabled.filter((entry) => entry.enabled).sort((left, right) => left.id.localeCompare(right.id));
  if (entries.length === 0) return { rules: ["false"], targets: [] };

  return {
    rules: entries.flatMap((entry) =>
      [...entry.operations]
        .sort()
        .map(
          (operation) =>
            `jwt.sub in ${JSON.stringify([...entry.callers].sort())} && mcp.tool.target == ${JSON.stringify(entry.id)} && mcp.tool.name == ${JSON.stringify(operation)}`,
        ),
    ),
    targets: entries.map((entry) => ({ name: entry.id, mcp: entry.endpoint as Endpoint })),
  };
}

export function renderGatewaySections(sections: GeneratedGatewaySections): string {
  return `${[
    "# 根拠: FinalArch:MCP-001 / FinalArch:MCP-004 / ADR-0023 / WBS P4-T02",
    "rules:",
    ...sections.rules.map((rule) => `  - ${yamlRule(rule)}`),
    ...(sections.targets.length === 0
      ? ["targets: []"]
      : [
          "targets:",
          ...sections.targets.flatMap((target) => [
            `  - name: ${JSON.stringify(target.name)}`,
            "    mcp:",
            `      host: ${JSON.stringify(target.mcp.host)}`,
            `      port: ${target.mcp.port}`,
            `      path: ${JSON.stringify(target.mcp.path)}`,
          ]),
        ]),
  ].join("\n")}\n`;
}

export function renderGatewayConfig(source: string, sections: GeneratedGatewaySections): string {
  const rules = `${sections.rules.map((rule) => `        - ${yamlRule(rule)}`).join("\n")}\n`;
  const targets =
    sections.targets.length === 0
      ? "  targets: []\n"
      : `${[
          "  targets:",
          ...sections.targets.flatMap((target) => [
            `    - name: ${JSON.stringify(target.name)}`,
            "      mcp:",
            `        host: ${JSON.stringify(target.mcp.host)}`,
            `        port: ${target.mcp.port}`,
            `        path: ${JSON.stringify(target.mcp.path)}`,
          ]),
        ].join("\n")}\n`;
  return replaceGeneratedBlock(
    replaceGeneratedBlock(source, RULES_START, RULES_END, `      rules:\n${rules}`),
    TARGETS_START,
    TARGETS_END,
    targets,
  );
}
