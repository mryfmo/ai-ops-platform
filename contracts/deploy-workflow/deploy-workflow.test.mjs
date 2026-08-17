// 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / FinalArch:FR-OBS-005 / ADR-0029 / REL-003 / WBS P10-T05
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { validateBuildWorkflow, validateRolloutWorkflow } from "./workflow-validator.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(directory, "../..");
const load = (name) =>
  YAML.parse(fs.readFileSync(path.join(repoRoot, `.github/workflows/${name}`), "utf8"), { uniqueKeys: true });
const clone = (value) => structuredClone(value);

const buildWorkflow = load("release-image.yml");
const rolloutWorkflow = load("deploy-image.yml");

describe("P10-T05 build provenance workflow [FinalArch:PRD-010 / REL-003]", () => {
  it("accepts the canonical OIDC-only digest, SBOM, signature, and provenance workflow", () => {
    assert.doesNotThrow(() => validateBuildWorkflow(clone(buildWorkflow)));
  });

  it("rejects floating actions, mutable tags, arbitrary build paths, and long-lived AWS credentials", () => {
    const floatingAction = clone(buildWorkflow);
    floatingAction.jobs["build-publish"].steps[0].uses = "actions/checkout@v7";
    assert.throws(() => validateBuildWorkflow(floatingAction), /SHA-pinned/u);

    const mutableTag = clone(buildWorkflow);
    mutableTag.jobs["build-publish"].steps.find((step) => step.id === "build").with.tags =
      "${{ vars.LITELLM_ECR_REPOSITORY_URI }}:latest";
    assert.throws(() => validateBuildWorkflow(mutableTag), /mutable image tag|immutable source-SHA tag/u);

    const arbitraryFile = clone(buildWorkflow);
    arbitraryFile.jobs["build-publish"].steps.find((step) => step.id === "build").with.file =
      "${{ inputs.dockerfile }}";
    assert.throws(() => validateBuildWorkflow(arbitraryFile), /fixed LiteLLM recipe/u);

    const accessKey = clone(buildWorkflow);
    accessKey.jobs["build-publish"].steps.push({
      name: "Unsafe static credential",
      env: { AWS_ACCESS_KEY_ID: "${{ secrets.AWS_ACCESS_KEY_ID }}" },
      run: "aws sts get-caller-identity",
    });
    assert.throws(() => validateBuildWorkflow(accessKey), /long-lived AWS credentials/u);
  });

  it("rejects missing OIDC, tag-scanned SBOM, or provenance detached from the build digest", () => {
    const noOidc = clone(buildWorkflow);
    delete noOidc.permissions["id-token"];
    assert.throws(() => validateBuildWorkflow(noOidc), /id-token: write/u);

    const tagSbom = clone(buildWorkflow);
    tagSbom.jobs["build-publish"].steps.find((step) => step.id === "sbom").with.image =
      "${{ vars.LITELLM_ECR_REPOSITORY_URI }}:${{ inputs.source_sha }}";
    assert.throws(() => validateBuildWorkflow(tagSbom), /SBOM must scan the exact digest/u);

    const wrongProvenance = clone(buildWorkflow);
    wrongProvenance.jobs["build-publish"].steps.find((step) => step.id === "provenance").with["subject-digest"] =
      "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    assert.throws(() => validateBuildWorkflow(wrongProvenance), /build digest/u);
  });
});

describe("P10-T05 staged rollout workflow [FinalArch:FR-OBS-005 / REL-003]", () => {
  it("accepts digest-only staging and one approved production job with ordered fail-closed gates", () => {
    assert.doesNotThrow(() => validateRolloutWorkflow(clone(rolloutWorkflow)));
  });

  it("rejects tag deploys, missing Environment approval, and missing OIDC", () => {
    const tagDeploy = clone(rolloutWorkflow);
    tagDeploy.on.workflow_dispatch.inputs.image_ref.default =
      "000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/aiops:latest";
    assert.throws(() => validateRolloutWorkflow(tagDeploy), /mutable default|mutable image tag/u);

    const noApproval = clone(rolloutWorkflow);
    delete noApproval.jobs.production.environment;
    assert.throws(() => validateRolloutWorkflow(noApproval), /production environment/u);

    const noOidc = clone(rolloutWorkflow);
    delete noOidc.permissions["id-token"];
    assert.throws(() => validateRolloutWorkflow(noOidc), /id-token: write/u);
  });

  it("rejects skipped or reordered 0/10/50/100 gates and non-failure rollback", () => {
    const skippedGate = clone(rolloutWorkflow);
    skippedGate.jobs.production.steps = skippedGate.jobs.production.steps.filter((step) => step.id !== "production-50");
    assert.throws(() => validateRolloutWorkflow(skippedGate), /0,10,50,100/u);

    const reordered = clone(rolloutWorkflow);
    const steps = reordered.jobs.production.steps;
    const ten = steps.findIndex((step) => step.id === "production-10");
    const fifty = steps.findIndex((step) => step.id === "production-50");
    [steps[ten], steps[fifty]] = [steps[fifty], steps[ten]];
    assert.throws(() => validateRolloutWorkflow(reordered), /ordered 0,10,50,100/u);

    const failOpen = clone(rolloutWorkflow);
    failOpen.jobs.production.steps.find((step) => step.id === "rollback-production").if = "${{ always() }}";
    assert.throws(() => validateRolloutWorkflow(failOpen), /failure-only rollback/u);

    const wrongRollback = clone(rolloutWorkflow);
    wrongRollback.jobs.production.steps.find((step) => step.id === "rollback-production").env.ROLLBACK_IMAGE_REF =
      "${{ inputs.image_ref }}";
    assert.throws(() => validateRolloutWorkflow(wrongRollback), /previous immutable digest/u);
  });

  it("rejects unpinned actions and every long-lived AWS credential reference", () => {
    const unpinned = clone(rolloutWorkflow);
    unpinned.jobs.staging.steps.find((step) => String(step.uses ?? "").startsWith("actions/checkout@")).uses =
      "actions/checkout@main";
    assert.throws(() => validateRolloutWorkflow(unpinned), /SHA-pinned/u);

    const secret = clone(rolloutWorkflow);
    secret.jobs.production.steps.push({
      name: "Static key",
      env: { AWS_SECRET_ACCESS_KEY: "${{ secrets.PROD_AWS_SECRET_ACCESS_KEY }}" },
      run: "true",
    });
    assert.throws(() => validateRolloutWorkflow(secret), /long-lived AWS credentials/u);
  });
});

describe("P10-T05 ECS release guard [FinalArch:FR-OBS-005 / REL-003]", () => {
  it("rejects a mutable image before invoking AWS", () => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), "p10-t05-bin-"));
    try {
      for (const name of ["aws", "jq"]) {
        const executable = path.join(bin, name);
        fs.writeFileSync(executable, "#!/usr/bin/env bash\nexit 99\n", { mode: 0o755 });
      }
      const result = spawnSync(
        "bash",
        [
          path.join(repoRoot, "deploy/aws/ecs-release.sh"),
          "deploy-staging",
          "000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/aiops:latest",
          `000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/aiops@sha256:${"a".repeat(64)}`,
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            AWS_REGION: "ap-northeast-1",
            ECS_CLUSTER: "test-cluster",
            ECS_SERVICE: "litellm",
            ECS_TASK_FAMILY: "test-litellm",
            ECS_CONTAINER: "litellm",
            CLOUDWATCH_ALARM_NAME: "test-alarm",
            ROLLOUT_STATE_FILE: path.join(bin, "state.json"),
          },
        },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /immutable ECR digest/u);
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });

  it("continues the single pre-traffic pause once and requires terminal rollback", () => {
    const script = fs.readFileSync(path.join(repoRoot, "deploy/aws/ecs-release.sh"), "utf8");
    assert.match(script, /stepBakeTimeInMinutes:2/u);
    assert.doesNotMatch(script, /while \(\( current < target \)\); do\s+continue_paused_deployment/u);
    assert.match(script, /if \(\( current == 0 \)\); then\s+continue_paused_deployment/u);
    assert.match(script, /\[\[ "\$rollback_complete" == true \]\] \|\| fail "timed out waiting for ECS rollback"/u);
  });
});
