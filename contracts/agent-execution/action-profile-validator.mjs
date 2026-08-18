// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-003 / ADR-0027 / WBS P8-T04
const CLAUDE_VERSION = "2.1.222";
const CLAUDE_LINUX_X64_SHA256 = "6680125b6f3baab47c84797cbeb3196e343c61bb4679cae15d138041a325c1ff";
const EXECUTION_PROFILE = "claude-code-fable5-xhigh";
const DROID_VERSION = "0.174.0";
const DROID_LINUX_X64_SHA256 = "e73592e3c6fc5a754f21b995f27ef686ca0a5096c9a91f2019fb8a3b10a56bbc";
const DROID_EXECUTION_PROFILE = "droid-litellm-coding";
const DIRECT_KEY_NAME =
  /ANTHROPIC_API_KEY|OPENAI_API_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|LITELLM_MASTER_KEY|GITHUB_APP_PRIVATE_KEY|AIOPS_PR_TOKEN/iu;

function fail(message) {
  throw new TypeError(message);
}

function stepByName(action, name) {
  const steps = (action.runs?.steps ?? []).filter((step) => step.name === name);
  if (steps.length !== 1) fail(`action requires exactly one ${name} step`);
  return steps[0];
}

function includesEvery(value, fragments, message) {
  if (!fragments.every((fragment) => value.includes(fragment))) fail(message);
}

export function validateClaudeExecutionAction(action) {
  if (action?.runs?.using !== "composite") fail("Claude execution action must remain composite");
  const serialized = JSON.stringify(action);
  if (DIRECT_KEY_NAME.test(serialized)) fail("direct provider or master key names are forbidden");

  const inputs = action.inputs ?? {};
  if (inputs.execution_profile?.default !== EXECUTION_PROFILE) {
    fail("execution profile must use the reviewed xhigh label");
  }
  const ceilings = {
    max_runtime_seconds: "1800",
    max_cost_usd: "25",
    max_tokens: "200000",
    max_tool_calls: "500",
  };
  for (const [name, expected] of Object.entries(ceilings)) {
    if (inputs[name]?.default !== expected) fail(`${name} must keep the reviewed fixed ceiling`);
  }
  if (inputs.litellm_coding_virtual_key?.default !== "" || inputs.litellm_coding_virtual_key?.required !== false) {
    fail("only the optional scoped virtual-key input is allowed");
  }

  const install = stepByName(action, "Install verified Claude Code CLI (agent=claude-code)");
  if (install.env?.CLAUDE_CODE_VERSION !== CLAUDE_VERSION) fail("exact Claude Code version is required");
  if (install.env?.CLAUDE_CODE_LINUX_X64_SHA256 !== CLAUDE_LINUX_X64_SHA256) {
    fail("reviewed native artifact digest is required");
  }
  const installRun = String(install.run ?? "");
  includesEvery(
    installRun,
    [
      "https://registry.npmjs.org/@anthropic-ai/claude-code-linux-x64/-/claude-code-linux-x64-${CLAUDE_CODE_VERSION}.tgz",
      "claude-code-linux-x64-${CLAUDE_CODE_VERSION}.tgz",
      "sha256sum -c -",
      "tar --extract --gzip",
      'install -m 0755 "${extract_dir}/package/claude" "${RUNNER_TEMP}/claude"',
      '"${RUNNER_TEMP}/claude" --version',
    ],
    "installer must verify SHA-256 before install and assert the installed version",
  );
  if (installRun.indexOf("sha256sum -c -") > installRun.indexOf("tar --extract --gzip")) {
    fail("installer must verify SHA-256 before install");
  }
  if (/\bpnpm\s+add\b|@latest\b|:latest\b/u.test(installRun)) {
    fail("installer must use only the verified native artifact");
  }
  if (JSON.stringify(install).includes("litellm_coding_virtual_key") || "ANTHROPIC_AUTH_TOKEN" in (install.env ?? {})) {
    fail("installer must not receive the virtual key");
  }

  const runStep = stepByName(action, "Run bounded Claude Code (agent=claude-code)");
  if (runStep.id !== "run_claude") fail("bounded Claude step requires stable output id");
  if (
    runStep.env?.EXECUTION_PROFILE !== "${{ inputs.execution_profile }}" ||
    runStep.env?.ANTHROPIC_BASE_URL !== "${{ inputs.litellm_base_url }}" ||
    runStep.env?.ANTHROPIC_AUTH_TOKEN !== "${{ inputs.litellm_coding_virtual_key }}" ||
    runStep.env?.ANTHROPIC_MODEL !== "claude-code" ||
    runStep.env?.ANTHROPIC_SMALL_FAST_MODEL !== "claude-code"
  ) {
    fail("bounded Claude step must bind only the reviewed LiteLLM model route and scoped inputs");
  }
  const run = String(runStep.run ?? "");
  if (!run.includes('case "${current_branch}" in') || !run.includes("agent/*) ;;")) {
    fail("agent branch gate is required");
  }
  if (!run.includes('--tools "Read,Edit,Write,Glob,Grep,Bash"')) {
    fail("exact built-in tool allowlist is required");
  }
  if (!run.includes("--effort xhigh")) fail("reviewed xhigh effort is required");
  includesEvery(
    run,
    [
      "--permission-mode dontAsk",
      "--safe-mode",
      "--strict-mcp-config",
      `--mcp-config '{"mcpServers":{}}'`,
      '"WebFetch" "WebSearch"',
      '"Bash(curl *)"',
      '"Bash(gh *)"',
      '"Bash(git push *)"',
      '"Bash(git commit *)"',
      '"Bash(aws *)"',
      '"Bash(kubectl *)"',
      '"Bash(terraform *)"',
      '"Bash(docker *)"',
    ],
    "network and deploy tools must stay denied",
  );
  includesEvery(
    run,
    [
      'timeout --signal=TERM --kill-after=30s "${MAX_RUNTIME_SECONDS}s"',
      '--max-budget-usd "${MAX_COST_USD}"',
      '--task-budget "${MAX_TOKENS}"',
      '--max-turns "${MAX_TOOL_CALLS}"',
      "--output-format json",
      '--json-schema "${evidence_schema}"',
      "execution_profile",
      "commands_executed",
      "test_results",
      "changed_paths",
      "security_findings",
      ".structured_output",
    ],
    "bounded invocation and callback evidence are required",
  );
  const schemaMatch = run.match(/evidence_schema='([^'\n]+)'/u);
  let evidenceSchema;
  try {
    evidenceSchema = JSON.parse(schemaMatch?.[1] ?? "");
  } catch {
    fail("bounded invocation and callback evidence are required");
  }
  const evidenceFields = [
    "execution_profile",
    "commands_executed",
    "test_results",
    "skipped_failed_checks",
    "changed_paths",
    "dependency_changes",
    "security_findings",
    "unresolved_decisions",
  ];
  if (
    evidenceSchema.additionalProperties !== false ||
    !Array.isArray(evidenceSchema.required) ||
    JSON.stringify([...evidenceSchema.required].sort()) !== JSON.stringify([...evidenceFields].sort()) ||
    evidenceSchema.properties?.execution_profile?.const !== EXECUTION_PROFILE
  ) {
    fail("bounded invocation and callback evidence are required");
  }
  if (
    action.outputs?.execution_profile?.value !==
      "${{ steps.run_claude.outputs.execution_profile || steps.run_droid.outputs.execution_profile }}" ||
    action.outputs?.evidence?.value !== "${{ steps.run_claude.outputs.evidence || steps.run_droid.outputs.evidence }}"
  ) {
    fail("action must expose profile-bound structured callback evidence");
  }

  validateDroidExecutionAction(action);
  return action;
}

export function validateDroidExecutionAction(action) {
  if (action?.runs?.using !== "composite") fail("Droid execution action must remain composite");
  const serialized = JSON.stringify(action);
  if (DIRECT_KEY_NAME.test(serialized)) fail("direct provider or master key names are forbidden");

  const inputs = action.inputs ?? {};
  const ceilings = {
    max_runtime_seconds: "1800",
    max_cost_usd: "25",
    max_tokens: "200000",
    max_tool_calls: "500",
  };
  for (const [name, expected] of Object.entries(ceilings)) {
    if (inputs[name]?.default !== expected) fail(`${name} must keep the reviewed fixed ceiling`);
  }
  if (inputs.litellm_coding_virtual_key?.default !== "" || inputs.litellm_coding_virtual_key?.required !== false) {
    fail("only the optional scoped virtual-key input is allowed");
  }

  const install = stepByName(action, "Install verified Droid CLI (agent=droid)");
  if (install.if !== "${{ inputs.agent == 'droid' }}") fail("Droid installer must be agent-scoped");
  if (install.env?.DROID_VERSION !== DROID_VERSION) fail("exact Droid version is required");
  if (install.env?.DROID_LINUX_X64_SHA256 !== DROID_LINUX_X64_SHA256) {
    fail("reviewed Droid artifact digest is required");
  }
  const installRun = String(install.run ?? "");
  includesEvery(
    installRun,
    [
      "https://downloads.factory.ai/factory-cli/releases/${DROID_VERSION}/linux/x64/droid",
      "sha256sum -c -",
      'install -m 0755 "${artifact}" "${RUNNER_TEMP}/droid"',
      'FACTORY_DROID_AUTO_UPDATE_ENABLED=false "${RUNNER_TEMP}/droid" --version',
    ],
    "installer must verify Droid SHA-256 and assert the installed version",
  );
  if (installRun.indexOf("sha256sum -c -") > installRun.indexOf("install -m 0755")) {
    fail("installer must verify Droid SHA-256 before install");
  }
  if (/@latest\b|:latest\b|app\.factory\.ai\/cli/u.test(installRun)) {
    fail("installer must use only the verified Droid artifact");
  }
  if (JSON.stringify(install).includes("litellm_coding_virtual_key")) {
    fail("Droid installer must not receive the virtual key");
  }

  const gate = stepByName(action, "Require reviewed Droid activation (agent=droid)");
  if (gate.env?.DROID_EXECUTION_ENABLED !== "false") fail("Droid execution must remain disabled");
  const gateRun = String(gate.run ?? "");
  if (
    gate.if !== "${{ inputs.agent == 'droid' }}" ||
    gate["continue-on-error"] === true ||
    !gateRun.includes('[[ "${DROID_EXECUTION_ENABLED}" != "true" ]]') ||
    !gateRun.includes("exit 1") ||
    /DROID_EXECUTION_ENABLED\s*=/u.test(gateRun) ||
    gateRun.includes("droid exec")
  ) {
    fail("Droid activation gate must remain unconditional fail-closed");
  }

  const runStep = stepByName(action, "Run bounded Droid (agent=droid)");
  if (runStep.id !== "run_droid" || runStep.if !== "${{ inputs.agent == 'droid' }}") {
    fail("bounded Droid step requires stable agent-scoped output id");
  }
  if (action.runs.steps.indexOf(gate) >= action.runs.steps.indexOf(runStep)) {
    fail("Droid activation gate must precede every Droid invocation");
  }
  if (
    runStep.env?.DROID_EXECUTION_PROFILE !== DROID_EXECUTION_PROFILE ||
    runStep.env?.LITELLM_BASE_URL !== "${{ inputs.litellm_base_url }}" ||
    runStep.env?.LITELLM_CODING_VIRTUAL_KEY !== "${{ inputs.litellm_coding_virtual_key }}" ||
    runStep.env?.FACTORY_DROID_AUTO_UPDATE_ENABLED !== "false"
  ) {
    fail("bounded Droid step must bind only the reviewed LiteLLM route and scoped virtual key");
  }
  const run = String(runStep.run ?? "");
  if (DIRECT_KEY_NAME.test(run) || !run.includes('"${LITELLM_CODING_VIRTUAL_KEY}"')) {
    fail("bounded Droid step must use only the scoped LiteLLM virtual key");
  }
  if (!run.includes('case "${current_branch}" in') || !run.includes("agent/*) ;;")) {
    fail("Droid agent branch gate is required");
  }
  includesEvery(
    run,
    [
      '.customModels[0].apiKey == "${LITELLM_CODING_VIRTUAL_KEY}"',
      '.maxAutonomyLevel == "low"',
      '.mcpPolicy == {"enabled":false,"allowlist":[]}',
      'index("curl")',
      'index("gh")',
      'index("git push")',
      'index("git commit")',
      'index("aws")',
      'index("kubectl")',
      'index("terraform")',
      'index("docker")',
      "--auto low",
      '--disabled-tools "FetchUrl,WebSearch"',
      'HOME="${droid_home}"',
    ],
    "Droid tool and command policy must deny network, deploy, commit, push, and MCP access",
  );
  includesEvery(
    run,
    [
      'timeout --signal=TERM --kill-after=30s "${MAX_RUNTIME_SECONDS}s"',
      "select(. > 0 and . <= 25)",
      "(( MAX_TOKENS > 200000 ))",
      "(( MAX_TOOL_CALLS > 500 ))",
      '(.num_turns | type) == "number" and .num_turns >= 0 and .num_turns <= ($max_turns | tonumber)',
      "--output-format json",
      "execution_profile",
      "commands_executed",
      "test_results",
      "changed_paths",
      "all(.commands_executed[];",
      "all(.test_results[];",
      'all(.security_findings[]; type == "string")',
      "unresolved_decisions",
    ],
    "bounded Droid invocation and evidence are required",
  );
  if (
    action.outputs?.execution_profile?.value !==
      "${{ steps.run_claude.outputs.execution_profile || steps.run_droid.outputs.execution_profile }}" ||
    action.outputs?.evidence?.value !== "${{ steps.run_claude.outputs.evidence || steps.run_droid.outputs.evidence }}"
  ) {
    fail("action must expose Droid profile-bound structured callback evidence");
  }
  return action;
}
