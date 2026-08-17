# P10-T05 Report

- Worker: `codex-deep-dot`
- Branch: `agent/P10-T05-deploy-pipelines`
- Base: `7ac8f46a0013f3a046cb050acb5ffa15dc760fa4`
- Scope: digest-only image release, provenance, staged ECS rollout, rollback, and structural validation

## Result

[memory:decision] Image release builds only the repository's LiteLLM recipe,
publishes an immutable source-SHA tag, captures the ECR digest, and binds the
SPDX SBOM, keyless Cosign signature, and GitHub build provenance to that exact
digest. GitHub OIDC is the sole AWS credential path and every external action is
pinned to a full commit SHA.

[memory:decision] Production uses ECS native `LINEAR` traffic shifting at ten
percent increments with one `PRE_PRODUCTION_TRAFFIC_SHIFT` pause hook. After the
single continuation ECS advances automatically; the workflow observes explicit
0/10/50/100 gates and the configured CloudWatch alarm. Rollback runs inside the
already-approved production Environment job so it cannot wait for a second
approval, and it succeeds only at ECS's terminal rollback state.

## Delivered

- `.github/workflows/release-image.yml`: immutable ECR build/push, digest output,
  SBOM, keyless signing, and registry provenance.
- `.github/workflows/deploy-image.yml`: digest-only staging then protected
  production rollout with ordered gates and failure rollback.
- `deploy/aws/ecs-release.sh`: fail-closed ECS task-definition promotion,
  deployment observation, alarm checking, pause continuation, and rollback.
- `contracts/deploy-workflow/`: dependency-free structural validator and
  positive/adversarial tests for actions, OIDC, digests, approvals, rollout, and
  rollback.
- `runbooks/aws-image-rollout.md`: release, rollout, stop, and rollback procedure.

## Security invariants

- Mutable image references and cross-repository previous-image references are
  rejected before AWS calls.
- Static AWS keys, credential secrets, floating actions, missing OIDC, arbitrary
  build contexts, tag-scoped attestations, skipped rollout gates, and detached
  rollback jobs are rejected by the contract tests.
- The workflow grants only `contents: read`, `id-token: write`, and the
  release-only attestation permission; checkout credentials are not persisted.
- The existing PR #255 identity/IAM/Terraform paths were not modified. Role ARNs,
  cluster/service names, alarm names, and target-group inputs remain Environment
  variables for post-merge wiring.

## Deferred gate

No real AWS build, signature, deployment, traffic shift, alarm, or rollback was
run. REL-003 remains deferred until approved staging credentials, GitHub
Environment protection, alternate target groups, current AWS CLI/API support,
and representative traffic are available. Local evidence proves structure and
fail-closed input behavior only.

## CompactionDB

The required project-memory path `.claude/hooks/contextdb_cli.py` is absent in
this checkout, so no project DB mutation was possible. Durable decisions are
recorded above with `[memory:decision]` markers.

## Independent review disposition

The exact initial commit review found two P1 issues: it incorrectly treated the
one-shot ECS pre-traffic pause as reusable at every linear increment, and rollback
could fall through after polling timeout without a terminal success state. The
implementation now continues once, observes ECS's automatic baked increments,
accepts an already-reached gate only after status/alarm validation, adds regression
checks, and retains state while failing any non-terminal rollback timeout.
Targeted tests and fresh-DB full CI passed after the first review fixes; the
delayed-runner race received the same validation, and its exact-commit review
reported no actionable regression before RESULT.

## Evidence

- Validation: `.orchestration/validation/P10-T05-VALIDATION.md`
- Sandbox: `.orchestration/sandboxes/P10-T05-SANDBOX.md`
- Learning: `.orchestration/learning/P10-T05-LEARNING.md`
- AutoSkill: `.orchestration/autoskill/runs/P10-T05.md`
