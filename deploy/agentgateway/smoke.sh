#!/usr/bin/env bash
# @file smoke.sh
# @brief Container smoke test for the pinned agentgateway MCP/A2A-only config.
# @description
#   根拠: FinalArch:FR-MCP-001..007 / ADR-0023 / WBS P4-T01 / gate MCP-001
#   Phase 1 boots the immutably pinned agentgateway image with the governed
#   deploy/agentgateway/config.yaml and an ephemeral JWKS whose private key is
#   discarded in-process (no token can exist), then asserts:
#   1. `--validate-only` accepts the governed config (vendor-schema validity);
#   2. /healthz/ready answers 200 (gateway boots with the governed config);
#   3. /metrics answers on the stats port (OTel/Prometheus surface up);
#   4. unauthenticated POST /mcp is denied with 401 (jwtAuth strict,
#      fail-closed — the authentication half of the MCP-001 posture);
#   5. unauthenticated GET /a2a is denied with 401 (auth precedes the
#      placeholder directResponse);
#   6. LLM serving paths (/v1/chat/completions, /v1/models) are NOT routed
#      (404) — LLM routes disabled per ADR-0023;
#   7. GET /ui is NOT routed (404) — no management UI attachment (P4-T01-002).
#   Phase 2 (P4-T01-001) reboots with smoke-fixture.config.yaml (identical to
#   the governed config except one synthetic MCP target; the equivalence is
#   CI-checked by contracts/mcp-gateway) and a fresh keypair whose private key
#   stays in-process just long enough to sign one throwaway JWT, then proves
#   authorization PAST authentication via smoke-mcp-probe.mjs:
#   8. the synthetic target directly exposes synthetic_echo;
#   9. authenticated tools/list through the gateway is EMPTY (denied tools are
#      filtered by the deny-all sentinel);
#   10. authenticated tools/call synthetic_echo is denied with the exact
#       vendor error (400 / -32602 "Unknown tool: ...") and never reaches the
#       target — the MCP-001 "unknown tool denied" runtime evidence.
#   A per-run nonce plus target-side request counters tie every observation to
#   the exact target process this script launches (decoy guard, P4-T01-006).
#   Phase 2 requires the Apple `container` CLI: the fixture pins the target
#   endpoint to its 192.168.64.1 host gateway (enforced by contracts).
# @option SMOKE_RUNTIME Container CLI to use (default: container; Phase 2
#   assumes Apple container host addressing).
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

# 7. No management UI attachment (adminAddr off covers only the admin server).
expect_code 404 GET /ui

# ---- Phase 2: authorization past authentication (P4-T01-001/006) ----
"$RUNTIME" rm -f "$NAME" >/dev/null 2>&1 || true

# The fixture pins the target endpoint to 192.168.64.1:8931/mcp (the Apple
# `container` host gateway; enforced by contracts/mcp-gateway). The per-run
# nonce ties the probe's observations to the exact target process launched
# below — a decoy on a different endpoint cannot echo this nonce (P4-T01-006).
TARGET_PORT=8931
SMOKE_NONCE="$(node -e 'console.log(require("node:crypto").randomUUID())')"
export SMOKE_NONCE

# Fresh keypair: JWKS to disk (public only), one short-lived JWT to stdout.
# The private key exists only inside this node process.
SMOKE_JWT="$(node -e '
  const fs = require("node:fs");
  const { generateKeyPairSync, createSign } = require("node:crypto");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), alg: "RS256", use: "sig", kid: "smoke" };
  fs.writeFileSync(process.argv[1], JSON.stringify({ keys: [jwk] }));
  const b64u = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64u({ alg: "RS256", typ: "JWT", kid: "smoke" });
  const payload = b64u({
    iss: "https://auth.aiops.internal/realms/platform",
    aud: "aiops-mcp-gateway",
    sub: "smoke-probe",
    iat: now,
    exp: now + 600,
  });
  const signature = createSign("RSA-SHA256").update(`${head}.${payload}`).sign(privateKey).toString("base64url");
  console.log(`${head}.${payload}.${signature}`);
' "$STAGE/jwks/platform.json")"
export SMOKE_JWT

cp "$DIR/smoke-fixture.config.yaml" "$STAGE/config.yaml"

SMOKE_MCP_TARGET_PORT="$TARGET_PORT" SMOKE_NONCE="$SMOKE_NONCE" node "$DIR/smoke-mcp-target.mjs" &
TARGET_PID=$!
trap '"$RUNTIME" rm -f "$NAME" >/dev/null 2>&1 || true; kill "$TARGET_PID" 2>/dev/null || true; rm -rf "$STAGE"' EXIT

"$RUNTIME" run --detach --name "$NAME" \
  --volume "$STAGE:/etc/agentgateway:ro" \
  "$IMAGE" -f /etc/agentgateway/config.yaml
ADDR="${SMOKE_ADDR:-$("$RUNTIME" list 2>/dev/null | awk -v n="$NAME" \
  '$1==n {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}')}"
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "http://$ADDR:15021/healthz/ready" 2>/dev/null && break
  sleep 1
done

# 8./9./10. Direct target exposure vs gateway deny-all filtering + denied call.
node "$DIR/smoke-mcp-probe.mjs" "$ADDR:3000" "127.0.0.1:$TARGET_PORT"

echo "SMOKE PASS: $IMAGE"
