#!/usr/bin/env bash
# @file smoke.sh
# @brief Container smoke test for the pinned agentgateway MCP/A2A-only config.
# @description
#   根拠: FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T01 / gate MCP-001
#   Boots the immutably pinned agentgateway image with deploy/agentgateway/
#   config.yaml and an ephemeral throwaway JWKS (public key only; the private
#   key is discarded in-process), then asserts:
#   1. `--validate-only` accepts the governed config (vendor-schema validity);
#   2. /healthz/ready answers 200 (gateway boots with the governed config);
#   3. /metrics answers on the stats port (OTel/Prometheus surface up);
#   4. unauthenticated POST /mcp is denied with 401 (jwtAuth strict,
#      fail-closed — the runtime half of the MCP-001 default-deny posture);
#   5. unauthenticated GET /a2a is denied with 401 (auth precedes the
#      placeholder directResponse);
#   6. LLM serving paths (/v1/chat/completions, /v1/models) are NOT routed
#      (404) — LLM routes disabled per ADR-0023.
#   Works with the Apple `container` CLI (default) or any docker-compatible
#   runtime via SMOKE_RUNTIME.
# @option SMOKE_RUNTIME Container CLI to use (default: container).
# @example
#   ./deploy/agentgateway/smoke.sh
set -euo pipefail

RUNTIME="${SMOKE_RUNTIME:-container}"
NAME="agentgateway-smoke"
DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE="$(sed -n 's/^  image: //p' "$DIR/deployment.yaml")"
[ -n "$IMAGE" ] || { echo "pinned image not found in deployment.yaml" >&2; exit 1; }

STAGE="$(mktemp -d)"
cleanup() {
  "$RUNTIME" rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "$STAGE"
}
trap cleanup EXIT
cleanup
STAGE="$(mktemp -d)"

# Stage config + ephemeral JWKS into one mount root. The JWKS holds only a
# freshly generated RSA public key; no private key ever touches disk, so no
# token can be minted against this instance — every /mcp call must fail auth.
cp "$DIR/config.yaml" "$STAGE/config.yaml"
mkdir -p "$STAGE/jwks"
node -e '
  const { generateKeyPairSync } = require("node:crypto");
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), alg: "RS256", use: "sig", kid: "smoke" };
  console.log(JSON.stringify({ keys: [jwk] }));
' > "$STAGE/jwks/platform.json"

# 1. Vendor-schema validation of the exact governed config, exit code only.
"$RUNTIME" run --rm --volume "$STAGE:/etc/agentgateway:ro" "$IMAGE" \
  -f /etc/agentgateway/config.yaml --validate-only
echo "OK: --validate-only accepts the governed config"

"$RUNTIME" run --detach --name "$NAME" \
  --volume "$STAGE:/etc/agentgateway:ro" \
  "$IMAGE" -f /etc/agentgateway/config.yaml

ADDR="${SMOKE_ADDR:-$("$RUNTIME" list 2>/dev/null | awk -v n="$NAME" \
  '$1==n {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}')}"
ADDR="${ADDR:-127.0.0.1}"

# 2. Readiness.
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "http://$ADDR:15021/healthz/ready" 2>/dev/null && break
  sleep 1
done
curl -fsS "http://$ADDR:15021/healthz/ready"
echo "OK: /healthz/ready answered on $ADDR:15021"

# 3. Metrics.
curl -fsS -o /dev/null "http://$ADDR:15020/metrics"
echo "OK: /metrics answered on $ADDR:15020"

expect_code() { # expected method path — assert exact status code
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$2" \
    -H 'content-type: application/json' -d '{}' "http://$ADDR:3000$3")
  if [ "$code" != "$1" ]; then
    echo "FAIL: $2 $3 -> $code (expected $1)" >&2
    exit 1
  fi
  echo "OK: $2 $3 -> $code"
}

# 4./5. Fail-closed auth on the MCP and A2A surfaces.
expect_code 401 POST /mcp
expect_code 401 GET /a2a

# 6. LLM serving paths must not exist (MCP/A2A-only mode, ADR-0023).
expect_code 404 POST /v1/chat/completions
expect_code 404 GET /v1/models

echo "SMOKE PASS: $IMAGE"
