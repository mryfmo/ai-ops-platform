# P10-T03 Learning Triage

## Candidate

Construct exact, environment-prefixed service role ARNs inside a secret resource
policy instead of feeding identity outputs back into the secrets module. This keeps
the dependency direction `secrets -> identity` for CMK/secret identity policies and
avoids a Terraform module cycle while retaining an explicit deny for every other
principal.

## Status

Candidate validated by post-#254 Floci and fresh-DB CI, but not promoted by this
worker. A generated IAM policy that contains a not-yet-known KMS ARN is unknown
in the root plan; test its exact JSON in the module mock suite and use the root
plan for resource existence, input-reference, and cross-module wiring checks.
Federated workforce sessions do not expose `aws:MultiFactorAuthPresent`, and
`aws:PrincipalTag` cannot distinguish IdP session tags from static role tags.
Do not claim MFA assurance from a principal tag alone; leave the role absent
until trust can bind to independently verifiable IdP context.
Tag-based deny boundaries are mutable unless the same principal is denied tag
mutation, and emergency access needs an IaC-enforced resource allowlist rather
than relying on the incident runbook's prose scope.
Creating a Secrets Manager rotation schedule is incomplete unless the same IaC
also grants the service principal resource-based invoke permission on the
supplied Lambda before schedule activation.
Schedule activation must be a second phase after an external `AWSCURRENT`
bootstrap because Terraform intentionally creates no secret version.
The external bootstrap must itself be represented in the resource boundary:
give a distinct environment role `PutSecretValue` on every declared secret and
KMS encrypt/data-key use through Secrets Manager, without secret read, stage
management, or KMS decrypt permission.
GitHub's default OIDC `sub` cannot simultaneously encode the ref and an
Environment. Bind AWS trust to the protected Environment so dev/staging/prod
roles differ, then enforce branch eligibility in that Environment's deployment
branch rule before token issuance.
