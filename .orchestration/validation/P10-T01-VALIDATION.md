# P10-T01 Validation

Date: 2026-08-16

## Terraform and shell

| Check | Result |
| --- | --- |
| Initial test-first `P10_T01_STATIC_ONLY=1 ./deploy/aws/validate-modules.sh` before implementation | exit 1, `missing module: cloudfront` |
| `terraform fmt -recursive deploy/aws/modules deploy/aws/envs` | exit 0 |
| `terraform fmt -check -recursive deploy/aws/modules deploy/aws/envs` | exit 0 |
| `bash -n deploy/aws/validate-modules.sh` | exit 0 |
| `shellcheck deploy/aws/validate-modules.sh` | exit 0 |
| `git diff --check` | exit 0 |
| `gitleaks git --staged --redact --no-banner` | exit 0, no leaks |
| `P10_T01_STATIC_ONLY=1 ./deploy/aws/validate-modules.sh` | exit 0; all nine modules and root valid |
| `./deploy/aws/validate-modules.sh` | exit 0; `FLOCI PLAN PASS: create=49 update=0 delete=0` |

The full check used Terraform 1.15.8 and the exact `hashicorp/aws` 5.100.0 lock.
It started the existing digest-pinned Floci image through Apple Container 1.2.2,
bound it to `127.0.0.1:4566`, and removed the disposable container and Terraform
copy on exit. It did not invoke `terraform apply`.

## Credential guard

| Case | Expected/result |
| --- | --- |
| Unset ambient AWS identity + guard-only | exit 0, guard pass |
| `AWS_PROFILE=production` | exit 1 before Terraform/runtime |
| non-dummy `AWS_ACCESS_KEY_ID` | exit 1 before Terraform/runtime |
| external `FLOCI_ENDPOINT=https://ec2.amazonaws.com` | exit 1 before Terraform/runtime |
| service-specific `AWS_ENDPOINT_URL_S3` | exit 1 before Terraform/runtime |
| injected `TF_CLI_ARGS=-auto-approve` | exit 1 before Terraform/runtime |

The committed script additionally rejects default profiles, session/security
tokens, role/web-identity credentials, container credential URIs, non-dummy
secret keys, conflicting global endpoints, and all `TF_CLI_ARGS_*` variants.

## Placeholder and overlap checks

- Identifier scan found only `000000000000` synthetic account placeholders in
  tfvars/example ARNs and ECR image references.
- GitHub file lists for PRs #243, #244, #245, #246, and #247 were inspected with
  `gh`; no `deploy/aws/modules/**`, `deploy/aws/envs/**`, or P10-T01 evidence path
  was present.
- Existing `deploy/aws/temporal/**` and `deploy/aws/floci/**` have no diff.

## Repository CI

The first run stopped at Prettier because the new README needed formatting. The
README alone was formatted, then the same still-unused fresh databases were used
for a complete rerun:

```text
CI=true
AIOPS_TEST_DATABASE_NAME=aiops_p10t01_1454_test
AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:5432/aiops_p10t01_1454_load
TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:5432/aiops_p10t01_1454_p001
P001_ALLOW_DISPOSABLE_DB=1
mise run ci
```

Result: exit 0. Governance, policy, contracts, audit, actionlint, lint,
traceability, format, build, typecheck, coverage, and DB integration all passed.
This final run followed the review fix and used three newly created databases.
The temporary PostgreSQL 16 cluster was stopped after completion.

## Review gate

- `make require-crit-review`: exit 2, target absent in this repository.
- `crit status --json`: exit 0, `review_file_exists=false`.
- Browser Crit was not opened because project instructions prohibit human-review
  requests through Crit.
- Staged-diff fallback evidence: `.orchestration/reviews/P10-T01-REVIEW.json`.
- Receipt: `.orchestration/reviews/P10-T01-RECEIPT.md`.
- Finding `P10-T01-SELF-001` was resolved before final validation.
