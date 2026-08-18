// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-005 / ADR-0027 / WBS P8-T05
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { validateDroidExecutionAction } from "./action-profile-validator.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const actionPath = path.join(repoRoot, ".github/actions/run-coding-agent/action.yml");
const settingsPath = path.join(repoRoot, ".factory/runner-settings.template.json");

function cloneAction() {
  return structuredClone(parse(fs.readFileSync(actionPath, "utf8")));
}

function droidStep(action, name) {
  return action.runs.steps.find((step) => step.name === name);
}

test("accepts the pinned fail-closed Droid execution structure [FinalArch:COD-005]", () => {
  const action = cloneAction();
  assert.equal(validateDroidExecutionAction(action), action);
});

test("pins Droid project settings to LiteLLM and hard-blocks unsafe commands [FinalArch:COD-005]", () => {
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  assert.deepEqual(settings.customModels, [
    {
      model: "claude-code",
      displayName: "AIOps LiteLLM Coding",
      baseUrl: "__LITELLM_BASE_URL__",
      apiKey: "${LITELLM_CODING_VIRTUAL_KEY}",
      provider: "generic-chat-completion-api",
      noImageSupport: true,
    },
  ]);
  assert.equal(settings.cloudSessionSync, false);
  assert.equal(settings.maxAutonomyLevel, "low");
  assert.deepEqual(settings.mcpPolicy, { enabled: false, allowlist: [] });
  for (const command of ["curl", "gh", "git push", "git commit", "aws", "kubectl", "terraform", "docker"]) {
    assert.ok(settings.commandBlocklist.includes(command), `must block ${command}`);
  }
  assert.doesNotMatch(
    JSON.stringify(settings),
    /ANTHROPIC_API_KEY|OPENAI_API_KEY|AWS_ACCESS_KEY_ID|LITELLM_MASTER_KEY/iu,
  );
});

test("rejects floating, altered, or unverified Droid CLI artifacts [FinalArch:COD-005]", () => {
  const floating = cloneAction();
  droidStep(floating, "Install verified Droid CLI (agent=droid)").env.DROID_VERSION = "latest";
  assert.throws(() => validateDroidExecutionAction(floating), /exact Droid version/u);

  const wrongDigest = cloneAction();
  droidStep(wrongDigest, "Install verified Droid CLI (agent=droid)").env.DROID_LINUX_X64_SHA256 = "0".repeat(64);
  assert.throws(() => validateDroidExecutionAction(wrongDigest), /reviewed Droid artifact digest/u);

  const unchecked = cloneAction();
  const install = droidStep(unchecked, "Install verified Droid CLI (agent=droid)");
  install.run = install.run.replace("sha256sum -c -", "true");
  assert.throws(() => validateDroidExecutionAction(unchecked), /verify Droid SHA-256/u);
});

test("requires the unconditional pre-invocation activation stop [FinalArch:COD-005]", () => {
  const enabled = cloneAction();
  droidStep(enabled, "Require reviewed Droid activation (agent=droid)").env.DROID_EXECUTION_ENABLED = "true";
  assert.throws(() => validateDroidExecutionAction(enabled), /must remain disabled/u);

  const bypassed = cloneAction();
  const gate = droidStep(bypassed, "Require reviewed Droid activation (agent=droid)");
  gate.run = gate.run.replace("exit 1", "true");
  assert.throws(() => validateDroidExecutionAction(bypassed), /unconditional fail-closed/u);

  const conditional = cloneAction();
  droidStep(conditional, "Require reviewed Droid activation (agent=droid)").if =
    "${{ inputs.agent == 'droid' && inputs.droid_enabled == 'true' }}";
  assert.throws(() => validateDroidExecutionAction(conditional), /unconditional fail-closed/u);

  const continued = cloneAction();
  droidStep(continued, "Require reviewed Droid activation (agent=droid)")["continue-on-error"] = true;
  assert.throws(() => validateDroidExecutionAction(continued), /unconditional fail-closed/u);

  const reordered = cloneAction();
  const steps = reordered.runs.steps;
  const runIndex = steps.indexOf(droidStep(reordered, "Run bounded Droid (agent=droid)"));
  const [run] = steps.splice(runIndex, 1);
  steps.splice(steps.indexOf(droidStep(reordered, "Require reviewed Droid activation (agent=droid)")), 0, run);
  assert.throws(() => validateDroidExecutionAction(reordered), /must precede every Droid invocation/u);
});

test("rejects provider keys and weakened LiteLLM virtual-key routing [FinalArch:COD-005]", () => {
  const providerKey = cloneAction();
  providerKey.inputs.openai_api_key = { required: true };
  assert.throws(() => validateDroidExecutionAction(providerKey), /direct provider or master key/u);

  const wrongRoute = cloneAction();
  const run = droidStep(wrongRoute, "Run bounded Droid (agent=droid)");
  run.run = run.run.replace('"${LITELLM_CODING_VIRTUAL_KEY}"', '"${OPENAI_API_KEY}"');
  assert.throws(() => validateDroidExecutionAction(wrongRoute), /direct provider|scoped LiteLLM virtual key/u);
});

test("rejects non-agent branches and weakened tool, network, or deploy policy [FinalArch:COD-005]", () => {
  const mainCapable = cloneAction();
  const mainRun = droidStep(mainCapable, "Run bounded Droid (agent=droid)");
  mainRun.run = mainRun.run.replace("agent/*) ;;", "*) ;;");
  assert.throws(() => validateDroidExecutionAction(mainCapable), /Droid agent branch gate/u);

  const webEnabled = cloneAction();
  const webRun = droidStep(webEnabled, "Run bounded Droid (agent=droid)");
  webRun.run = webRun.run.replace('"FetchUrl,WebSearch"', '"FetchUrl"');
  assert.throws(() => validateDroidExecutionAction(webEnabled), /Droid tool and command policy/u);

  const pushEnabled = cloneAction();
  const pushRun = droidStep(pushEnabled, "Run bounded Droid (agent=droid)");
  pushRun.run = pushRun.run.replace('"git push"', '"git status"');
  assert.throws(() => validateDroidExecutionAction(pushEnabled), /Droid tool and command policy/u);
});

test("rejects missing runtime, cost, token, turn, or evidence bounds [FinalArch:COD-005]", () => {
  for (const fragment of [
    'timeout --signal=TERM --kill-after=30s "${MAX_RUNTIME_SECONDS}s"',
    "select(. > 0 and . <= 25)",
    "(( MAX_TOKENS > 200000 ))",
    "(( MAX_TOOL_CALLS > 500 ))",
    '(.num_turns | type) == "number" and .num_turns >= 0 and .num_turns <= ($max_turns | tonumber)',
    "all(.commands_executed[];",
    "all(.test_results[];",
    'all(.security_findings[]; type == "string")',
  ]) {
    const action = cloneAction();
    const run = droidStep(action, "Run bounded Droid (agent=droid)");
    run.run = run.run.replace(fragment, "removed-bound");
    assert.throws(
      () => validateDroidExecutionAction(action),
      /bounded Droid invocation and evidence/u,
      `must reject removal of ${fragment}`,
    );
  }
});
