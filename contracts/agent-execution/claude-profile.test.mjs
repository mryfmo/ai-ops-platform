// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-003 / ADR-0027 / WBS P8-T04
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { validateClaudeExecutionAction } from "./action-profile-validator.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const actionPath = path.join(repoRoot, ".github/actions/run-coding-agent/action.yml");

function cloneAction() {
  return structuredClone(parse(fs.readFileSync(actionPath, "utf8")));
}

function claudeStep(action, name) {
  return action.runs.steps.find((step) => step.name === name);
}

test("accepts the bounded PR-only Claude execution profile [FinalArch:COD-003]", () => {
  const action = cloneAction();
  assert.equal(validateClaudeExecutionAction(action), action);
  for (const step of action.runs.steps.filter((candidate) => candidate.shell === "bash")) {
    const syntax = spawnSync("bash", ["-n"], { input: step.run, encoding: "utf8" });
    assert.equal(syntax.status, 0, `${step.name}: ${syntax.stderr}`);
  }
});

test("rejects profile substitution and raised fixed ceilings [FinalArch:COD-003]", () => {
  const substituted = cloneAction();
  substituted.inputs.execution_profile.default = "claude-code-other";
  assert.throws(() => validateClaudeExecutionAction(substituted), /reviewed xhigh label/u);

  for (const name of ["max_runtime_seconds", "max_cost_usd", "max_tokens", "max_tool_calls"]) {
    const action = cloneAction();
    action.inputs[name].default = "9999999999";
    assert.throws(() => validateClaudeExecutionAction(action), /reviewed fixed ceiling/u, `must pin ${name}`);
  }

  const wrongRoute = cloneAction();
  claudeStep(wrongRoute, "Run bounded Claude Code (agent=claude-code)").env.ANTHROPIC_MODEL = "provider-model-id";
  assert.throws(() => validateClaudeExecutionAction(wrongRoute), /reviewed LiteLLM model route/u);

  const reducedEffort = cloneAction();
  const run = claudeStep(reducedEffort, "Run bounded Claude Code (agent=claude-code)");
  run.run = run.run.replace("--effort xhigh", "--effort high");
  assert.throws(() => validateClaudeExecutionAction(reducedEffort), /reviewed xhigh effort/u);
});

test("rejects floating or unverified Claude CLI artifacts [FinalArch:COD-003]", () => {
  const floating = cloneAction();
  claudeStep(floating, "Install verified Claude Code CLI (agent=claude-code)").env.CLAUDE_CODE_VERSION = "latest";
  assert.throws(() => validateClaudeExecutionAction(floating), /exact Claude Code version/u);

  const wrongDigest = cloneAction();
  claudeStep(wrongDigest, "Install verified Claude Code CLI (agent=claude-code)").env.CLAUDE_CODE_LINUX_X64_SHA256 =
    "0".repeat(64);
  assert.throws(() => validateClaudeExecutionAction(wrongDigest), /reviewed native artifact digest/u);

  const unchecked = cloneAction();
  const install = claudeStep(unchecked, "Install verified Claude Code CLI (agent=claude-code)");
  install.run = install.run.replace("sha256sum -c -", "true");
  assert.throws(() => validateClaudeExecutionAction(unchecked), /verify SHA-256 before install/u);
});

test("rejects provider keys and weakened virtual-key isolation [FinalArch:COD-003]", () => {
  const providerKey = cloneAction();
  providerKey.inputs.anthropic_api_key = { required: true };
  assert.throws(() => validateClaudeExecutionAction(providerKey), /direct provider or master key/u);

  const installLeak = cloneAction();
  claudeStep(installLeak, "Install verified Claude Code CLI (agent=claude-code)").env.ANTHROPIC_AUTH_TOKEN =
    "${{ inputs.litellm_coding_virtual_key }}";
  assert.throws(() => validateClaudeExecutionAction(installLeak), /installer must not receive the virtual key/u);
});

test("rejects non-PR execution and widened tool or network policy [FinalArch:COD-003]", () => {
  const mainCapable = cloneAction();
  const run = claudeStep(mainCapable, "Run bounded Claude Code (agent=claude-code)");
  run.run = run.run.replace("agent/*) ;;", "*) ;;");
  assert.throws(() => validateClaudeExecutionAction(mainCapable), /agent branch gate/u);

  const defaultTools = cloneAction();
  const defaultRun = claudeStep(defaultTools, "Run bounded Claude Code (agent=claude-code)");
  defaultRun.run = defaultRun.run.replace('--tools "Read,Edit,Write,Glob,Grep,Bash"', '--tools "default"');
  assert.throws(() => validateClaudeExecutionAction(defaultTools), /exact built-in tool allowlist/u);

  const webEnabled = cloneAction();
  const webRun = claudeStep(webEnabled, "Run bounded Claude Code (agent=claude-code)");
  webRun.run = webRun.run.replace('"WebFetch" "WebSearch"', '"WebFetch"');
  assert.throws(() => validateClaudeExecutionAction(webEnabled), /network and deploy tools/u);
});

test("rejects missing runtime, cost, token, turn, or evidence bounds [FinalArch:COD-003]", () => {
  for (const fragment of [
    'timeout --signal=TERM --kill-after=30s "${MAX_RUNTIME_SECONDS}s"',
    '--max-budget-usd "${MAX_COST_USD}"',
    '--task-budget "${MAX_TOKENS}"',
    '--max-turns "${MAX_TOOL_CALLS}"',
    "security_findings",
  ]) {
    const action = cloneAction();
    const run = claudeStep(action, "Run bounded Claude Code (agent=claude-code)");
    run.run = run.run.replace(fragment, "removed-bound");
    assert.throws(
      () => validateClaudeExecutionAction(action),
      /bounded invocation and callback evidence/u,
      `must reject removal of ${fragment}`,
    );
  }
});
