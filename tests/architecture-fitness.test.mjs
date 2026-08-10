// 根拠: FinalArch:INV-005 / FinalArch:INV-006 / FinalArch:INV-009 / FinalArch:INV-013 / FinalArch:INV-019 / FinalArch:INV-020 / FinalArch:GOV-004 / FinalArch:GOV-005
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkArchitectureFitness } from "../scripts/check-architecture-fitness.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const negativeFixture = path.join(repoRoot, "tests/fixtures/architecture-fitness");

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function matrix() {
  return [
    "<!-- 根拠: FinalArch:INV-001 / FinalArch:INV-020 -->",
    "| Invariant | Gate type | Evidence |",
    "|---|---|---|",
    ...Array.from(
      { length: 20 },
      (_, index) => `| INV-${String(index + 1).padStart(3, "0")} | ${index % 2 ? "manual" : "automated"} | fixture |`,
    ),
  ].join("\n");
}

const canonicalFlags = `flags:
- name: control.temporal.enabled
  owner: control-plane
  stages:
  - shadow
  - limited
  - primary
  kill_switch: true
`;

const matchingFlags = `/** 根拠: FinalArch:GOV-005 */
export const MIGRATION_STAGES = ["disabled", "shadow", "limited", "primary"] as const;
export const MIGRATION_FLAGS = [
  { name: "control.temporal.enabled", default: "false", owner: "control-plane", stages: MIGRATION_STAGES, killSwitch: true },
] as const;
`;

function createCleanFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "architecture-fitness-"));
  write(
    root,
    "docs/plans/2026-08-final-architecture/05_contracts/mcp-registry-manifest.yaml",
    "gateway_role: mcp-a2a-only\nservers:\n- id: github\n",
  );
  write(
    root,
    "docs/plans/2026-08-final-architecture/05_contracts/tool-risk-catalog.yaml",
    "initial_tools:\n- server: github\n  operations:\n  - read\nglobally_forbidden:\n- merge_pull_request\n",
  );
  write(root, "docs/plans/2026-08-final-architecture/06_implementation/08_feature_flags.yaml", canonicalFlags);
  write(root, "packages/shared/src/migration/featureFlags.ts", matchingFlags);
  write(
    root,
    "deploy/agentgateway/github.yaml",
    "protocol: mcp\nserver: github\nllm_routing_enabled: false\ntools: [read]\n",
  );
  write(root, "docs/plans/2026-08-final-architecture/06_implementation/11_architecture_fitness_matrix.md", matrix());
  return root;
}

test("FinalArch:INV-005/006/009/013/019 and GOV-005 reject every required negative fixture", () => {
  const codes = new Set(checkArchitectureFitness(negativeFixture).map(({ code }) => code));
  for (const code of ["EGRESS", "GATEWAY_OVERLAP", "FORBIDDEN_PLATFORM", "MCP_TOOL", "FLAG_REGISTRY"]) {
    assert.ok(codes.has(code), `missing ${code}: ${[...codes].join(", ")}`);
  }
});

test("FinalArch:INV-020 accepts an exact flag registry and a complete 20-invariant matrix", () => {
  const root = createCleanFixture();
  try {
    assert.deepEqual(checkArchitectureFitness(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FinalArch:INV-020 rejects an incomplete invariant matrix", () => {
  const root = createCleanFixture();
  try {
    const matrixPath = path.join(
      root,
      "docs/plans/2026-08-final-architecture/06_implementation/11_architecture_fitness_matrix.md",
    );
    fs.writeFileSync(matrixPath, matrix().replace(/^\| INV-020 .*$/m, ""));
    assert.ok(checkArchitectureFitness(root).some(({ code }) => code === "INVARIANT_MATRIX"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FinalArch:INV-005 rejects computed global fetch targets", () => {
  const root = createCleanFixture();
  try {
    write(root, "packages/demo/src/computed-egress.ts", "fetch(process.env.EXFIL_URL);\n");
    assert.ok(checkArchitectureFitness(root).some(({ code }) => code === "EGRESS"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FinalArch:INV-006 rejects LLM routing in agentgateway configuration", () => {
  const root = createCleanFixture();
  try {
    write(root, "deploy/agentgateway/github.yaml", "protocol: mcp\nserver: github\nllm_routing_enabled: true\n");
    assert.ok(
      checkArchitectureFitness(root).some(({ code, message }) => code === "GATEWAY_OVERLAP" && /LLM/u.test(message)),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FinalArch:INV-013 enforces MCP tools per server", () => {
  const root = createCleanFixture();
  try {
    write(
      root,
      "docs/plans/2026-08-final-architecture/05_contracts/tool-risk-catalog.yaml",
      "initial_tools:\n- server: wispr\n  operations:\n  - read\n- server: plane\n  operations:\n  - draft\nglobally_forbidden:\n- merge_pull_request\n",
    );
    write(root, "deploy/agentgateway/wispr.yaml", "protocol: mcp\nserver: wispr\ntools: [draft]\n");
    assert.ok(
      checkArchitectureFitness(root).some(({ code, message }) => code === "MCP_TOOL" && /wispr/u.test(message)),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FinalArch:INV-019 scans root environment and infrastructure configuration", () => {
  const root = createCleanFixture();
  try {
    write(root, ".env.example", "NOTION_API_URL=https://api.notion.com/v1\n");
    assert.ok(
      checkArchitectureFitness(root).some(({ code, path }) => code === "FORBIDDEN_PLATFORM" && path === ".env.example"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("FinalArch:INV-017 root focused-test scripts use Vitest 4 file filters directly", () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")).scripts;
  for (const name of ["verify:load", "verify:load:postgres"]) {
    assert.match(scripts[name], /exec vitest run .*\.test\.ts/u);
    assert.doesNotMatch(scripts[name], /\btest\s+--\s+/u);
  }
});
