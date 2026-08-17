#!/usr/bin/env bash
# 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / ADR-0029 / REL-001 / P10-T03
# @file deploy/aws/test-identity-secrets.sh
# @brief Validate IAM, ECS role selection, and secret boundaries with Terraform's local mock provider.
# @description
#   Rejects every ambient AWS credential and endpoint before copying the three
#   modules into a disposable directory. Runs fmt, init, validate, and mock-only
#   Terraform tests; it never plans, applies, or simulates against an AWS API.
# @option TF_PLUGIN_CACHE_DIR Optional existing Terraform provider cache.
# @example
#   ./deploy/aws/test-identity-secrets.sh
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
readonly module_names=(identity secrets-manager ecs-fargate)
workdir=""

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# @description Remove the exact disposable module copy.
cleanup() {
  local exit_code=$?
  set +e
  if [ -n "$workdir" ] && [[ "$workdir" == "${TMPDIR:-/tmp}/aiops-p10-t03."* ]]; then
    rm -rf -- "$workdir"
  fi
  exit "$exit_code"
}
trap cleanup EXIT

# @description Reject credentials, role sessions, metadata sources, and endpoint overrides.
guard_aws_environment() {
  local name value
  for name in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_SECURITY_TOKEN \
    AWS_PROFILE AWS_DEFAULT_PROFILE AWS_ROLE_ARN AWS_WEB_IDENTITY_TOKEN_FILE \
    AWS_CONTAINER_CREDENTIALS_FULL_URI AWS_CONTAINER_CREDENTIALS_RELATIVE_URI \
    AWS_ENDPOINT_URL; do
    value="${!name-}"
    [ -z "$value" ] || fail "$name must be unset for mock-only validation"
  done
  while IFS='=' read -r name _; do
    case "$name" in
      AWS_ENDPOINT_URL_*) fail "$name must be unset for mock-only validation" ;;
    esac
  done < <(env)
}

guard_aws_environment
command -v terraform >/dev/null 2>&1 || fail "terraform is required"
grep -Rqs 'resource "aws_iam_access_key"' "$script_dir/modules/identity" && \
  fail "long-lived IAM access-key resources are forbidden"
grep -RqsE 'aws:PrincipalTag/amr|resource "aws_iam_role" "break_glass"' "$script_dir/modules/secrets-manager" && \
  fail "break-glass must remain absent until MFA provenance is independently verifiable"

terraform fmt -check -recursive \
  "$script_dir/modules/identity" \
  "$script_dir/modules/secrets-manager" \
  "$script_dir/modules/ecs-fargate"

workdir="$(mktemp -d "${TMPDIR:-/tmp}/aiops-p10-t03.XXXXXX")"
mkdir "$workdir/modules"
for module_name in "${module_names[@]}"; do
  cp -R "$script_dir/modules/$module_name" "$workdir/modules/$module_name"
  cp "$script_dir/envs/.terraform.lock.hcl" "$workdir/modules/$module_name/"
  terraform -chdir="$workdir/modules/$module_name" init -backend=false -input=false >/dev/null
  terraform -chdir="$workdir/modules/$module_name" validate -no-color >/dev/null
  terraform -chdir="$workdir/modules/$module_name" test -no-color
done

echo "IDENTITY PASS: mock-only IAM, ECS role selection, OIDC, KMS, secret, rotation, and fail-closed break-glass absence verified."
