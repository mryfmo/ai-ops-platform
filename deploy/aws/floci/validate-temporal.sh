#!/usr/bin/env bash
# 根拠: ADR-0029 / DEV-T01 / ENV-DEC-003 — dev-only Terraform pre-validation.
# @file deploy/aws/floci/validate-temporal.sh
# @brief Pre-validate the Temporal Terraform module against local Floci only.
# @description
#   Rejects ambient AWS identities, starts digest-pinned Floci with Docker
#   Compose, copies the production module plus a dev-only provider override to
#   an ephemeral directory, and runs init/validate/plan. FLOCI_APPLY=1 adds a
#   bounded task-definition/secrets/Cloud Map apply, smoke, and destroy cycle;
#   it never starts the Temporal ECS service or an RDS instance.
# @option FLOCI_ENDPOINT Local endpoint; only localhost:4566 or 127.0.0.1:4566 is accepted.
# @option FLOCI_APPLY Set to 1 for bounded apply/smoke/destroy (default: 0).
# @option KEEP_FLOCI Set to 1 to keep the emulator running after validation (default: 0).
# @example
#   ./deploy/aws/floci/validate-temporal.sh
# @example
#   FLOCI_APPLY=1 ./deploy/aws/floci/validate-temporal.sh
set -euo pipefail

readonly FLOCI_DUMMY_ACCESS_KEY="000000000000"
readonly FLOCI_DUMMY_SECRET_KEY="floci"
floci_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$floci_dir/../../.." && pwd)"
readonly floci_dir repo_root
readonly temporal_dir="$repo_root/deploy/aws/temporal"
readonly floci_endpoint="${FLOCI_ENDPOINT:-http://127.0.0.1:4566}"
readonly floci_apply="${FLOCI_APPLY:-0}"
readonly keep_floci="${KEEP_FLOCI:-0}"

floci_workdir=""
floci_started=0
floci_applied=0

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# @description Reject credentials or endpoints that could route Terraform to real AWS.
guard_aws_environment() {
  case "$floci_endpoint" in
    http://localhost:4566 | http://127.0.0.1:4566) ;;
    *) fail "FLOCI_ENDPOINT must be loopback port 4566" ;;
  esac
  case "$floci_apply" in
    0 | 1) ;;
    *) fail "FLOCI_APPLY must be 0 or 1" ;;
  esac

  local name value
  for name in AWS_PROFILE AWS_DEFAULT_PROFILE AWS_SESSION_TOKEN AWS_SECURITY_TOKEN AWS_ROLE_ARN \
    AWS_WEB_IDENTITY_TOKEN_FILE AWS_CONTAINER_CREDENTIALS_FULL_URI \
    AWS_CONTAINER_CREDENTIALS_RELATIVE_URI; do
    value="${!name-}"
    [ -z "$value" ] || fail "$name must be unset for Floci validation"
  done
  if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ "$AWS_ACCESS_KEY_ID" != "$FLOCI_DUMMY_ACCESS_KEY" ]; then
    fail "AWS_ACCESS_KEY_ID is not the Floci dummy value"
  fi
  if [ -n "${AWS_SECRET_ACCESS_KEY:-}" ] && [ "$AWS_SECRET_ACCESS_KEY" != "$FLOCI_DUMMY_SECRET_KEY" ]; then
    fail "AWS_SECRET_ACCESS_KEY is not the Floci dummy value"
  fi
  if [ -n "${AWS_ENDPOINT_URL:-}" ] && [ "$AWS_ENDPOINT_URL" != "$floci_endpoint" ]; then
    fail "AWS_ENDPOINT_URL does not match FLOCI_ENDPOINT"
  fi
  while IFS='=' read -r name _; do
    case "$name" in
      AWS_ENDPOINT_URL_*) fail "$name must be unset; one loopback Floci endpoint is required" ;;
    esac
  done < <(env)
}

# @description Destroy bounded local resources and stop Floci without masking the original exit code.
cleanup() {
  local exit_code=$?
  local down_failed=0
  local destroy_failed=0
  set +e
  if [ "$floci_applied" = "1" ] && [ -n "$floci_workdir" ]; then
    terraform -chdir="$floci_workdir" destroy -auto-approve -input=false -lock=false \
      -var-file="$floci_dir/temporal.dev.tfvars" >/dev/null || destroy_failed=1
  fi
  if [ "$floci_started" = "1" ] && [ "$keep_floci" != "1" ]; then
    docker compose -p aiops-floci -f "$floci_dir/compose.yaml" down --remove-orphans >/dev/null || down_failed=1
  fi
  if [ -n "$floci_workdir" ]; then
    if [ "$destroy_failed" = "1" ] && [ "$keep_floci" = "1" ]; then
      echo "ERROR: Floci destroy failed; Terraform state retained at $floci_workdir" >&2
    else
      rm -rf -- "$floci_workdir"
    fi
  fi
  if [ "$down_failed" = "1" ]; then
    echo "ERROR: failed to stop the privileged Floci container" >&2
    [ "$exit_code" != "0" ] || exit_code=1
  fi
  exit "$exit_code"
}
trap cleanup EXIT

guard_aws_environment

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "SKIP: Docker with the Compose plugin is required; Apple container is not a Docker socket runtime."
  exit 0
fi
docker_endpoint=""
if [ -n "${DOCKER_CONTEXT:-}" ]; then
  docker_endpoint="$(docker context inspect "$DOCKER_CONTEXT" --format '{{.Endpoints.docker.Host}}')"
elif [ -n "${DOCKER_HOST:-}" ]; then
  docker_endpoint="$DOCKER_HOST"
else
  docker_endpoint="$(docker context inspect "$(docker context show)" --format '{{.Endpoints.docker.Host}}')"
fi
case "$docker_endpoint" in
  unix://*) ;;
  *) fail "Docker endpoint must be a local unix socket" ;;
esac
if ! docker info >/dev/null 2>&1; then
  echo "SKIP: Docker daemon is unavailable; start an Owner-managed Docker runtime such as Colima."
  exit 0
fi
for command_name in terraform curl jq; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done
if [ "$floci_apply" = "1" ]; then
  command -v aws >/dev/null 2>&1 || fail "aws CLI is required when FLOCI_APPLY=1"
fi

export AWS_ACCESS_KEY_ID="$FLOCI_DUMMY_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$FLOCI_DUMMY_SECRET_KEY"
export AWS_ENDPOINT_URL="$floci_endpoint"
export AWS_REGION="ap-northeast-1"
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_EC2_METADATA_DISABLED=true
export AWS_CONFIG_FILE=/dev/null
export AWS_SHARED_CREDENTIALS_FILE=/dev/null
export NO_PROXY="127.0.0.1,localhost${NO_PROXY:+,$NO_PROXY}"
export no_proxy="127.0.0.1,localhost${no_proxy:+,$no_proxy}"

if ! docker compose -p aiops-floci -f "$floci_dir/compose.yaml" pull; then
  echo "SKIP: digest-pinned Floci image could not be pulled; network access may be unavailable."
  exit 0
fi
floci_started=1
docker compose -p aiops-floci -f "$floci_dir/compose.yaml" up -d

for _ in $(seq 1 30); do
  if curl -fsS --connect-timeout 1 --max-time 2 "$floci_endpoint/_localstack/health" >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS --connect-timeout 1 --max-time 2 "$floci_endpoint/_localstack/health" >/dev/null || fail "Floci did not become ready"

floci_workdir="$(mktemp -d "${TMPDIR:-/tmp}/aiops-floci-temporal.XXXXXX")"
cp "$temporal_dir"/*.tf "$floci_workdir/"
cp "$temporal_dir/.terraform.lock.hcl" "$floci_workdir/"
cp "$temporal_dir/floci_override.tf.example" "$floci_workdir/floci_override.tf"

terraform -chdir="$floci_workdir" init -backend=false -input=false
terraform -chdir="$floci_workdir" validate
terraform -chdir="$floci_workdir" plan -input=false -lock=false \
  -var-file="$floci_dir/temporal.dev.tfvars" -out="$floci_workdir/temporal.plan"
terraform -chdir="$floci_workdir" show -json "$floci_workdir/temporal.plan" | jq -r '
  [.resource_changes[]?.change.actions] as $actions |
  "PLAN PASS: create=\($actions | map(select(. == ["create"])) | length) " +
  "update=\($actions | map(select(. == ["update"])) | length) " +
  "delete=\($actions | map(select(. == ["delete"])) | length)"'

if [ "$floci_apply" = "0" ]; then
  echo "FLOCI PASS: init/validate/plan completed; apply/smoke/destroy not requested."
  exit 0
fi

floci_applied=1
terraform -chdir="$floci_workdir" apply -auto-approve -input=false -lock=false \
  -var-file="$floci_dir/temporal.dev.tfvars" \
  -target=aws_ecs_task_definition.temporal \
  -target=aws_secretsmanager_secret.worker_token \
  -target=aws_service_discovery_service.temporal

task_definition="$(aws --endpoint-url "$floci_endpoint" ecs describe-task-definition \
  --task-definition aiops-temporal-dev --output json)"
echo "$task_definition" | jq -e '
  .taskDefinition.family == "aiops-temporal-dev" and
  ([.taskDefinition.containerDefinitions[] | select(.name == "temporal") | .secrets | length][0] >= 7)' >/dev/null
aws --endpoint-url "$floci_endpoint" secretsmanager list-secrets --output json | jq -e '
  [.SecretList[] | select(.Name | contains("/worker-token/"))] | length == 2' >/dev/null
aws --endpoint-url "$floci_endpoint" servicediscovery list-namespaces --output json | jq -e '
  any(.Namespaces[]; .Name == "dev.aiops.internal")' >/dev/null

terraform -chdir="$floci_workdir" destroy -auto-approve -input=false -lock=false \
  -var-file="$floci_dir/temporal.dev.tfvars"
floci_applied=0
echo "FLOCI PASS: bounded apply/smoke/destroy completed without starting ECS service or RDS."
