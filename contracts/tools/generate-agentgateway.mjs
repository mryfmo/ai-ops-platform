// 根拠: FinalArch:MCP-001 / FinalArch:MCP-004 / FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T02
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import {
  generateGatewaySections,
  renderGatewayConfig,
  renderGatewaySections,
} from "../../packages/integrations/src/mcp/registryGenerator.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaults = {
  registry: path.join(repoRoot, "contracts/tools/mcp-registry.yaml"),
  ledger: path.join(repoRoot, "contracts/tools/tool-risk.yaml"),
  schemaHash: path.join(repoRoot, "contracts/tools/mcp-registry.schema.sha256"),
  config: path.join(repoRoot, "deploy/agentgateway/config.yaml"),
};
const pathArguments = new Map([
  ["--registry", "registry"],
  ["--ledger", "ledger"],
  ["--schema-hash", "schemaHash"],
  ["--config", "config"],
]);

function parseArguments(argv) {
  let mode = "--check";
  const paths = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--check", "--write", "--print-sections"].includes(argument)) {
      mode = argument;
      continue;
    }
    const key = pathArguments.get(argument);
    const value = argv[index + 1];
    if (!key || !value) throw new TypeError(`unknown or incomplete argument ${argument}`);
    paths[key] = path.resolve(value);
    index += 1;
  }
  return { mode, paths };
}

function approvedHash(file) {
  const hash = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .find((line) => /^[0-9a-f]{64}$/u.test(line));
  if (!hash) throw new TypeError("approved registry schema hash is missing");
  return hash;
}

const { mode, paths } = parseArguments(process.argv.slice(2));
const registry = YAML.parse(fs.readFileSync(paths.registry, "utf8"), { uniqueKeys: true });
const ledger = YAML.parse(fs.readFileSync(paths.ledger, "utf8"), { uniqueKeys: true });
const sections = generateGatewaySections(registry, ledger, approvedHash(paths.schemaHash));

if (mode === "--print-sections") {
  process.stdout.write(renderGatewaySections(sections));
} else {
  const source = fs.readFileSync(paths.config, "utf8");
  const generated = renderGatewayConfig(source, sections);
  if (mode === "--write") {
    fs.writeFileSync(paths.config, generated);
    process.stdout.write(`WROTE: ${paths.config}\n`);
  } else if (generated !== source) {
    throw new Error("generated MCP targets/rules drift from deploy/agentgateway/config.yaml");
  } else {
    process.stdout.write(`REGISTRY CONFIG PASS: enabled=${sections.targets.length}\n`);
  }
}
