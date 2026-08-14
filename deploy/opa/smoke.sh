#!/usr/bin/env bash
# 根拠: FinalArch:MCP-002 / FinalArch:CON-004 / ADR-0023 / WBS P4-T03
# @file smoke.sh
# @brief Verify the versioned bundle and default-deny decision on pinned OPA.
# @description
#   Builds the production bundle, boots the exact OPA image digest without a
#   published host port, waits for bundle readiness, and proves an unknown MCP
#   tool returns deny with policyBundleVersion. It also verifies the stdout
#   decision log exists while system.log.mask removes caller input.
# @option SMOKE_RUNTIME Container CLI to use (default: Apple container).
# @example
#   ./deploy/opa/smoke.sh
set -euo pipefail

RUNTIME="${SMOKE_RUNTIME:-container}"
DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE="$(sed -n 's/^  image: //p' "$DIR/deployment.yaml")"
NAME="p4-opa-smoke"
BUNDLE="$DIR/dist/aiops-policy-smoke.tar.gz"

[ -n "$IMAGE" ] || { echo "pinned image not found in deployment.yaml" >&2; exit 1; }

cleanup() {
  "$RUNTIME" rm -f "$NAME" >/dev/null 2>&1 || true
  rm -f "$BUNDLE"
}
container_address() {
  "$RUNTIME" list 2>/dev/null | awk -v n="$NAME" \
    '$1==n {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}'
}
read_logs() {
  "$RUNTIME" logs "$NAME" 2>&1
}
trap cleanup EXIT
"$RUNTIME" rm -f "$NAME" >/dev/null 2>&1 || true

"$DIR/build-bundle.sh" "$BUNDLE"

"$RUNTIME" run --detach --name "$NAME" \
  --volume "$DIR:/etc/opa:ro" \
  "$IMAGE" run --server --bundle /etc/opa/dist/aiops-policy-smoke.tar.gz \
  --config-file /etc/opa/config.yaml \
  --addr 0.0.0.0:8181 --diagnostic-addr 0.0.0.0:8282 \
  --skip-version-check >/dev/null

ADDR="$(container_address)"
[ -n "$ADDR" ] || { echo "OPA container address not found" >&2; exit 1; }

for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "http://$ADDR:8282/health?bundles" 2>/dev/null && break
  sleep 1
done
curl -fsS -o /dev/null "http://$ADDR:8282/health?bundles"
echo "OK: OPA bundle ready on internal container address"

RESPONSE="$(curl -fsS -X POST -H 'content-type: application/json' \
  --data '{"input":{"actor":{"id":"user-1","type":"human","tenantId":"tenant-1","projectIds":["project-1"]},"agent":{"id":"gateway-1","kind":"control-api"},"action":{"name":"read","riskLevel":"L1","toolName":"github.unknown.read","protocol":"mcp"},"resource":{"system":"github","id":"repo-1","projectId":"project-1","classification":"internal"},"context":{"purpose":"smoke","environment":"dev","providerCandidate":"none","sourceTrust":"trusted-platform"}}}' \
  "http://$ADDR:8181/v1/data/aiops/policy/decision")"

printf '%s' "$RESPONSE" | node -e '
  const fs = require("node:fs");
  const response = JSON.parse(fs.readFileSync(0, "utf8"));
  if (response.result?.decision !== "deny") process.exit(1);
  if (response.result?.policyBundleVersion !== "0.1.0") process.exit(1);
  if (response.result?.reasons?.[0] !== "default_deny") process.exit(1);
'
echo "OK: unknown MCP tool denied with bundle revision 0.1.0"

for _ in $(seq 1 10); do
  LOGS="$(read_logs)"
  [ "${LOGS#*decision_id}" != "$LOGS" ] && break
  sleep 1
done
[ "${LOGS#*decision_id}" != "$LOGS" ] || { echo "decision log not found" >&2; exit 1; }
[ "${LOGS#*github.unknown.read}" = "$LOGS" ] || { echo "unmasked policy input reached stdout" >&2; exit 1; }
echo "OK: masked decision log emitted to stdout without caller input"

echo "SMOKE PASS: $IMAGE"
