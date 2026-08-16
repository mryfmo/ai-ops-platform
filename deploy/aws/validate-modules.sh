#!/usr/bin/env bash
# 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / FinalArch:FR-OBS-005 / ADR-0029 / REL-001 / P10-T01
# @file deploy/aws/validate-modules.sh
# @brief Validate the AWS baseline modules and plan them against loopback Floci only.
# @description
#   Rejects ambient AWS identities and endpoint overrides before invoking
#   Terraform or Docker. Validation runs in a disposable copy; the default mode
#   starts the existing digest-pinned Floci service and produces a dev plan.
# @option P10_T01_GUARD_ONLY Set to 1 to run only the credential guard.
# @option P10_T01_STATIC_ONLY Set to 1 to run fmt/init/validate without a plan.
# @option FLOCI_ENDPOINT Loopback endpoint; only localhost:4566 or 127.0.0.1:4566.
# @example
#   P10_T01_STATIC_ONLY=1 ./deploy/aws/validate-modules.sh
# @example
#   ./deploy/aws/validate-modules.sh
set -euo pipefail

readonly FLOCI_DUMMY_ACCESS_KEY="000000000000"
readonly FLOCI_DUMMY_SECRET_KEY="floci"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
readonly modules_dir="$script_dir/modules"
readonly envs_dir="$script_dir/envs"
readonly floci_compose="$script_dir/floci/compose.yaml"
readonly floci_endpoint="${FLOCI_ENDPOINT:-http://127.0.0.1:4566}"
readonly floci_container_name="aiops-floci-modules"
readonly guard_only="${P10_T01_GUARD_ONLY:-0}"
readonly static_only="${P10_T01_STATIC_ONLY:-0}"
readonly module_names=(cloudfront waf alb ecs-fargate ecr rds secrets-manager identity network)

workdir=""
floci_started=0
floci_runtime=""

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# @description Reject any identity or endpoint setting that could target real AWS.
guard_aws_environment() {
  case "$floci_endpoint" in
    http://localhost:4566 | http://127.0.0.1:4566) ;;
    *) fail "FLOCI_ENDPOINT must be loopback port 4566" ;;
  esac
  case "$guard_only:$static_only" in
    0:0 | 0:1 | 1:0) ;;
    *) fail "P10_T01_GUARD_ONLY and P10_T01_STATIC_ONLY must be 0 or 1 and cannot both be 1" ;;
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
      TF_CLI_ARGS | TF_CLI_ARGS_*) fail "$name must be unset; Terraform arguments are fixed by this script" ;;
    esac
  done < <(env)
}

# @description Stop the local emulator and remove the disposable Terraform copy.
cleanup() {
  local exit_code=$?
  set +e
  if [ "$floci_started" = "1" ] && [ "$floci_runtime" = "docker" ]; then
    docker compose -p aiops-floci-modules -f "$floci_compose" down --remove-orphans >/dev/null || exit_code=1
  elif [ "$floci_started" = "1" ] && [ "$floci_runtime" = "container" ]; then
    container stop "$floci_container_name" >/dev/null || exit_code=1
    container delete "$floci_container_name" >/dev/null || exit_code=1
  fi
  [ -z "$workdir" ] || rm -rf -- "$workdir"
  exit "$exit_code"
}
trap cleanup EXIT

# @description Start the digest-pinned Floci image on a local supported runtime.
start_floci() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    local docker_endpoint
    docker_endpoint="$(docker context inspect "$(docker context show)" --format '{{.Endpoints.docker.Host}}')"
    case "$docker_endpoint" in
      unix://*) ;;
      *) fail "Docker endpoint must be a local unix socket" ;;
    esac
    docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable"
    docker compose -p aiops-floci-modules -f "$floci_compose" up -d
    floci_runtime="docker"
  elif command -v container >/dev/null 2>&1 && container list >/dev/null 2>&1; then
    local floci_image
    floci_image="$(awk '$1 == "image:" { print $2; exit }' "$floci_compose")"
    [[ "$floci_image" =~ @sha256:[0-9a-f]{64}$ ]] || fail "Floci image must be digest-pinned"
    if container inspect "$floci_container_name" >/dev/null 2>&1; then
      fail "Apple container name already exists: $floci_container_name"
    fi
    container run -d --name "$floci_container_name" -p 127.0.0.1:4566:4566 \
      -e FLOCI_DEFAULT_ACCOUNT_ID="$FLOCI_DUMMY_ACCESS_KEY" \
      -e FLOCI_DEFAULT_REGION=ap-northeast-1 -e FLOCI_STORAGE_MODE=memory \
      "$floci_image" >/dev/null
    floci_runtime="container"
  else
    fail "local Docker Compose or Apple container runtime is required for the Floci plan"
  fi
  floci_started=1
}

guard_aws_environment
if [ "$guard_only" = "1" ]; then
  echo "GUARD PASS: only loopback Floci dummy credentials are permitted."
  exit 0
fi

command -v terraform >/dev/null 2>&1 || fail "terraform is required"
for module_name in "${module_names[@]}"; do
  [ -d "$modules_dir/$module_name" ] || fail "missing module: $module_name"
done
[ -f "$envs_dir/main.tf" ] || fail "missing environment composition root"
[ -f "$envs_dir/tfvars/dev.tfvars" ] || fail "missing synthetic dev tfvars"
grep -q 'valueFrom = aws_secretsmanager_secret.db_password.arn' "$script_dir/temporal/main.tf" || \
  fail "Temporal task must consume its module-owned database password secret"

terraform fmt -check -recursive "$modules_dir" "$envs_dir"
workdir="$(mktemp -d "${TMPDIR:-/tmp}/aiops-p10-t01.XXXXXX")"
cp -R "$modules_dir" "$workdir/modules"
mkdir "$workdir/envs"
cp "$envs_dir"/*.tf "$workdir/envs/"
cp "$envs_dir/.terraform.lock.hcl" "$workdir/envs/"
cp -R "$envs_dir/tfvars" "$workdir/envs/tfvars"
cp "$envs_dir/floci_override.tf.example" "$workdir/envs/floci_override.tf"
mkdir "$workdir/plugin-cache"
export TF_PLUGIN_CACHE_DIR="$workdir/plugin-cache"

for module_name in "${module_names[@]}"; do
  cp "$envs_dir/.terraform.lock.hcl" "$workdir/modules/$module_name/"
  terraform -chdir="$workdir/modules/$module_name" init -backend=false -input=false >/dev/null
  terraform -chdir="$workdir/modules/$module_name" validate
done
terraform -chdir="$workdir/envs" init -backend=false -input=false >/dev/null
terraform -chdir="$workdir/envs" validate

if [ "$static_only" = "1" ]; then
  echo "STATIC PASS: fmt/init/validate completed for all nine modules and the composition root."
  exit 0
fi

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v jq >/dev/null 2>&1 || fail "jq is required"

export AWS_ACCESS_KEY_ID="$FLOCI_DUMMY_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$FLOCI_DUMMY_SECRET_KEY"
export AWS_ENDPOINT_URL="$floci_endpoint"
export AWS_REGION="ap-northeast-1"
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_EC2_METADATA_DISABLED=true
export AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=false
export AWS_CONFIG_FILE=/dev/null
export AWS_SHARED_CREDENTIALS_FILE=/dev/null
export NO_PROXY="127.0.0.1,localhost${NO_PROXY:+,$NO_PROXY}"
export no_proxy="127.0.0.1,localhost${no_proxy:+,$no_proxy}"

start_floci
for _ in $(seq 1 30); do
  if curl -fsS --connect-timeout 1 --max-time 2 "$floci_endpoint/_localstack/health" >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS --connect-timeout 1 --max-time 2 "$floci_endpoint/_localstack/health" >/dev/null || fail "Floci did not become ready"

terraform -chdir="$workdir/envs" plan -input=false -lock=false \
  -var-file=tfvars/dev.tfvars -out="$workdir/dev.plan" >/dev/null
terraform -chdir="$workdir/envs" show -json "$workdir/dev.plan" >"$workdir/dev-plan.json"
terraform -chdir="$workdir/envs" plan -input=false -lock=false \
  -var-file=tfvars/prod.tfvars.example -out="$workdir/prod.plan" >/dev/null
terraform -chdir="$workdir/envs" show -json "$workdir/prod.plan" >"$workdir/prod-plan.json"
jq -e '
  def planned($address):
    first(.resource_changes[] | select(.address == $address) | .change.after);
  planned("module.rds.aws_db_instance.this").backup_retention_period == 35 and
  planned("module.rds.aws_db_parameter_group.this").parameter[0].name == "rds.force_ssl" and
  planned("module.rds.aws_db_parameter_group.this").parameter[0].value == "1" and
  planned("module.rds.aws_backup_plan.long_term").rule[0].lifecycle[0].delete_after == 35 and
  planned("module.rds.aws_backup_selection.rds") != null and
  planned("module.secrets_manager.aws_secretsmanager_secret.this[\"aiops-dev/database/app-password\"]") != null and
  planned("module.secrets_manager.aws_secretsmanager_secret.this[\"aiops-dev/database/litellm-password\"]") != null and
  (.configuration.root_module.module_calls.identity.expressions.secret_arns.references |
    index("var.secret_names")) != null and
  all(.resource_changes[]; .address != "module.secrets_manager.aws_secretsmanager_secret.this[\"aiops-dev/database/temporal-password\"]") and
  all(.resource_changes[]; .type != "aws_secretsmanager_secret_version")
' "$workdir/dev-plan.json" >/dev/null || fail "P10-T04 RDS backup, SSL, or secret-reference plan contract failed"
jq -e '
  def planned($address):
    first(.resource_changes[] | select(.address == $address) | .change.after);
  planned("aws_backup_vault.rds_long_term_dr[0]") != null and
  planned("aws_kms_key.rds_dr_backup[0]").enable_key_rotation == true and
  planned("aws_db_instance_automated_backups_replication.rds_dr[0]").retention_period == 35 and
  (planned("module.rds.aws_backup_plan.long_term").rule[0].copy_action | length == 1)
' "$workdir/prod-plan.json" >/dev/null || fail "P10-T04 production cross-region DR and long-term backup plan contract failed"
jq -r '
  [.resource_changes[]?.change.actions] as $actions |
  "FLOCI PLAN PASS: create=\($actions | map(select(. == ["create"])) | length) " +
  "update=\($actions | map(select(. == ["update"])) | length) " +
  "delete=\($actions | map(select(. == ["delete"])) | length); prod-dr-copy=enabled"' "$workdir/dev-plan.json"
