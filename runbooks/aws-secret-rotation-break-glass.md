<!-- 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / FinalArch:NFR-SEC-001 / ADR-0029 / REL-001 / P10-T03 -->

# AWS secret rotation and break-glass

## Status and safety boundary

This procedure governs environment-scoped AWS Secrets Manager values and the
customer-managed KMS key used for them. P10-T03 supplies policy structure only:
no secret value, real role ARN, rotation Lambda, account, or AWS operation is
authorized by the repository. The first staging execution requires the approved
AWS environment gate and must be recorded separately from local Terraform tests.

Never create an IAM user or access key for rotation, deployment, or emergency
access. GitHub deployment uses its exact repository/environment OIDC subject; workloads
use their service task/execution roles; operators use approved short-lived SSO/STS
sessions. Secret values and temporary credentials must not enter terminals with
session capture, shell history, tickets, chat, Terraform inputs/state, or evidence.

## Roles and separation

- The KMS administrator may manage key policy/lifecycle but is not a secret reader.
- Each service may read only secrets mapped to its matching environment role.
- The environment bootstrap role may describe and create a version for every
  declared environment secret. It cannot read values or move version stages.
- The rotation Lambda and its execution role are external environment inputs. The
  Terraform rotation schedule remains disabled until a bootstrap value and both
  reviewed ARNs exist. A later reviewed plan sets `enable_rotation=true`; IaC then
  grants Secrets Manager a same-account, secret-scoped invoke permission.
- No break-glass IAM role is created. AWS combines role tags, session tags, and
  transitive tags under `aws:PrincipalTag`, so that key cannot prove current MFA.
  A static `amr=mfa` role tag would satisfy the same condition. The module remains
  fail-closed until a separately reviewed IdP assurance contract is enforceable.
- The Security approver and incident commander are two different people. Neither
  workload nor GitHub role can grant itself access or chain into another role.

## Normal rotation

1. Open a restricted change record with environment, secret identifier, owner,
   consumers, current version ID, cadence, validation window, rollback deadline,
   and evidence destination. Record identifiers only.
2. Confirm the resource policy maps every consumer and rejects a role from another
   environment and an unrelated service. Confirm the KMS key is enabled, rotates,
   and permits cryptographic use only through Secrets Manager in the current region.
3. Use the reviewed environment bootstrap role to call `PutSecretValue` once for
   each declared secret. It receives no read or stage-management permission;
   validate the resulting `AWSCURRENT` through its mapped workload. Terraform
   intentionally creates no secret version. STOP if any value is absent.
4. Supply the reviewed rotation Lambda/function-role ARNs and set
   `enable_rotation=true` through environment IaC. Review the plan: it may add
   `aws_lambda_permission` and `aws_secretsmanager_secret_rotation`; it must not add
   a secret version, IAM user/access key, wildcard reader, or cross-environment ARN.
5. Let the rotation function create/test `AWSPENDING` and move `AWSCURRENT` only
   after provider-side validation. Do not manually copy a value through Terraform.
6. For ECS environment injection, deploy one immutable consumer revision so it
   receives the new current version. Validate authentication, bounded service
   behavior, denial by a sibling service role, and absence of secret material in
   logs. Repeat for every declared consumer before revocation.
7. After the approved overlap window, revoke/delete the superseded provider value
   and remove stale ECS revisions. Do not retain an old usable value merely because
   Secrets Manager still labels it `AWSPREVIOUS`.
8. Record change/rotation IDs, version IDs/stages, role session IDs, deployment
   revisions, test outcomes, denial outcomes, and CloudTrail event references.
   Never record the value, a token, ciphertext intended for later recovery, or a
   reversible digest of the value.

If validation fails before revocation and compromise is not suspected, restore the
previous version stage and previous immutable consumer revision, then diagnose. A
suspected or confirmed compromised value is never a rollback target: contain or
revoke it first, disable the affected capability if necessary, and rotate forward.

## Break-glass activation (disabled)

This baseline has no break-glass activation path. During an incident, use the
normal rotate-forward/consumer-disable procedure and the organization-approved
security escalation; do not add a principal directly to a secret or KMS policy.

Enabling break-glass requires a separate risk-critical change that directly binds
trust to a reviewed IdP assurance the caller cannot mint or persist on an IAM role.
It must prove absent/wrong/static assurance denial, exact-environment and
exact-secret scope, a maximum 60-minute session, teardown, and CloudTrail evidence
in a real staging account. A `PrincipalTag` value alone never satisfies this gate.

## Environment-gated verification

The real staging gate must use IAM policy simulation and then actual bounded calls:

- current service role + mapped secret: allow;
- same role + sibling secret: deny;
- same role + staging/prod secret from another environment: deny;
- workload role `sts:AssumeRole`, `iam:PassRole`, and access-key creation: deny;
- GitHub subject with wrong repository or environment: assume denial;
- an allowed GitHub environment from a disallowed branch: reject at that
  environment's deployment-branch protection before issuing the OIDC token;
- correct OIDC subject: short-lived assumption only, followed by cross-environment
  deploy/secret/KMS denial;
- no break-glass role/policy is planned, and every emergency principal remains denied.

Capture request parameters, decisions, role/secret/version identifiers, timestamps,
and CloudTrail event IDs without credentials or values. Local mock-provider tests
prove only policy structure and do not satisfy REL-001 real-environment acceptance.

## References

- [AWS IAM: GitHub OIDC federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html)
- [AWS Secrets Manager resource policies](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_resource-policies.html)
- [AWS Secrets Manager encryption and `kms:ViaService`](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html)
- [AWS Secrets Manager rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [AWS global condition keys for federated MFA](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html#condition-keys-multifactorauthpresent)
- [AWS STS transitive session tags](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html)
