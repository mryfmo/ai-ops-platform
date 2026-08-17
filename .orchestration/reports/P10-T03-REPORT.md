# P10-T03 Report

- Worker: `codex-deep-dot`
- Branch: `agent/P10-T03-identity-secrets`
- Base: `7ac8f46a0013f3a046cb050acb5ffa15dc760fa4` (PR #254 merge)
- Scope: service IAM roles, GitHub OIDC, Secrets Manager/KMS, rotation, break-glass

## Result

[memory:decision] The fixed workload boundaries are `server`, `litellm`,
`temporal`, `agentgateway`, and `opa`. Each receives a distinct execution role
and task role. Only LiteLLM may invoke declared Bedrock model ARNs; every role
denies role chaining, pass-role, and long-lived access-key creation.

[memory:decision] GitHub deployment uses OIDC only, with exact audience,
repository, and protected-environment subject claims. GitHub Environment
deployment-branch rules enforce the branch boundary before token issuance. A separate guardrail policy denies
long-lived credentials, role chaining, cross-environment secrets/KMS, and
cross-environment deploy resources even if an environment-owned optional deploy
policy over-grants.

[memory:decision] Environment secrets use an opt-in customer-managed KMS key.
Service mappings generate exact task/execution-role readers per secret;
`DenyUnexpectedPrincipals` makes sibling and cross-environment identity allows
ineffective. KMS administrators do not receive secret-read permission, and KMS
cryptographic use is limited to Secrets Manager through `kms:ViaService`.

[memory:decision] Break-glass IAM access remains disabled. AWS exposes static
role tags and session tags through the same `aws:PrincipalTag` key, so the module
cannot prove current federated MFA from `amr=mfa`; a runbook cannot repair that
trust-policy ambiguity.

## Delivered

- Extended `deploy/aws/modules/identity/main.tf` with the five service role pairs,
  exact secret/ECR scoping, LiteLLM-only Bedrock access, environment-bound GitHub OIDC,
  and explicit environment/credential guardrails.
- Extended `deploy/aws/modules/secrets-manager/main.tf` with opt-in CMK/alias,
  separate administrators/users, exact resource policies, and bounded rotation
  schedules while keeping unverifiable break-glass access absent.
- Added mock-provider tests under all three affected modules and the credential-rejecting
  `deploy/aws/test-identity-secrets.sh` entrypoint.
- Replaced the ECS module's shared role inputs with service-keyed role maps and
  wired the environment composition to the dedicated role pairs, CMK, exact
  secret/ECR maps, rotation, and declared Bedrock model inputs.
- Bounded the rotation-role resource-policy exemption to the exact secrets in
  `rotation_secret_names`; an independent Codex review found and the tests now
  cover the non-rotated-secret denial case.
- Denied KMS tag mutation to the GitHub deploy role so an over-broad optional
  deployment policy cannot retag another environment's key around the deny.
- Added a same-account, secret-scoped Lambda resource permission before each
  Secrets Manager rotation schedule; environment composition keeps both absent
  until an external `AWSCURRENT` bootstrap and explicit `enable_rotation=true`.
- Added a distinct environment bootstrap role input to every declared secret
  policy. It may only describe and create the initial version; it cannot read
  values or move stages, and its CMK grant excludes decrypt permission.
- Restored the protected GitHub Environment in the OIDC `sub`; a branch-only
  subject was identical across dev/staging/prod roles and bypassed environment
  approvals. Branch eligibility remains a mandatory Environment protection rule.
- Removed the break-glass role after exact-commit review proved its transitive
  `amr` check was also satisfied by a static role tag. The runbook now records a
  hard STOP until an independently verifiable IdP assurance boundary is designed.
- Added `runbooks/aws-secret-rotation-break-glass.md` with normal rotation,
  containment-first emergency access, expiry/revocation, and evidence rules.

## Web compatibility boundary

[memory:decision] The existing `web` service is outside P10-T03's fixed five
governed identities. Orchestrator-approved compatibility wiring gives `web` the
legacy pair alone, with an empty legacy secret list and web-only ECR scope; it is
never aliased to another service identity. Promoting `web` to its own dedicated
identity boundary is mandatory before any staging apply.

PR #254 merged, this branch rebased onto its merge commit, and the previously
STOP-gated environment/ECS/shared-validator files are now wired and green.

## Deferred environment gate

No AWS API, credential, real ARN/account, secret version, rotation Lambda, or IAM
simulation ran. Staging must prove correct-service allow and sibling/cross-env/
wrong-OIDC denials with CloudTrail evidence before REL-001 acceptance. A future
break-glass design additionally requires real absent/wrong/static-assurance tests.
Staging must also replace every placeholder and create the dedicated `web` role
pair before an apply.

## CompactionDB

The project-memory command could not run because
`.claude/hooks/contextdb_cli.py` is absent in this checkout. Durable decisions are
recorded above with `[memory:decision]` markers.

## Evidence

- Validation: `.orchestration/validation/P10-T03-VALIDATION.md`
- Sandbox: `.orchestration/sandboxes/P10-T03-SANDBOX.md`
- Learning: `.orchestration/learning/P10-T03-LEARNING.md`
- AutoSkill: `.orchestration/autoskill/runs/P10-T03.md`
