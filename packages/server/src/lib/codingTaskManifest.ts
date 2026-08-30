/**
 * 根拠: FinalArch:COD-001 / FinalArch:COD-003 / FinalArch:COD-004 / ADR-0006 / ADV-FIX-04
 * coding task 作成時に固定する、production default manifest authority。
 */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export type CodingTaskManifestAgent = "claude-code" | "droid";

export interface CodingTaskManifestAuthority {
  manifest: string;
  manifestSha256: string;
}

interface CodingTaskManifestInput extends CodingTaskManifestAuthority {
  taskId: string;
  agent: CodingTaskManifestAgent;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

const FORBIDDEN_PATHS = [
  ".github/workflows/**",
  ".github/actions/**",
  ".github/CODEOWNERS",
  ".github/rulesets/**",
  ".github/branch-protection/**",
  ".github/branch-protection.yml",
  ".github/settings.yml",
  "CODEOWNERS",
  "docs/CODEOWNERS",
  "contracts/agent-task/**",
  "scripts/coding-agent-path-guard.mjs",
  "scripts/coding-agent-path-guard.test.mjs",
] as const;

function defaultManifest(taskId: string, agent: CodingTaskManifestAgent) {
  if (!UUID.test(taskId)) throw new TypeError("task manifest taskId must be a lowercase RFC 4122 UUID");
  const executionProfile = agent === "claude-code" ? "claude-code-fable5-xhigh" : "droid-litellm-coding";
  const pin = agent === "claude-code" ? "v2.1.222" : "v0.174.0";
  return {
    schema_version: "1.0",
    task_id: taskId,
    writer: { agent_id: agent, role: "writer", execution_profile: executionProfile },
    reviewer: { agent_id: "codex-reviewer", role: "reviewer", execution_profile: "review" },
    runner: {
      isolation: "ephemeral",
      cli: [{ name: agent, pin }],
      credential: {
        kind: "litellm_virtual_key",
        key_env: "LITELLM_CODING_VIRTUAL_KEY",
        scope: "coding-agent",
        master_key: false,
        provider_keys: false,
      },
      mcp_gateway: { endpoint_env: "AGENTGATEWAY_ENDPOINT", profile: "coding-agent" },
      direct_production_network: false,
      clean_checkout: true,
    },
    paths: {
      allowed: [
        "packages/**",
        "deploy/**",
        ".agents/worklog/**",
        ".orchestration/**",
        "contracts/agent-execution/**",
        "contracts/agent-review/**",
        "contracts/asyncapi/**",
        "contracts/baseline/**",
        "contracts/deploy-workflow/**",
        "contracts/fixtures/**",
        "contracts/mcp-gateway/**",
        "contracts/model-routing/**",
        "contracts/openapi/**",
        "contracts/schemas/**",
        "contracts/tools/**",
        "docs/adr/**",
        "docs/audit/**",
        "docs/contracts/**",
        "docs/decisions/**",
        "docs/guide/**",
        "docs/plans/**",
        "docs/reference/**",
        "docs/research/**",
        "docs/security/**",
        "docs/spec/**",
        "docs/teams-app/**",
        "docs/README.md",
        "ops/**",
        "plans/**",
        "runbooks/**",
        "tests/**",
        "verification/**",
        "README.md",
        "eslint.config.mjs",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "tsconfig.base.json",
      ],
      forbidden: [...FORBIDDEN_PATHS],
    },
    gates: [
      { id: "GOVERNANCE", blocking: true },
      { id: "LINT", blocking: true },
      { id: "TYPECHECK", blocking: true },
      { id: "TEST", blocking: true },
      { id: "TRACEABILITY", blocking: true },
    ],
    budget: { max_runtime_seconds: 1800, max_cost_usd: 25, max_tokens: 200000, max_tool_calls: 500 },
    delivery: {
      branch: `agent/${taskId}`,
      direct_main_push: false,
      pull_request: {
        required: true,
        draft: false,
        auto_merge: false,
        human_merge_required: true,
        labels: ["ai-generated"],
      },
    },
    callback: {
      required_fields: [
        "commands_executed",
        "test_results",
        "skipped_failed_checks",
        "changed_paths",
        "commit",
        "branch",
        "pull_request",
        "dependency_changes",
        "security_findings",
        "unresolved_decisions",
      ],
    },
    review: {
      dimensions: [
        "spec_compliance",
        "architecture_drift",
        "security",
        "correctness",
        "idempotency",
        "test_adequacy",
        "observability",
        "migration_rollback",
        "documentation_traceability",
      ],
    },
  } as const;
}

/** Production issuer is intentionally stricter than the generic contract: only the reviewed default profile is accepted. */
function validateAgentTaskManifest(manifest: unknown, taskId: string, agent: CodingTaskManifestAgent): void {
  if (!isDeepStrictEqual(manifest, defaultManifest(taskId, agent))) {
    throw new TypeError("task manifest does not match the reviewed production profile");
  }
}

function digest(bytes: string): string {
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

export function issueCodingTaskManifest(input: {
  taskId: string;
  agent: CodingTaskManifestAgent;
}): CodingTaskManifestAuthority {
  const value = defaultManifest(input.taskId, input.agent);
  validateAgentTaskManifest(value, input.taskId, input.agent);
  const manifest = `${JSON.stringify(value)}\n`;
  return { manifest, manifestSha256: digest(manifest) };
}

export function verifyCodingTaskManifestAuthority(input: CodingTaskManifestInput): void {
  if (!SHA256.test(input.manifestSha256) || digest(input.manifest) !== input.manifestSha256) {
    throw new TypeError("task manifest digest is missing or mismatched");
  }
  let value: unknown;
  try {
    value = JSON.parse(input.manifest);
  } catch {
    throw new TypeError("task manifest is not valid JSON");
  }
  validateAgentTaskManifest(value, input.taskId, input.agent);
}
