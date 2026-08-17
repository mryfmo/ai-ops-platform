#!/usr/bin/env bash

# @file deploy/aws/ecs-release.sh
# @brief Deploy and verify an immutable ECS image through staging and 0/10/50/100 production gates.
# @description
#   Uses ECS linear deployments with a PRE_PRODUCTION_TRAFFIC_SHIFT pause hook.
#   Every timeout and alarm failure rolls back; no image tag is accepted.
# 根拠: FinalArch:PRD-010 / FinalArch:FR-OBS-005 / ADR-0029 / REL-003 / WBS P10-T05

set -euo pipefail

readonly image_pattern='^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9][a-z0-9._/-]+@sha256:[0-9a-f]{64}$'

fail() {
  echo "ecs-release: $*" >&2
  exit 1
}

require_environment() {
  local name
  for name in AWS_REGION ECS_CLUSTER ECS_SERVICE ECS_TASK_FAMILY ECS_CONTAINER CLOUDWATCH_ALARM_NAME ROLLOUT_STATE_FILE; do
    [[ -n "${!name:-}" ]] || fail "$name is required"
  done
  [[ "$ECS_CONTAINER" =~ ^[A-Za-z0-9_-]+$ ]] || fail "ECS_CONTAINER is invalid"
}

assert_digest() {
  [[ "$1" =~ $image_pattern ]] || fail "image must be an immutable ECR digest"
}

alarm_is_ok() {
  local state
  state="$(aws cloudwatch describe-alarms --alarm-names "$CLOUDWATCH_ALARM_NAME" \
    --query 'MetricAlarms[0].StateValue' --output text)"
  [[ "$state" == "OK" ]] || fail "rollout alarm is $state"
}

current_service_image() {
  local task_definition
  task_definition="$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
    --query 'services[0].taskDefinition' --output text)"
  aws ecs describe-task-definition --task-definition "$task_definition" \
    --query "taskDefinition.containerDefinitions[?name=='${ECS_CONTAINER}'].image | [0]" --output text
}

register_task_definition() {
  local image_ref="$1" current_json register_json matches
  current_json="$(mktemp)"
  register_json="$(mktemp)"
  trap 'rm -f "$current_json" "$register_json"' RETURN
  aws ecs describe-task-definition --task-definition "$ECS_TASK_FAMILY" --query taskDefinition > "$current_json"
  matches="$(jq --arg name "$ECS_CONTAINER" '[.containerDefinitions[] | select(.name == $name)] | length' "$current_json")"
  [[ "$matches" == "1" ]] || fail "task definition must contain exactly one target container"
  jq --arg name "$ECS_CONTAINER" --arg image "$image_ref" '
    .containerDefinitions |= map(if .name == $name then .image = $image else . end)
    | del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)
  ' "$current_json" > "$register_json"
  aws ecs register-task-definition --cli-input-json "file://${register_json}" \
    --query 'taskDefinition.taskDefinitionArn' --output text
}

write_state() {
  local mode="$1" image_ref="$2" previous_ref="$3" deployment_arn="${4:-}"
  mkdir -p "$(dirname "$ROLLOUT_STATE_FILE")"
  jq -n --arg mode "$mode" --arg imageRef "$image_ref" --arg previousImageRef "$previous_ref" \
    --arg deploymentArn "$deployment_arn" \
    '{mode:$mode,imageRef:$imageRef,previousImageRef:$previousImageRef,deploymentArn:$deploymentArn}' > "$ROLLOUT_STATE_FILE"
}

verify_service_image() {
  local expected="$1" actual
  actual="$(current_service_image)"
  [[ "$actual" == "$expected" ]] || fail "service resolved $actual instead of $expected"
}

deploy_rolling() {
  local image_ref="$1" task_definition configuration
  task_definition="$(register_task_definition "$image_ref")"
  configuration='{"strategy":"ROLLING","deploymentCircuitBreaker":{"enable":true,"rollback":true}}'
  aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
    --task-definition "$task_definition" --deployment-configuration "$configuration" >/dev/null
  aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE"
  alarm_is_ok
  verify_service_image "$image_ref"
}

deployment_detail() {
  local deployment_arn
  deployment_arn="$(jq -r '.deploymentArn' "$ROLLOUT_STATE_FILE")"
  [[ "$deployment_arn" == arn:aws:ecs:*:service-deployment/* ]] || fail "deployment ARN is unavailable"
  aws ecs describe-service-deployments --service-deployment-arns "$deployment_arn"
}

wait_for_weight() {
  local expected="$1" detail status
  for _ in {1..90}; do
    detail="$(deployment_detail)"
    status="$(jq -r '.serviceDeployments[0].status' <<<"$detail")"
    case "$status" in
      ROLLBACK_*|STOPPED|STOP_REQUESTED) fail "deployment entered $status" ;;
    esac
    if jq -e --argjson expected "$expected" \
      '.serviceDeployments[0].targetServiceRevision.requestedProductionTrafficWeight == $expected' \
      <<<"$detail" >/dev/null; then
      alarm_is_ok
      if (( expected == 0 )); then
        jq -e '
          .serviceDeployments[0].lifecycleStage == "PRE_PRODUCTION_TRAFFIC_SHIFT" and
          ([.serviceDeployments[0].lifecycleHookDetails[] |
            select(.targetType == "PAUSE" and .status == "AWAITING_ACTION" and .timeoutAction == "ROLLBACK")] | length) == 1
        ' <<<"$detail" >/dev/null || fail "expected fail-closed pause hook is absent"
      fi
      return
    fi
    sleep 10
  done
  fail "timed out waiting for production traffic weight $expected"
}

continue_paused_deployment() {
  local detail deployment_arn hook_id
  detail="$(deployment_detail)"
  deployment_arn="$(jq -r '.serviceDeployments[0].serviceDeploymentArn' <<<"$detail")"
  hook_id="$(jq -r '[.serviceDeployments[0].lifecycleHookDetails[] |
    select(.targetType == "PAUSE" and .status == "AWAITING_ACTION")][0].hookId // empty' <<<"$detail")"
  [[ -n "$hook_id" ]] || fail "deployment is not paused for verification"
  alarm_is_ok
  aws ecs continue-service-deployment --service-deployment-arn "$deployment_arn" \
    --hook-id "$hook_id" --action CONTINUE >/dev/null
}

# @description Deploy an exact digest to staging and verify ECS and CloudWatch readback.
# @arg $1 image_ref New immutable ECR digest.
# @arg $2 previous_image_ref Current immutable ECR digest used for rollback.
deploy_staging() {
  local image_ref="$1" previous_ref="$2"
  assert_digest "$image_ref"
  assert_digest "$previous_ref"
  [[ "$(current_service_image)" == "$previous_ref" ]] || fail "staging baseline does not match previous_image_ref"
  write_state staging "$image_ref" "$previous_ref"
  deploy_rolling "$image_ref"
  rm -f "$ROLLOUT_STATE_FILE"
}

# @description Start a 10-percent linear production deployment and stop at the 0-percent pause gate.
# @arg $1 image_ref New immutable ECR digest.
# @arg $2 previous_image_ref Current immutable ECR digest used for rollback.
start_production() {
  local image_ref="$1" previous_ref="$2" task_definition configuration deployment_arn existing alternate
  assert_digest "$image_ref"
  assert_digest "$previous_ref"
  [[ "$(current_service_image)" == "$previous_ref" ]] || fail "production baseline does not match previous_image_ref"
  existing="$(aws ecs list-service-deployments --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
    --status IN_PROGRESS PENDING --query 'length(serviceDeployments)' --output text)"
  [[ "$existing" == "0" ]] || fail "another deployment is already active"
  alternate="$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
    --query "services[0].loadBalancers[?containerName=='${ECS_CONTAINER}'].advancedConfiguration.alternateTargetGroupArn | [0]" \
    --output text)"
  [[ "$alternate" == arn:aws:elasticloadbalancing:*:targetgroup/* ]] || fail "alternate target group is not configured"
  task_definition="$(register_task_definition "$image_ref")"
  configuration="$(jq -nc --arg alarm "$CLOUDWATCH_ALARM_NAME" '{
    strategy:"LINEAR",maximumPercent:200,minimumHealthyPercent:100,bakeTimeInMinutes:10,
    linearConfiguration:{stepPercent:10,stepBakeTimeInMinutes:2},
    alarms:{alarmNames:[$alarm],enable:true,rollback:true},
    lifecycleHooks:[{targetType:"PAUSE",lifecycleStages:["PRE_PRODUCTION_TRAFFIC_SHIFT"],
      timeoutConfiguration:{timeoutInMinutes:60,action:"ROLLBACK"}}]
  }')"
  write_state production "$image_ref" "$previous_ref"
  aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
    --task-definition "$task_definition" --deployment-configuration "$configuration" >/dev/null
  for _ in {1..30}; do
    deployment_arn="$(aws ecs list-service-deployments --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
      --status IN_PROGRESS PENDING --query 'serviceDeployments[0].serviceDeploymentArn' --output text)"
    if [[ "$deployment_arn" == arn:aws:ecs:*:service-deployment/* ]]; then
      jq --arg arn "$deployment_arn" '.deploymentArn = $arn' "$ROLLOUT_STATE_FILE" > "${ROLLOUT_STATE_FILE}.tmp"
      mv "${ROLLOUT_STATE_FILE}.tmp" "$ROLLOUT_STATE_FILE"
      wait_for_weight 0
      return
    fi
    sleep 2
  done
  fail "new production deployment was not observable"
}

# @description Continue the initial pause once, then observe ECS automatic linear progression to a named gate.
# @arg $1 target_weight One of 10, 50, or 100.
advance_production() {
  local target="$1" detail current image_ref
  [[ "$target" == "10" || "$target" == "50" || "$target" == "100" ]] || fail "target must be 10, 50, or 100"
  image_ref="$(jq -r '.imageRef' "$ROLLOUT_STATE_FILE")"
  assert_digest "$image_ref"
  detail="$(deployment_detail)"
  current="$(jq -r '.serviceDeployments[0].targetServiceRevision.requestedProductionTrafficWeight' <<<"$detail")"
  [[ "$current" =~ ^(0|10|20|30|40|50|60|70|80|90)(\.0)?$ ]] || fail "unexpected current traffic weight $current"
  current="${current%%.*}"
  (( current <= target )) || fail "deployment already passed target weight $target"
  if (( current == 0 )); then
    continue_paused_deployment
  fi
  wait_for_weight "$target"
  if (( target == 100 )); then
    aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE"
    verify_service_image "$image_ref"
    rm -f "$ROLLOUT_STATE_FILE"
  fi
}

rollback_staging() {
  local previous_ref="$1"
  assert_digest "$previous_ref"
  [[ -f "$ROLLOUT_STATE_FILE" ]] || return 0
  deploy_rolling "$previous_ref"
  rm -f "$ROLLOUT_STATE_FILE"
}

rollback_production() {
  local previous_ref="$1" deployment_arn hook_id status detail active_count rollback_complete=false
  assert_digest "$previous_ref"
  [[ -f "$ROLLOUT_STATE_FILE" ]] || return 0
  [[ "$(jq -r '.previousImageRef' "$ROLLOUT_STATE_FILE")" == "$previous_ref" ]] || fail "rollback digest differs from recorded baseline"
  deployment_arn="$(jq -r '.deploymentArn' "$ROLLOUT_STATE_FILE")"
  if [[ "$deployment_arn" != arn:aws:ecs:*:service-deployment/* ]]; then
    active_count="$(aws ecs list-service-deployments --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
      --status IN_PROGRESS PENDING --query 'length(serviceDeployments)' --output text)"
    if [[ "$active_count" == "1" ]]; then
      deployment_arn="$(aws ecs list-service-deployments --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
        --status IN_PROGRESS PENDING --query 'serviceDeployments[0].serviceDeploymentArn' --output text)"
      jq --arg arn "$deployment_arn" '.deploymentArn = $arn' "$ROLLOUT_STATE_FILE" > "${ROLLOUT_STATE_FILE}.tmp"
      mv "${ROLLOUT_STATE_FILE}.tmp" "$ROLLOUT_STATE_FILE"
    elif [[ "$active_count" != "0" ]]; then
      fail "multiple active deployments prevent bounded rollback"
    fi
  fi
  if [[ "$deployment_arn" == arn:aws:ecs:*:service-deployment/* ]]; then
    detail="$(deployment_detail)"
    hook_id="$(jq -r '[.serviceDeployments[0].lifecycleHookDetails[] |
      select(.targetType == "PAUSE" and .status == "AWAITING_ACTION")][0].hookId // empty' <<<"$detail")"
    if [[ -n "$hook_id" ]]; then
      aws ecs continue-service-deployment --service-deployment-arn "$deployment_arn" \
        --hook-id "$hook_id" --action ROLLBACK >/dev/null
    else
      aws ecs stop-service-deployment --service-deployment-arn "$deployment_arn" --stop-type ROLLBACK >/dev/null
    fi
    for _ in {1..90}; do
      status="$(deployment_detail | jq -r '.serviceDeployments[0].status')"
      if [[ "$status" == "ROLLBACK_SUCCESSFUL" ]]; then
        rollback_complete=true
        break
      fi
      [[ "$status" != "ROLLBACK_FAILED" ]] || fail "ECS rollback failed"
      sleep 10
    done
    [[ "$rollback_complete" == true ]] || fail "timed out waiting for ECS rollback"
  else
    deploy_rolling "$previous_ref"
  fi
  verify_service_image "$previous_ref"
  rm -f "$ROLLOUT_STATE_FILE"
}

require_environment
command -v aws >/dev/null 2>&1 || fail "aws CLI is required"
command -v jq >/dev/null 2>&1 || fail "jq is required"

case "${1:-}" in
  deploy-staging)
    [[ $# == 3 ]] || fail "usage: ecs-release.sh deploy-staging IMAGE_REF PREVIOUS_IMAGE_REF"
    deploy_staging "$2" "$3"
    ;;
  start-production)
    [[ $# == 3 ]] || fail "usage: ecs-release.sh start-production IMAGE_REF PREVIOUS_IMAGE_REF"
    start_production "$2" "$3"
    ;;
  advance-production)
    [[ $# == 2 ]] || fail "usage: ecs-release.sh advance-production 10|50|100"
    advance_production "$2"
    ;;
  rollback-staging)
    [[ $# == 2 ]] || fail "usage: ecs-release.sh rollback-staging PREVIOUS_IMAGE_REF"
    rollback_staging "$2"
    ;;
  rollback-production)
    [[ $# == 2 ]] || fail "usage: ecs-release.sh rollback-production PREVIOUS_IMAGE_REF"
    rollback_production "$2"
    ;;
  *) fail "unknown command" ;;
esac
