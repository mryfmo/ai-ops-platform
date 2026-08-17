// 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / FinalArch:FR-OBS-005 / ADR-0029 / REL-003 / WBS P10-T05
const SHA_PIN = /^[a-z0-9_.-]+\/[a-z0-9_.-]+@[0-9a-f]{40}$/u;
const BUILD_PERMISSIONS = { attestations: "write", contents: "read", "id-token": "write" };
const DEPLOY_PERMISSIONS = { contents: "read", "id-token": "write" };

function fail(message) {
  throw new TypeError(message);
}

function assertExactObject(actual, expected, label) {
  if (JSON.stringify(Object.entries(actual ?? {}).sort()) !== JSON.stringify(Object.entries(expected).sort())) {
    fail(`${label} permissions are invalid`);
  }
}

function assertPinnedActions(workflow) {
  for (const job of Object.values(workflow.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      if (typeof step.uses === "string" && !SHA_PIN.test(step.uses)) fail("every external action must be SHA-pinned");
    }
  }
}

function assertOidcOnly(workflow) {
  const serialized = JSON.stringify(workflow);
  if (/\bsecrets\.|AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)/iu.test(serialized)) {
    fail("long-lived AWS credentials and secret references are forbidden");
  }
  assertPinnedActions(workflow);
  if (/:latest\b/u.test(serialized)) {
    fail("mutable image tag or action reference is forbidden");
  }
}

function assertDispatchInputs(workflow, names) {
  if (!workflow?.on?.workflow_dispatch || Object.keys(workflow.on).length !== 1) {
    fail("deploy workflows must use only workflow_dispatch");
  }
  const inputs = workflow.on.workflow_dispatch.inputs ?? {};
  if (Object.keys(inputs).sort().join() !== [...names].sort().join()) fail("workflow inputs are not exact");
  for (const name of names) {
    if (inputs[name]?.required !== true || inputs[name]?.type !== "string" || "default" in inputs[name]) {
      fail(`${name} must be a required string without a mutable default`);
    }
  }
}

function stepById(job, id) {
  const steps = (job.steps ?? []).filter((step) => step.id === id);
  if (steps.length !== 1) fail(`job requires exactly one ${id} step`);
  return steps[0];
}

function assertAwsConfiguration(job) {
  const configure = (job.steps ?? []).find((step) =>
    String(step.uses ?? "").startsWith("aws-actions/configure-aws-credentials@"),
  );
  if (
    !configure ||
    configure.with?.["role-to-assume"] !== "${{ vars.AWS_DEPLOY_ROLE_ARN }}" ||
    configure.with?.["aws-region"] !== "${{ vars.AWS_REGION }}" ||
    configure.with?.["allowed-account-ids"] !== "${{ vars.AWS_ACCOUNT_ID }}" ||
    configure.with?.["unset-current-credentials"] !== true
  ) {
    fail("AWS authentication must use the environment-scoped OIDC role");
  }
}

export function validateBuildWorkflow(workflow) {
  assertDispatchInputs(workflow, ["source_sha"]);
  if (workflow.permissions?.["id-token"] !== "write") fail("build workflow requires id-token: write");
  assertExactObject(workflow.permissions, BUILD_PERMISSIONS, "build workflow");
  assertOidcOnly(workflow);
  const job = workflow.jobs?.["build-publish"];
  if (!job || Object.keys(workflow.jobs).length !== 1 || job.environment !== "staging") {
    fail("build workflow requires one staging build-publish job");
  }
  assertAwsConfiguration(job);

  const checkout = job.steps.find((step) => String(step.uses ?? "").startsWith("actions/checkout@"));
  if (checkout?.with?.ref !== "${{ inputs.source_sha }}" || checkout.with?.["persist-credentials"] !== false) {
    fail("checkout must use the requested source SHA without persisted credentials");
  }
  const build = stepById(job, "build");
  if (
    !String(build.uses ?? "").startsWith("docker/build-push-action@") ||
    build.with?.context !== "." ||
    build.with?.file !== "deploy/litellm/Dockerfile"
  ) {
    fail("build must use the fixed LiteLLM recipe");
  }
  if (build.with?.push !== true || build.with?.tags !== "${{ steps.release.outputs.image-tag }}") {
    fail("build must push only the immutable source-SHA tag");
  }
  const sbom = stepById(job, "sbom");
  if (sbom.with?.image !== "${{ steps.digest.outputs.image-ref }}") {
    fail("SBOM must scan the exact digest");
  }
  const sign = stepById(job, "sign");
  if (
    sign.env?.IMAGE_REF !== "${{ steps.digest.outputs.image-ref }}" ||
    !/cosign sign --yes "\$IMAGE_REF"/u.test(sign.run)
  ) {
    fail("signature must bind the exact digest");
  }
  const provenance = stepById(job, "provenance");
  if (
    provenance.with?.["subject-name"] !== "${{ vars.LITELLM_ECR_REPOSITORY_URI }}" ||
    provenance.with?.["subject-digest"] !== "${{ steps.build.outputs.digest }}" ||
    provenance.with?.["push-to-registry"] !== true
  ) {
    fail("provenance must bind the build digest and be pushed to the registry");
  }
  return workflow;
}

export function validateRolloutWorkflow(workflow) {
  assertDispatchInputs(workflow, ["image_ref", "previous_image_ref"]);
  if (workflow.permissions?.["id-token"] !== "write") fail("rollout workflow requires id-token: write");
  assertExactObject(workflow.permissions, DEPLOY_PERMISSIONS, "rollout workflow");
  assertOidcOnly(workflow);
  const jobs = workflow.jobs ?? {};
  if (Object.keys(jobs).sort().join() !== ["production", "staging", "validate-release"].sort().join()) {
    fail("rollout workflow jobs are not exact");
  }
  if (jobs.staging?.needs !== "validate-release" || jobs.staging.environment !== "staging") {
    fail("staging environment must follow release validation");
  }
  if (jobs.production?.needs !== "staging" || jobs.production.environment !== "production") {
    fail("production environment approval must follow staging");
  }
  assertAwsConfiguration(jobs.staging);
  assertAwsConfiguration(jobs.production);

  const ids = jobs.production.steps.map((step) => step.id).filter(Boolean);
  const gates = ["production-0", "production-10", "production-50", "production-100"];
  if (!gates.every((id) => ids.includes(id))) fail("production requires 0,10,50,100 gates");
  if (
    gates.map((id) => ids.indexOf(id)).join() !==
    [...gates]
      .map((id) => ids.indexOf(id))
      .sort((a, b) => a - b)
      .join()
  ) {
    fail("production gates must remain ordered 0,10,50,100");
  }

  const commands = {
    "production-0": 'bash deploy/aws/ecs-release.sh start-production "$IMAGE_REF" "$ROLLBACK_IMAGE_REF"',
    "production-10": "bash deploy/aws/ecs-release.sh advance-production 10",
    "production-50": "bash deploy/aws/ecs-release.sh advance-production 50",
    "production-100": "bash deploy/aws/ecs-release.sh advance-production 100",
  };
  for (const [id, command] of Object.entries(commands)) {
    if (String(stepById(jobs.production, id).run).trim() !== command) fail(`${id} command is not fixed`);
  }
  const rollback = stepById(jobs.production, "rollback-production");
  if (rollback.if !== "${{ failure() }}") fail("production requires a failure-only rollback");
  if (rollback.env?.ROLLBACK_IMAGE_REF !== "${{ inputs.previous_image_ref }}") {
    fail("rollback must consume the previous immutable digest");
  }
  const stagingRollback = stepById(jobs.staging, "rollback-staging");
  if (stagingRollback.if !== "${{ failure() }}") fail("staging requires a failure-only rollback");
  return workflow;
}
