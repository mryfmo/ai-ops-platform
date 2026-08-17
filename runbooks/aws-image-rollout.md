<!-- 根拠: FinalArch:PRD-010 / FinalArch:FR-OBS-005 / ADR-0029 / REL-003 / WBS P10-T05 -->

# AWS immutable image rollout and rollback

## Scope and hard stops

This runbook governs the `release-image` and `deploy-image` workflows. Both are
structurally validated locally; no AWS deployment has been executed by P10-T05.
REL-003 remains open until staging captures real 0/10/50/100 traffic, alarm, and
rollback evidence.

STOP before dispatch when any condition is true:

- either image is not a full ECR `repository@sha256:<64 lowercase hex>` reference;
- the release artifact's source SHA, digest, SPDX SBOM, signature, or provenance
  does not match the requested image;
- staging/production Environment protection or required reviewers are absent;
- P10-T03's environment OIDC role is not wired through `AWS_DEPLOY_ROLE_ARN`;
- ECS lacks a distinct alternate target group, LINEAR strategy support, or the
  `PRE_PRODUCTION_TRAFFIC_SHIFT` pause hook with timeout action `ROLLBACK`;
- the configured CloudWatch rollout alarm is absent or not `OK`.

## Release

1. Dispatch `release-image` with a reviewed full source commit SHA.
2. Confirm the workflow checked out that exact SHA and pushed only its immutable
   SHA tag. Copy the emitted digest reference; never deploy the tag.
3. Verify the artifact contains `manifest.json`, `image-ref.txt`, SPDX JSON, and
   the provenance bundle. Verify the registry holds the keyless cosign signature
   and provenance for the same digest.
4. Record the workflow URL, source SHA, image digest, SBOM hash, attestation URL,
   signer identity, and review decision. Do not record credentials.

## Staging and production

1. Dispatch `deploy-image` with the new digest and the currently deployed digest.
   The repository portion must be identical and the two digests must differ.
2. The staging Environment assumes its short-lived OIDC role, registers a task
   definition containing the exact digest, waits for service stability, checks the
   alarm, and reads the digest back from ECS. Any failure re-registers the recorded
   previous digest before the job exits.
3. A successful staging job reaches the production GitHub Environment. Its required
   reviewer confirms the staging evidence, release provenance, previous digest,
   alarm ownership, and on-call availability before approval.
4. Production starts at a pause hook while the new revision has 0% production
   traffic. The workflow checks ECS traffic-weight readback and the alarm before
   continuing to 10%, then through verified 10% increments to the explicit 50%
   and 100% gates. A later gate never runs when an earlier gate fails.
5. Record ECS deployment/service-revision ARNs, actual traffic weights and times,
   alarm state/history, health evidence, and final task-definition digest.

## Automatic rollback and recovery

The production failure handler runs inside the already approved Environment job;
it does not wait for a second approval. When ECS is paused, it calls
`ContinueServiceDeployment` with `ROLLBACK`; otherwise it requests an ECS service
deployment rollback. Timeout action is also `ROLLBACK`. It verifies the service
again resolves the recorded previous digest.

If automatic rollback fails, STOP traffic advancement, page the production owner,
retain both immutable digests and all CloudTrail/ECS/CloudWatch evidence, and use
the same `deploy-image` workflow only after the failed deployment reaches a terminal
state. Do not edit a task definition to a tag, disable the alarm, bypass Environment
approval, or inject access keys.

## Deferred REL-003 evidence

Before go-live, run one successful and one forced-alarm staging drill. The forced
failure must show no advancement beyond the failed gate, automatic restoration of
the previous digest, and no long-lived AWS credentials. Store the redacted traffic,
alarm, CloudTrail, workflow, signature, SBOM, and provenance evidence with the exact
workflow commit SHA.

## References

- [Amazon ECS linear deployments](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-linear.html)
- [Amazon ECS pause hooks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/pause-lifecycle-hooks.html)
- [ContinueServiceDeployment](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ContinueServiceDeployment.html)
