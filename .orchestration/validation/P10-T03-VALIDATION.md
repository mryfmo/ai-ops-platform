# P10-T03 Validation

Date: 2026-08-17

## Test-first evidence

The initial module tests failed on undeclared service IAM, KMS, secret-policy,
and rotation resources. After implementation:

| Check | Result |
| --- | --- |
| Identity mock test | 2 passed, 0 failed |
| Secrets/KMS mock test | 4 passed, 0 failed |
| ECS service-role selection mock test | 1 passed, 0 failed |
| Identity module validate | valid |
| Secrets Manager module validate | valid |
| Mock-only integration entrypoint | `IDENTITY PASS` |
| Ambient access-key negative test | exit 1 before Terraform: credential rejected |
| All nine modules + current composition static validation | `STATIC PASS` |
| Rebasing onto PR #254 merge | clean; unrelated tracked diff restored by autostash |
| Updated composition loopback Floci plan | create=84, update=0, delete=0; prod DR copy enabled |
| Fresh-DB `mise run ci` outside sandbox | exit 0 |
| Independent Codex reviews | 9 P1 and 1 P2 findings found and resolved |

Mock assertions cover exact GitHub audience/repository/protected environment, fixed role maps,
LiteLLM-only Bedrock access, LiteLLM-to-Temporal secret denial, explicit role/
access-key denials, CMK rotation, `kms:ViaService`, `BlockPublicPolicy`, exact
secret principals, rotation cadence, absence of an unverifiable break-glass role, and
service-keyed ECS role selection. The Floci plan additionally asserts the CMK,
bootstrap-time absence of rotation and break-glass resources, exact LiteLLM secret policy, secretless web
task definition, per-service role-map references, and absence of IAM users or
access-key resources.

The independent review identified that a supplied rotation role was exempted
from `DenyUnexpectedPrincipals` on non-rotated secrets. A new assertion first
failed against that policy shape; after the resource-policy allowlist became
secret-specific, both module suites passed (2/2 each).

Independent reviews established that `aws:MultiFactorAuthPresent` is absent for
federated identities and that `aws:PrincipalTag/amr=mfa` is not a safe
replacement: AWS merges IdP session tags, transitive tags, and static role tags
under that key. The break-glass role, KMS grant, and secret-policy grants were
therefore removed. Module and composition plans assert that no break-glass role
exists; the runbook records the future verifiable-IdP gate.

Another exact-commit review found remaining privilege-expansion paths.
The GitHub role now unconditionally denies KMS tag mutation, preventing an
optional allow policy from relabeling a foreign-environment key around the
tag-based crypto deny. Negative module and root-plan assertions cover the fix.

The following exact-commit review found that the rotation frame created a
schedule without granting Secrets Manager permission to invoke the supplied
Lambda. Each rotated secret now creates a same-account, secret-scoped
`aws_lambda_permission`, and the schedule explicitly depends on that grant.
Module and root-plan assertions cover its principal and account scope.

Another exact-commit review found deployment-path gaps. Rotation permission
and schedules now remain absent by default until an external bootstrap produces
a tested `AWSCURRENT` value and a later reviewed plan sets
`enable_rotation=true`. Negative module tests and the disabled composition plan
cover the path.

The final bootstrap-path review found that the rotation role was deliberately
excluded from non-rotated secrets but no other principal could create their
initial versions. A distinct environment bootstrap role is now present on every
declared secret policy. Its secret actions are only `DescribeSecret` and
`PutSecretValue`; its KMS statement permits encryption/data-key generation only
through Secrets Manager and omits decrypt. Module tests cover every declared
secret and the Floci composition asserts the non-rotated LiteLLM policy.

The next exact-commit review found that a branch-only GitHub OIDC subject was
identical across all environment roles and bypassed protected-environment
approval. The trust now restores the exact `repository + environment` subject
from the baseline. The module mock asserts that exact subject while the Floci
composition asserts the repository/environment input references (the trust JSON
is unknown until the OIDC provider ARN exists). Each GitHub Environment must
separately restrict deployment branches before issuing the token.

## No-real-AWS boundary

`deploy/aws/test-identity-secrets.sh` rejects access keys, sessions, profiles,
web-identity/container credential sources, role ARNs, and endpoint overrides.
Terraform tests use `mock_provider "aws"`; the Floci check uses the existing
loopback-only credential guard. No apply or real policy simulation occurred.

## Full CI

A new local PostgreSQL 16 container used loopback port 55433 with fresh
`aiops_p001`, `aiops_test`, and `aiops_load_test` databases. The first sandboxed
attempt stopped at a `tsx` IPC `EPERM`; the required sandbox-external rerun then
reached a README formatting failure. After formatting only that file, the full
rerun passed governance, 25 OPA tests, 63 contract tests, audit/actionlint,
lint/traceability/format, build/typecheck, all coverage suites (including 940
server and 333 web tests), and the destructive-negative/idempotent PostgreSQL
integration. The task container was then stopped and deleted.

Both credential guards rejected an ambient non-dummy access key before Terraform
or a container runtime. The scoped secret scan found no access key, private key,
or secret assignment pattern.
