#!/usr/bin/env bash
# @file smoke.sh
# @brief Container smoke test for the pinned LiteLLM inference proxy config.
# @description
#   Boots the immutably pinned LiteLLM image with deploy/litellm/config.yaml,
#   dummy provider model IDs and a disposable database URL, then asserts:
#   1. /health/liveliness answers 200 (proxy boots with the governed config);
#   2. the container environment carries no enterprise enablement variable
#      (LITELLM_LICENSE) and no long-lived AWS credential — the runtime half
#      of the packaged-but-disabled proof (Owner ruling 2026-08-12, see
#      docs/security/2026-08-10-license-service-review-register.md).
#   Works with the Apple `container` CLI (default) or any docker-compatible
#   runtime via SMOKE_RUNTIME.
# @option SMOKE_RUNTIME Container CLI to use (default: container).
# @option SMOKE_DATABASE_URL Postgres URL reachable from the container.
# @option SMOKE_PORT Host port for the proxy (default: 4000).
# @example
#   SMOKE_DATABASE_URL=postgresql://mryfmo@192.168.64.1:55432/aiops_p001 ./deploy/litellm/smoke.sh
set -euo pipefail

RUNTIME="${SMOKE_RUNTIME:-container}"
PORT="${SMOKE_PORT:-4000}"
NAME="litellm-smoke"
DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE="$(sed -n 's/^  image: //p' "$DIR/config.yaml")"
[ -n "$IMAGE" ] || { echo "pinned image not found in config.yaml" >&2; exit 1; }

MASTER_KEY="sk-smoke-local-only"
AUTH_HEADER="Authorization: Bearer $MASTER_KEY"

cleanup() { "$RUNTIME" rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

# ponytail: 1GiB default OOM-kills the proxy at boot; 4g is the observed floor.
"$RUNTIME" run --detach --name "$NAME" -m "${SMOKE_MEMORY:-4g}" \
  --volume "$DIR:/etc/litellm:ro" \
  --env "LITELLM_MASTER_KEY=$MASTER_KEY" \
  --env LITELLM_DATABASE_URL="${SMOKE_DATABASE_URL:?SMOKE_DATABASE_URL is required}" \
  --env LITELLM_PRICING_REVISION=smoke \
  --env BEDROCK_CLAUDE_GOVERNED_MODEL_ID=bedrock/smoke-governed \
  --env BEDROCK_CLAUDE_STANDARD_MODEL_ID=bedrock/smoke-standard \
  --env BEDROCK_CLAUDE_CODE_MODEL_ID=bedrock/smoke-code \
  --env BEDROCK_CLAUDE_FAST_MODEL_ID=bedrock/smoke-fast \
  --env ANTHROPIC_CLAUDE_STANDARD_MODEL_ID=smoke-standard-fb \
  --env ANTHROPIC_CLAUDE_NATIVE_MODEL_ID=smoke-native \
  --env ANTHROPIC_CLAUDE_CODE_MODEL_ID=smoke-code-fb \
  --env ANTHROPIC_CLAUDE_FAST_MODEL_ID=smoke-fast-fb \
  --env "LITELLM_ANTHROPIC_API_KEY=$MASTER_KEY" \
  --env AWS_REGION=ap-northeast-1 \
  "$IMAGE" --config /etc/litellm/config.yaml --port "$PORT"

ADDR="${SMOKE_ADDR:-$("$RUNTIME" list 2>/dev/null | awk -v n="$NAME" \
  '$1==n {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}')}"
ADDR="${ADDR:-127.0.0.1}"

for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://$ADDR:$PORT/health/liveliness"; then
    echo "OK: /health/liveliness answered on $ADDR:$PORT"
    break
  fi
  sleep 2
done
curl -fsS "http://$ADDR:$PORT/health/liveliness"; echo

RUNTIME_ENV="$("$RUNTIME" exec "$NAME" env)"
if printf '%s' "$RUNTIME_ENV" | grep -qE '^(LITELLM_LICENSE|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|ANTHROPIC_API_KEY)='; then
  echo "FAIL: forbidden enterprise/long-lived-credential/passthrough-fallback env present" >&2
  exit 1
fi
echo "OK: no enterprise, long-lived AWS credential, or ANTHROPIC_API_KEY in runtime env"

# Enterprise runtime absence (Owner ruling 2026-08-12, option B): the deployed
# OSS-only image must not be able to import enterprise code at all.
if "$RUNTIME" exec "$NAME" python -c 'import importlib.util as u, os, sys; sys.exit(0 if (u.find_spec("litellm_enterprise") is None and not os.path.exists("/app/enterprise")) else 1)'; then
  echo "OK: enterprise code absent from runtime (unimportable, tree removed)"
else
  echo "FAIL: enterprise code importable or /app/enterprise present" >&2
  exit 1
fi

# Route-boundary probes. Denials must come from the image's aiops route
# boundary (403 + marker), not from missing credentials or validation errors —
# that proves MCP, A2A, provider passthrough and their management routes are
# disabled before LiteLLM auth or provider credential resolution.
deny_probe() { # method path — expect 403 with the boundary marker
  local out code body
  out=$(curl -s -w '|%{http_code}' -X "$1" \
    -H "$AUTH_HEADER" -H 'content-type: application/json' \
    -d '{"model":"claude-3-5-sonnet-latest","max_tokens":1,"messages":[{"role":"user","content":"x"}]}' \
    "http://$ADDR:$PORT$2")
  code=${out##*|}; body=${out%|*}
  if [ "$code" != "403" ] || [ "${body#*aiops-route-boundary}" = "$body" ]; then
    echo "FAIL: $1 $2 -> $code (expected 403 from aiops-route-boundary): $body" >&2
    exit 1
  fi
  echo "OK: $1 $2 denied by route boundary (403)"
}
allow_probe() { # method path — must NOT be boundary-denied
  local body
  body=$(curl -s -X "$1" -H "$AUTH_HEADER" "http://$ADDR:$PORT$2")
  if [ "${body#*aiops-route-boundary}" != "$body" ]; then
    echo "FAIL: $1 $2 blocked by route boundary but is a required endpoint" >&2
    exit 1
  fi
  echo "OK: $1 $2 passes the route boundary"
}
deny_probe POST /anthropic/v1/messages
deny_probe POST /bedrock/model/anthropic.claude-3-5-sonnet/invoke
deny_probe GET /mcp/tools
deny_probe POST /v1/mcp/server
deny_probe GET /v1/agents
deny_probe POST /v1/agents
allow_probe GET /v1/models
allow_probe GET /health/readiness

# WebSocket scopes must be denied too (v1.96.2 mounts provider-passthrough
# WebSockets such as /vertex_ai/live). The boundary rejects the handshake, so
# the upgrade must fail with 403.
WS_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H "Sec-WebSocket-Key: $(head -c 16 /dev/zero | base64)" -H 'Sec-WebSocket-Version: 13' \
  -H "$AUTH_HEADER" "http://$ADDR:$PORT/vertex_ai/live")
if [ "$WS_CODE" != "403" ]; then
  echo "FAIL: WebSocket /vertex_ai/live handshake not boundary-denied (got $WS_CODE, want 403)" >&2
  exit 1
fi
echo "OK: WebSocket /vertex_ai/live handshake denied by route boundary (403)"

# Production-representative credentialed instance: even with ambient AWS
# credentials (ECS-task-role stand-in) and the anthropic deployment key set,
# provider passthrough must still be denied by the boundary — proving the
# denial is credential-independent. This throwaway instance intentionally
# carries dummy AWS env and is exempt from the primary instance's env checks.
CRED_NAME="$NAME-cred"
"$RUNTIME" rm -f "$CRED_NAME" >/dev/null 2>&1 || true
"$RUNTIME" run --detach --name "$CRED_NAME" -m "${SMOKE_MEMORY:-4g}" \
  --volume "$DIR:/etc/litellm:ro" \
  --env "LITELLM_MASTER_KEY=$MASTER_KEY" \
  --env LITELLM_DATABASE_URL="$SMOKE_DATABASE_URL" \
  --env LITELLM_PRICING_REVISION=smoke \
  --env BEDROCK_CLAUDE_GOVERNED_MODEL_ID=bedrock/smoke-governed \
  --env BEDROCK_CLAUDE_STANDARD_MODEL_ID=bedrock/smoke-standard \
  --env BEDROCK_CLAUDE_CODE_MODEL_ID=bedrock/smoke-code \
  --env BEDROCK_CLAUDE_FAST_MODEL_ID=bedrock/smoke-fast \
  --env ANTHROPIC_CLAUDE_STANDARD_MODEL_ID=smoke-standard-fb \
  --env ANTHROPIC_CLAUDE_NATIVE_MODEL_ID=smoke-native \
  --env ANTHROPIC_CLAUDE_CODE_MODEL_ID=smoke-code-fb \
  --env ANTHROPIC_CLAUDE_FAST_MODEL_ID=smoke-fast-fb \
  --env "LITELLM_ANTHROPIC_API_KEY=$MASTER_KEY" \
  --env AWS_REGION=ap-northeast-1 \
  --env AWS_ACCESS_KEY_ID=SMOKEDUMMYTASKROLE \
  --env AWS_SECRET_ACCESS_KEY=smoke-dummy-secret \
  "$IMAGE" --config /etc/litellm/config.yaml --port "$PORT"
CRED_ADDR="$("$RUNTIME" list 2>/dev/null | awk -v n="$CRED_NAME" \
  '$1==n {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}')"
for _ in $(seq 1 90); do
  curl -fsS -o /dev/null "http://$CRED_ADDR:$PORT/health/liveliness" 2>/dev/null && break
  sleep 2
done
CRED_OUT=$(curl -s -w '|%{http_code}' -X POST -H "$AUTH_HEADER" -H 'content-type: application/json' \
  -d '{"max_tokens":1,"messages":[{"role":"user","content":"x"}]}' \
  "http://$CRED_ADDR:$PORT/bedrock/model/anthropic.claude-3-5-sonnet/invoke")
"$RUNTIME" rm -f "$CRED_NAME" >/dev/null 2>&1 || true
CRED_CODE=${CRED_OUT##*|}; CRED_BODY=${CRED_OUT%|*}
if [ "$CRED_CODE" != "403" ] || [ "${CRED_BODY#*aiops-route-boundary}" = "$CRED_BODY" ]; then
  echo "FAIL: credentialed /bedrock passthrough not denied by boundary: $CRED_CODE $CRED_BODY" >&2
  exit 1
fi
echo "OK: /bedrock denied by route boundary even with ambient AWS credentials (403)"

echo "SMOKE PASS: $IMAGE"
