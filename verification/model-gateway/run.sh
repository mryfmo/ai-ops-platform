#!/usr/bin/env bash
# @file verification/model-gateway/run.sh
# @brief Run synthetic Bedrock/Anthropic gateway conformance checks.
# @description
#   With no external gateway configured, starts pinned oss.3 LiteLLM and
#   PostgreSQL 16 Apple containers, runs the suite, and removes both containers.
#   With MODEL_GATEWAY_BASE_URL set, runs against the supplied tenant instead.
# @option MODEL_GATEWAY_BASE_URL Existing LiteLLM base URL; skips local containers when set.
# @option MODEL_GATEWAY_KEY Virtual key for the selected gateway; required in external mode.
# @option MODEL_GATEWAY_USE_MOCK Set to 0 for a real-tenant run (default: 1 locally, 0 externally).
# @option MODEL_GATEWAY_BEDROCK_ALIAS Bedrock-path alias (default: synthetic-bedrock).
# @option MODEL_GATEWAY_ANTHROPIC_ALIAS Anthropic-path alias (default: synthetic-anthropic).
# @example
#   ./verification/model-gateway/run.sh
# @example
#   MODEL_GATEWAY_BASE_URL=https://gateway.example MODEL_GATEWAY_KEY="$TOKEN" \
#     MODEL_GATEWAY_USE_MOCK=0 MODEL_GATEWAY_BEDROCK_ALIAS=claude-standard \
#     MODEL_GATEWAY_ANTHROPIC_ALIAS=claude-standard-fallback ./verification/model-gateway/run.sh
#
# 根拠: FinalArch:LLM-002 / FinalArch:LLM-004 / FinalArch:LLM-005 / ADR-0022
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
TEST_FILE="$DIR/conformance.test.ts"

run_tests() {
  cd "$REPO_ROOT"
  pnpm exec tsx --test "$TEST_FILE"
}

if [ -n "${MODEL_GATEWAY_BASE_URL:-}" ]; then
  : "${MODEL_GATEWAY_KEY:?MODEL_GATEWAY_KEY is required with MODEL_GATEWAY_BASE_URL}"
  node -e '
    const url = new URL(process.argv[1]);
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) process.exit(1);
  ' "$MODEL_GATEWAY_BASE_URL" || {
    echo "MODEL_GATEWAY_BASE_URL must use HTTPS without userinfo (HTTP is allowed only for loopback)" >&2
    exit 2
  }
  export MODEL_GATEWAY_USE_MOCK="${MODEL_GATEWAY_USE_MOCK:-0}"
  run_tests
  exit
fi

RUNTIME="${MODEL_GATEWAY_RUNTIME:-container}"
POSTGRES_NAME="p2-t09-postgres"
GATEWAY_NAME="p2-t09-gateway"
IMAGE="ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.3@sha256:2518a42798776da20d252f75e7672855c51de97dbc5d3e03fad47eff1fce97c4"
MODEL_GATEWAY_KEY="${MODEL_GATEWAY_KEY:-synthetic-local-only}"

cleanup() {
  "$RUNTIME" rm -f "$GATEWAY_NAME" "$POSTGRES_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

"$RUNTIME" run --detach --name "$POSTGRES_NAME" -m 1g \
  --env POSTGRES_PASSWORD=synthetic-db-only \
  --env POSTGRES_DB=model_gateway \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  "$RUNTIME" exec "$POSTGRES_NAME" pg_isready -U postgres -d model_gateway >/dev/null 2>&1 && break
  sleep 1
done
"$RUNTIME" exec "$POSTGRES_NAME" pg_isready -U postgres -d model_gateway >/dev/null

POSTGRES_ADDR=$("$RUNTIME" list | awk -v name="$POSTGRES_NAME" \
  '$1==name {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}')
[ -n "$POSTGRES_ADDR" ] || { echo "PostgreSQL container address not found" >&2; exit 1; }

"$RUNTIME" run --detach --name "$GATEWAY_NAME" -m "${SMOKE_MEMORY:-4g}" \
  --volume "$DIR:/etc/litellm:ro" \
  --env "MODEL_GATEWAY_KEY=$MODEL_GATEWAY_KEY" \
  --env MODEL_GATEWAY_SYNTHETIC_PROVIDER_TOKEN=synthetic-never-forwarded \
  --env "LITELLM_DATABASE_URL=postgresql://postgres:synthetic-db-only@$POSTGRES_ADDR:5432/model_gateway" \
  --env AWS_REGION=us-east-1 \
  "$IMAGE" --config /etc/litellm/config.yaml --port 4000 >/dev/null

GATEWAY_ADDR=$("$RUNTIME" list | awk -v name="$GATEWAY_NAME" \
  '$1==name {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}')
[ -n "$GATEWAY_ADDR" ] || { echo "LiteLLM container address not found" >&2; exit 1; }

for _ in $(seq 1 120); do
  curl -fsS -o /dev/null "http://$GATEWAY_ADDR:4000/health/liveliness" 2>/dev/null && break
  sleep 2
done
curl -fsS -o /dev/null "http://$GATEWAY_ADDR:4000/health/liveliness"

export MODEL_GATEWAY_BASE_URL="http://$GATEWAY_ADDR:4000"
export MODEL_GATEWAY_KEY
export MODEL_GATEWAY_USE_MOCK=1
export MODEL_GATEWAY_BEDROCK_ALIAS="${MODEL_GATEWAY_BEDROCK_ALIAS:-synthetic-bedrock}"
export MODEL_GATEWAY_ANTHROPIC_ALIAS="${MODEL_GATEWAY_ANTHROPIC_ALIAS:-synthetic-anthropic}"
run_tests
