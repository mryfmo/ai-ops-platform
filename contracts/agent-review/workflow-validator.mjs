// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-002 / FinalArch:FR-AGT-005 / FinalArch:COD-006 / ADR-0027 / WBS P8-T06
const REQUIRED_INPUTS = [
  "task_manifest_path",
  "manifest_digest",
  "base_sha",
  "head_sha",
  "reviewer_agent_id",
  "reviewer_execution_profile",
];

function fail(message) {
  throw new TypeError(message);
}

function assertReadOnlyPermissions(permissions, label) {
  if (
    permissions === null ||
    typeof permissions !== "object" ||
    Array.isArray(permissions) ||
    Object.keys(permissions).length !== 1 ||
    permissions.contents !== "read"
  ) {
    fail(`${label} permissions must be exactly contents: read`);
  }
}

export function validateReviewWorkflow(workflow) {
  if (!workflow?.on?.workflow_dispatch || Object.keys(workflow.on).length !== 1) {
    fail("review workflow must use only workflow_dispatch");
  }
  const inputs = workflow.on.workflow_dispatch.inputs;
  if (
    Object.keys(inputs ?? {})
      .sort()
      .join() !== [...REQUIRED_INPUTS].sort().join()
  ) {
    fail("review workflow inputs must be exactly the review contract inputs");
  }
  for (const name of REQUIRED_INPUTS) {
    if (inputs?.[name]?.required !== true || inputs[name].type !== "string") {
      fail(`workflow input ${name} must be a required string`);
    }
  }

  assertReadOnlyPermissions(workflow.permissions, "workflow");
  const job = workflow.jobs?.["independent-review"];
  if (!job || Object.keys(workflow.jobs).length !== 1) fail("workflow must contain only independent-review");
  assertReadOnlyPermissions(job.permissions, "review job");

  const serialized = JSON.stringify(workflow);
  if (/\bsecrets\./u.test(serialized)) fail("review workflow must not receive secrets");
  if (/\bgit\b[^\n;&|]*\b(?:push|commit)\b|\bgh\s+pr\s+(?:merge|review)\b/iu.test(serialized)) {
    fail("review workflow contains a branch mutation command");
  }

  const checkouts = job.steps.filter(
    (step) => typeof step.uses === "string" && step.uses.startsWith("actions/checkout@"),
  );
  if (checkouts.length !== 2) fail("review workflow must separate trusted and target checkouts");
  for (const checkout of checkouts) {
    if (!/^actions\/checkout@[a-f0-9]{40}$/u.test(checkout.uses)) fail("checkout action must be SHA-pinned");
    if (checkout.with?.["persist-credentials"] !== false) fail("checkout must set persist-credentials: false");
  }
  const targetCheckout = checkouts.find((step) => step.name === "Checkout review target");
  if (targetCheckout?.with?.path !== "review-target") fail("review target must use an isolated checkout path");

  for (const step of job.steps) {
    if (step["working-directory"] === "review-target" || String(step.uses ?? "").startsWith("./review-target")) {
      fail("review target must remain data-only");
    }
  }
  const collector = job.steps.find((step) => String(step.run ?? "").includes("node scripts/collect-agent-review.mjs"));
  if (!collector) fail("trusted collector step is required");
  if (collector.env?.REVIEWER_AGENT_ID !== "${{ inputs.reviewer_agent_id }}") {
    fail("collector reviewer identity must come from the dispatch input");
  }
  if (collector.env?.REVIEWER_EXECUTION_PROFILE !== "${{ inputs.reviewer_execution_profile }}") {
    fail("collector reviewer profile must come from the dispatch input");
  }
  if (collector.env?.MANIFEST_DIGEST !== "${{ inputs.manifest_digest }}") {
    fail("collector manifest digest must come from the dispatch input");
  }

  const upload = job.steps.find((step) => String(step.uses ?? "").startsWith("actions/upload-artifact@"));
  if (!/^actions\/upload-artifact@[a-f0-9]{40}$/u.test(upload?.uses ?? "")) {
    fail("findings artifact upload must be SHA-pinned");
  }
  return workflow;
}
