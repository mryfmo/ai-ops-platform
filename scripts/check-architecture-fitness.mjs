// 根拠: FinalArch:INV-005 / FinalArch:INV-006 / FinalArch:INV-009 / FinalArch:INV-013 / FinalArch:INV-019 / FinalArch:INV-020 / FinalArch:GOV-004 / FinalArch:GOV-005
import fs from "node:fs";
import YAML from "yaml";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FLAG_CONTRACT = "docs/plans/2026-08-final-architecture/06_implementation/08_feature_flags.yaml";
const FLAG_REGISTRY = "packages/shared/src/migration/featureFlags.ts";
const MCP_REGISTRY = "docs/plans/2026-08-final-architecture/05_contracts/mcp-registry-manifest.yaml";
const TOOL_CATALOG = "docs/plans/2026-08-final-architecture/05_contracts/tool-risk-catalog.yaml";
const INVARIANT_MATRIX = "docs/plans/2026-08-final-architecture/06_implementation/11_architecture_fitness_matrix.md";
const WBS_CONTRACT = "docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml";
const EXTERNAL_ALLOWLIST = new Set(["api.anthropic.com", "api.github.com", "github.com", "graph.microsoft.com"]);
const EXTERNAL_SDK_IMPORT = /from\s+["'](?:@anthropic-ai\/(?:sdk|claude-agent-sdk)|@azure\/msal-node)["']/gu;
const GRANDFATHERED_EXTERNAL_CLIENTS = new Set([
  "packages/server/src/auth/graphTokenProvider.ts",
  "packages/server/src/index.ts",
]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".orchestration",
  ".pnpm-store",
  "coverage",
  "dist",
  "node_modules",
  "tests",
]);

function walk(root, directory = root) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(root, absolute));
    else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
  return files;
}

function unquote(value) {
  return value.trim().replace(/^(['"])(.*)\1$/u, "$2");
}

function isRuntimeConfig(relativePath) {
  if (!/\.(?:json|toml|ya?ml)$/u.test(relativePath)) return false;
  return /^(?:\.github|config|deploy|ops)\//u.test(relativePath) || /^packages\/[^/]+\/config\//u.test(relativePath);
}

function isForbiddenPlatformConfig(relativePath) {
  return (
    isRuntimeConfig(relativePath) ||
    /(?:^|\/)\.env(?:\.[^/]*)?$/u.test(relativePath) ||
    /(?:^|\/)(?:docker-)?compose(?:[.-][^/]*)?\.ya?ml$/u.test(relativePath) ||
    /(?:^|\/)wrangler(?:\.[^/]*)?\.toml$/u.test(relativePath) ||
    /^(?:infra(?:structure)?|terraform)(?:\/|[^/]*\.(?:json|toml|ya?ml|tf|tfvars)$)/u.test(relativePath)
  );
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function push(violations, code, relativePath, message) {
  violations.push({ code, path: relativePath, message });
}

function checkDirectEgress(root, files, violations) {
  const sourceFiles = files.filter((file) => /^packages\/[^/]+\/src\/.*\.[cm]?[jt]sx?$/u.test(file));
  const directFetch = /(?<![\w.])(?:globalThis\.)?fetch\s*\(\s*([^,\n)]+)/gu;
  for (const file of sourceFiles) {
    const source = read(root, file);
    const pathConstants = new Set(
      [...source.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*["']\/[^"']*["']/gu)].map((item) => item[1]),
    );
    if (
      EXTERNAL_SDK_IMPORT.test(source) &&
      !file.startsWith("packages/shared/src/clients/") &&
      !GRANDFATHERED_EXTERNAL_CLIENTS.has(file)
    ) {
      push(violations, "EGRESS", file, "external SDK imports must use the existing injected client boundary");
    }
    EXTERNAL_SDK_IMPORT.lastIndex = 0;
    for (const match of source.matchAll(directFetch)) {
      const prefix = source.slice(Math.max(0, match.index - 24), match.index);
      if (/(?:private|protected|public|function|async)\s+$/u.test(prefix)) continue;
      const target = match[1].trim();
      const literal = /^(["'`])(.*?)\1$/u.exec(target);
      const pathConstant = /^`\$\{([A-Z][A-Z0-9_]*)\}/u.exec(target)?.[1];
      const sameOrigin = literal?.[2].startsWith("/") || pathConstants.has(pathConstant);
      if (sameOrigin) continue;
      if (!literal || !/^https?:\/\//u.test(literal[2])) {
        push(
          violations,
          "EGRESS",
          file,
          `direct fetch target must be a static approved URL or same-origin path: ${target}`,
        );
        continue;
      }
      let hostname;
      try {
        hostname = new URL(literal[2]).hostname.toLowerCase();
      } catch {
        push(violations, "EGRESS", file, `direct fetch has a non-static or invalid URL: ${literal[2]}`);
        continue;
      }
      const internal =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".invalid") ||
        hostname.endsWith(".test");
      if (!internal && !EXTERNAL_ALLOWLIST.has(hostname)) {
        push(violations, "EGRESS", file, `direct fetch host is outside the SPEC-INT-060 allowlist: ${hostname}`);
      }
    }
  }
}

function checkGatewayOverlap(root, files, violations) {
  const registryPath = path.join(root, MCP_REGISTRY);
  if (!fs.existsSync(registryPath)) {
    push(violations, "GATEWAY_OVERLAP", MCP_REGISTRY, "MCP/A2A registry is missing");
    return;
  }
  const registered = new Set(
    [...fs.readFileSync(registryPath, "utf8").matchAll(/^\s*-\s+id:\s*([a-z0-9_-]+)\s*$/gimu)].map((match) => match[1]),
  );
  for (const file of files.filter(isRuntimeConfig)) {
    if (file === TOOL_CATALOG || file === MCP_REGISTRY) continue;
    const source = read(root, file);
    const hasMcpPath =
      /^\s*protocol\s*:\s*(?:mcp|a2a)\s*$/imu.test(source) ||
      /\b(?:MCP|A2A)_(?:URL|ENDPOINT)\b/u.test(source) ||
      /\b(?:mcp|a2a)[_-](?:url|endpoint)\s*:/iu.test(source);
    if (!hasMcpPath) continue;
    if (!file.startsWith("deploy/agentgateway/")) {
      push(violations, "GATEWAY_OVERLAP", file, "MCP/A2A runtime paths must be registered under deploy/agentgateway");
      continue;
    }
    const llmRouting = source.split(/\r?\n/u).find((line) => {
      const field =
        /^[ \t]*(llm_routing_enabled|llm_routes?|model_routes?|models?|providers?|backend_model|upstream_model)[ \t]*:[ \t]*([^#]*?)[ \t]*(?:#.*)?$/iu.exec(
          line,
        );
      return field && (field[1].toLowerCase() !== "llm_routing_enabled" || field[2] !== "false");
    });
    if (llmRouting) {
      push(violations, "GATEWAY_OVERLAP", file, "agentgateway must not configure LLM routing");
    }
    const servers = [...source.matchAll(/^\s*server(?:_id)?\s*:\s*([a-z0-9_-]+)\s*$/gimu)].map((match) => match[1]);
    if (servers.length === 0 || servers.some((server) => !registered.has(server))) {
      push(violations, "GATEWAY_OVERLAP", file, "agentgateway runtime paths require a registered canonical server");
    }
  }
}

function checkForbiddenPlatforms(root, files, violations) {
  for (const file of files) {
    if (path.basename(file) === "package.json") {
      let manifest;
      try {
        manifest = JSON.parse(read(root, file));
      } catch {
        continue;
      }
      const dependencies = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies };
      for (const name of Object.keys(dependencies)) {
        if (name === "@cloudflare/artifacts" || name === "@notionhq/client") {
          push(violations, "FORBIDDEN_PLATFORM", file, `forbidden baseline dependency: ${name}`);
        }
      }
      continue;
    }

    const sourceOrConfig = /^packages\/[^/]+\/src\//u.test(file) || isForbiddenPlatformConfig(file);
    if (!sourceOrConfig) continue;
    const source = read(root, file);
    if (/artifacts\.cloudflare\.com|cloudflare[_-]artifacts/iu.test(source)) {
      push(violations, "FORBIDDEN_PLATFORM", file, "Cloudflare Artifacts is immutable-off");
    }
    if (/api\.notion\.com|\bNOTION_(?:API|TOKEN)|notion[_-]baseline/iu.test(source)) {
      push(violations, "FORBIDDEN_PLATFORM", file, "Notion is excluded from the baseline");
    }
  }
}

function parseToolCatalog(source) {
  const allowed = new Set();
  const allowedByServer = new Map();
  const forbidden = new Set();
  const lines = source.split(/\r?\n/u);
  let server;
  for (let index = 0; index < lines.length; index += 1) {
    const key = lines[index].trim().replace(/^-\s*/u, "");
    const serverMatch = /^server:\s*([a-z0-9_-]+)$/iu.exec(key);
    if (serverMatch) server = serverMatch[1];
    if (key === "operations:") {
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const match = /^\s*-\s*([a-z0-9_-]+)\s*$/iu.exec(lines[cursor]);
        if (!match) break;
        allowed.add(match[1]);
        if (server) {
          const serverAllowed = allowedByServer.get(server) ?? new Set();
          serverAllowed.add(match[1]);
          allowedByServer.set(server, serverAllowed);
        }
      }
    }
    if (key === "globally_forbidden:") {
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const match = /^\s*-\s*([a-z0-9_-]+)\s*$/iu.exec(lines[cursor]);
        if (!match) break;
        forbidden.add(match[1]);
      }
    }
  }
  return { allowed, allowedByServer, forbidden };
}

function configuredTools(source) {
  const tools = [];
  const lines = source.split(/\r?\n/u);
  let server;
  for (let index = 0; index < lines.length; index += 1) {
    const serverMatch = /^\s*(?:-\s*)?server(?:_id)?\s*:\s*([a-z0-9_-]+)\s*$/iu.exec(lines[index]);
    if (serverMatch) server = serverMatch[1];
    const single = /^\s*(?:tool|tool_name|operation)\s*:\s*(["']?[a-z0-9._-]+["']?)/iu.exec(lines[index]);
    if (single) tools.push({ server, tool: unquote(single[1]) });
    const inline = /^\s*tools\s*:\s*\[([^\]]*)\]/iu.exec(lines[index]);
    if (inline)
      tools.push(
        ...inline[1]
          .split(",")
          .map(unquote)
          .filter(Boolean)
          .map((tool) => ({ server, tool })),
      );
    if (!/^\s*tools\s*:\s*$/iu.test(lines[index])) continue;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const match = /^\s*-\s*(["']?[a-z0-9._-]+["']?)\s*$/iu.exec(lines[cursor]);
      if (!match) break;
      tools.push({ server, tool: unquote(match[1]) });
    }
  }
  return tools;
}

function checkMcpTools(root, files, violations) {
  const catalogPath = path.join(root, TOOL_CATALOG);
  if (!fs.existsSync(catalogPath)) {
    push(violations, "MCP_TOOL", TOOL_CATALOG, "tool risk catalog is missing");
    return;
  }
  const { allowed, allowedByServer, forbidden } = parseToolCatalog(fs.readFileSync(catalogPath, "utf8"));
  if (allowed.size === 0 || forbidden.size === 0) {
    push(violations, "MCP_TOOL", TOOL_CATALOG, "tool risk catalog must define allowed and forbidden operations");
  }
  for (const file of files.filter(isRuntimeConfig)) {
    if (file === TOOL_CATALOG) continue;
    for (const { server, tool } of configuredTools(read(root, file))) {
      const serverAllowed = server ? allowedByServer.get(server) : undefined;
      if (forbidden.has(tool) || !allowed.has(tool) || (server && !serverAllowed?.has(tool))) {
        push(violations, "MCP_TOOL", file, `MCP tool is not allowlisted${server ? ` for ${server}` : ""}: ${tool}`);
      }
    }
  }
}

function parseCanonicalFlags(source) {
  const flags = [];
  let current;
  let values;
  for (const line of source.split(/\r?\n/u)) {
    const name = /^\s*-\s+name:\s*(.+?)\s*$/u.exec(line);
    if (name) {
      current = { name: unquote(name[1]), default: "false", owner: "", killSwitch: false, immutableFalse: false };
      flags.push(current);
      values = undefined;
      continue;
    }
    if (!current) continue;
    const field = /^\s+([a-z_]+):\s*(.*?)\s*$/u.exec(line);
    if (field) {
      values = undefined;
      const [, key, raw] = field;
      if (key === "default") current.default = unquote(raw);
      else if (key === "owner") current.owner = unquote(raw);
      else if (key === "kill_switch") current.killSwitch = raw === "true";
      else if (key === "immutable_false") current.immutableFalse = raw === "true";
      else if (key === "mutually_exclusive_primary_with") current.mutuallyExclusivePrimaryWith = unquote(raw);
      else if (key === "stages" || key === "modes" || key === "requires") {
        current[key] = [];
        values = current[key];
      } else if (key === "scope" || key === "note") current[key] = unquote(raw);
      continue;
    }
    const item = /^\s+-\s+([^#]+?)\s*$/u.exec(line);
    if (item && values) values.push(unquote(item[1]));
  }
  return flags;
}

function bracketBody(source, declaration) {
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex < 0) return undefined;
  const assignment = source.indexOf("=", declarationIndex);
  if (assignment < 0) return undefined;
  const start = source.indexOf("[", assignment);
  if (start < 0) return undefined;
  let depth = 0;
  let quote;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }
  return undefined;
}

function objectBodies(source) {
  const bodies = [];
  let start = -1;
  let depth = 0;
  let quote;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index + 1;
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) bodies.push(source.slice(start, index));
    }
  }
  return bodies;
}

function stringField(body, field) {
  return new RegExp(`\\b${field}\\s*:\\s*["']([^"']+)["']`, "u").exec(body)?.[1];
}

function arrayField(body, field, constants) {
  const literal = new RegExp(`\\b${field}\\s*:\\s*\\[([^\\]]*)\\]`, "u").exec(body)?.[1];
  if (literal !== undefined) return [...literal.matchAll(/["']([^"']+)["']/gu)].map((match) => match[1]);
  const constant = new RegExp(`\\b${field}\\s*:\\s*([A-Z][A-Z0-9_]*)`, "u").exec(body)?.[1];
  return constants.get(constant);
}

function parseRuntimeFlags(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*\[([^\]]*)\]\s*as const/gu)) {
    constants.set(
      match[1],
      [...match[2].matchAll(/["']([^"']+)["']/gu)].map((item) => item[1]),
    );
  }
  const body = bracketBody(source, "export const MIGRATION_FLAGS");
  if (body === undefined) return [];
  return objectBodies(body).map((item) => {
    return {
      name: stringField(item, "name") ?? "",
      default: stringField(item, "default") ?? "false",
      owner: stringField(item, "owner") ?? "",
      stages: arrayField(item, "stages", constants),
      modes: arrayField(item, "modes", constants),
      killSwitch: /\bkillSwitch\s*:\s*true\b/u.test(item),
      immutableFalse: /\bimmutableFalse\s*:\s*true\b/u.test(item),
      mutuallyExclusivePrimaryWith: stringField(item, "mutuallyExclusivePrimaryWith"),
      requires: arrayField(item, "requires", constants),
      scope: stringField(item, "scope"),
      note: stringField(item, "note"),
    };
  });
}

function checkFlagRegistry(root, violations) {
  const contractPath = path.join(root, FLAG_CONTRACT);
  const registryPath = path.join(root, FLAG_REGISTRY);
  if (!fs.existsSync(contractPath) || !fs.existsSync(registryPath)) {
    push(violations, "FLAG_REGISTRY", FLAG_REGISTRY, "canonical flag contract and runtime registry are both required");
    return;
  }
  const canonical = parseCanonicalFlags(fs.readFileSync(contractPath, "utf8"));
  const runtime = parseRuntimeFlags(fs.readFileSync(registryPath, "utf8"));
  const expected = new Map(canonical.map((flag) => [flag.name, flag]));
  const actual = new Map(runtime.map((flag) => [flag.name, flag]));
  const differences = [];
  if (canonical.length !== expected.size) differences.push("duplicate canonical flag name");
  if (runtime.length !== actual.size) differences.push("duplicate runtime flag name");
  if (JSON.stringify(canonical.map(({ name }) => name)) !== JSON.stringify(runtime.map(({ name }) => name))) {
    differences.push("flag order");
  }
  for (const name of new Set([...expected.keys(), ...actual.keys()])) {
    const left = expected.get(name);
    const right = actual.get(name);
    if (!left || !right) {
      differences.push(`${name}: ${left ? "missing from runtime" : "not in canonical contract"}`);
      continue;
    }
    for (const field of [
      "default",
      "owner",
      "killSwitch",
      "immutableFalse",
      "mutuallyExclusivePrimaryWith",
      "scope",
      "note",
    ]) {
      if ((left[field] ?? false) !== (right[field] ?? false)) differences.push(`${name}.${field}`);
    }
    for (const field of ["stages", "modes", "requires"]) {
      const leftValues = left[field] ?? [];
      const rightValues = (right[field] ?? []).filter((value) => value !== "disabled");
      if (JSON.stringify(leftValues) !== JSON.stringify(rightValues)) differences.push(`${name}.${field}`);
    }
  }
  if (differences.length) {
    push(violations, "FLAG_REGISTRY", FLAG_REGISTRY, `canonical mismatch: ${differences.join(", ")}`);
  }
}

function checkInvariantMatrix(root, violations) {
  const matrixPath = path.join(root, INVARIANT_MATRIX);
  if (!fs.existsSync(matrixPath)) {
    push(violations, "INVARIANT_MATRIX", INVARIANT_MATRIX, "20-invariant fitness matrix is missing");
    return;
  }
  const rows = [
    ...fs
      .readFileSync(matrixPath, "utf8")
      .matchAll(/^\|\s*(INV-\d{3})\s*\|\s*(automated|manual)\s*\|\s*([^|\s][^|]*)\|\s*$/gmu),
  ].map((match) => match[1]);
  const expected = Array.from({ length: 20 }, (_, index) => `INV-${String(index + 1).padStart(3, "0")}`);
  const missing = expected.filter((id) => !rows.includes(id));
  const duplicates = [...new Set(rows.filter((id, index) => rows.indexOf(id) !== index))];
  const extra = rows.filter((id) => !expected.includes(id));
  if (missing.length || duplicates.length || extra.length) {
    push(
      violations,
      "INVARIANT_MATRIX",
      INVARIANT_MATRIX,
      `matrix mismatch (missing=${missing.join(",") || "none"}; duplicates=${duplicates.join(",") || "none"}; extra=${extra.join(",") || "none"})`,
    );
  }
}

function checkWbsOwnership(root, violations) {
  const wbsPath = path.join(root, WBS_CONTRACT);
  if (!fs.existsSync(wbsPath)) {
    push(violations, "DUPLICATE_OWNER", WBS_CONTRACT, "WBS one-writer contract file is missing");
    return;
  }
  let document;
  try {
    document = YAML.parse(fs.readFileSync(wbsPath, "utf8"), { uniqueKeys: true, maxAliasCount: 10000 });
  } catch (error) {
    push(violations, "DUPLICATE_OWNER", WBS_CONTRACT, `WBS contract failed strict YAML parsing: ${error.message}`);
    return;
  }
  const tasks = document?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    push(violations, "DUPLICATE_OWNER", WBS_CONTRACT, "no tasks were parsed from the WBS contract");
    return;
  }
  for (const [index, task] of tasks.entries()) {
    const id = typeof task?.id === "string" && task.id.trim() ? task.id.trim() : `tasks[${index}]`;
    const writer = typeof task?.writer === "string" ? task.writer.trim() : "";
    const reviewer = typeof task?.reviewer === "string" ? task.reviewer.trim() : "";
    if (!writer) {
      push(violations, "DUPLICATE_OWNER", WBS_CONTRACT, `task ${id} must declare exactly one nonempty writer`);
    } else if (!reviewer) {
      push(violations, "DUPLICATE_OWNER", WBS_CONTRACT, `task ${id} must declare exactly one nonempty reviewer`);
    } else if (writer === reviewer) {
      push(
        violations,
        "DUPLICATE_OWNER",
        WBS_CONTRACT,
        `task ${id} assigns the same identity as writer and reviewer: ${writer}`,
      );
    }
  }
}

export function checkArchitectureFitness(root) {
  const resolvedRoot = path.resolve(root);
  const files = walk(resolvedRoot);
  const violations = [];
  checkDirectEgress(resolvedRoot, files, violations);
  checkGatewayOverlap(resolvedRoot, files, violations);
  checkForbiddenPlatforms(resolvedRoot, files, violations);
  checkMcpTools(resolvedRoot, files, violations);
  checkFlagRegistry(resolvedRoot, violations);
  checkInvariantMatrix(resolvedRoot, violations);
  checkWbsOwnership(resolvedRoot, violations);
  return violations.sort((left, right) =>
    `${left.code}:${left.path}:${left.message}`.localeCompare(`${right.code}:${right.path}:${right.message}`),
  );
}

function main(root = process.cwd()) {
  const violations = checkArchitectureFitness(root);
  if (violations.length) {
    for (const violation of violations) {
      console.error(`ERROR [${violation.code}] ${violation.path}: ${violation.message}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("OK: architecture fitness checks passed (INV-001..INV-020 mapped).");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]);
}
