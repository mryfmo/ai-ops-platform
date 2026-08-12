#!/usr/bin/env bash
# @file smoke.sh
# @brief Temporal dev single-node boot + mTLS connectivity/denial verification.
# @description
#   P3-T01 verification (FinalArch:TMP-001 / ENV-DEC-001): boots the pinned
#   Temporal auto-setup single node with mTLS (per-env CA), then verifies via
#   @aiops/control-plane:
#     1. dev worker cert connects and can describe namespace aiops-dev;
#     2. a staging-issued cert is rejected by the client-side guard (E-TMP01)
#        before any connection attempt;
#     3. the same staging cert, forced past the guard, is rejected by the
#        server TLS handshake (per-env CA = server-enforced environment scope);
#     4. a connection without a client certificate is rejected
#        (TEMPORAL_TLS_REQUIRE_CLIENT_AUTH=true).
#   Works with the Apple `container` CLI (default) or docker via SMOKE_RUNTIME.
# @option SMOKE_RUNTIME Container CLI (default: container).
# @option KEEP Set to 1 to keep containers running after verification.
# @example
#   ./deploy/temporal/smoke.sh
set -euo pipefail

RUNTIME="${SMOKE_RUNTIME:-container}"
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
PG_NAME="p3-temporal-pg"
TP_NAME="p3-temporal"
TEMPORAL_IMAGE="temporalio/auto-setup:1.25.2@sha256:b1edc1e20002d958c8182f2ae08dee877a125083683a627a44917683419ba6a8"

cleanup() {
  if [ "${KEEP:-0}" != "1" ]; then
    "$RUNTIME" rm -f "$TP_NAME" "$PG_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
"$RUNTIME" rm -f "$TP_NAME" "$PG_NAME" >/dev/null 2>&1 || true

# per-env certs（dev に加え、越境拒否検証用に staging も発行する）
"$DIR/certs/gen-certs.sh" dev >/dev/null
"$DIR/certs/gen-certs.sh" staging >/dev/null

"$RUNTIME" run --detach --name "$PG_NAME" -m 1g \
  --env POSTGRES_USER=temporal --env POSTGRES_PASSWORD=temporal-dev-only \
  postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do
  "$RUNTIME" exec "$PG_NAME" pg_isready -U temporal >/dev/null 2>&1 && break
  sleep 1
done

PG_ADDR=$("$RUNTIME" list | awk -v n="$PG_NAME" \
  '$1==n {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}')
[ -n "$PG_ADDR" ] || { echo "postgres address not found" >&2; exit 1; }

"$RUNTIME" run --detach --name "$TP_NAME" -m 2g \
  --volume "$DIR/certs/out/dev:/etc/temporal/certs:ro" \
  --env DB=postgres12 --env DB_PORT=5432 \
  --env POSTGRES_USER=temporal --env POSTGRES_PWD=temporal-dev-only \
  --env "POSTGRES_SEEDS=$PG_ADDR" \
  --env DEFAULT_NAMESPACE=aiops-dev \
  --env TEMPORAL_TLS_REQUIRE_CLIENT_AUTH=true \
  --env TEMPORAL_TLS_SERVER_CA_CERT=/etc/temporal/certs/ca.crt \
  --env TEMPORAL_TLS_SERVER_CERT=/etc/temporal/certs/server.crt \
  --env TEMPORAL_TLS_SERVER_KEY=/etc/temporal/certs/server.key \
  --env TEMPORAL_TLS_FRONTEND_SERVER_NAME=aiops-temporal-frontend.dev \
  --env TEMPORAL_TLS_FRONTEND_CERT=/etc/temporal/certs/server.crt \
  --env TEMPORAL_TLS_FRONTEND_KEY=/etc/temporal/certs/server.key \
  --env TEMPORAL_TLS_CLIENT1_CA_CERT=/etc/temporal/certs/ca.crt \
  --env TEMPORAL_TLS_INTERNODE_DISABLE_HOST_VERIFICATION=false \
  --env TEMPORAL_TLS_FRONTEND_DISABLE_HOST_VERIFICATION=false \
  --env TEMPORAL_TLS_CA=/etc/temporal/certs/ca.crt \
  --env TEMPORAL_TLS_CERT=/etc/temporal/certs/operator.crt \
  --env TEMPORAL_TLS_KEY=/etc/temporal/certs/operator.key \
  --env TEMPORAL_TLS_SERVER_NAME=aiops-temporal-frontend.dev \
  --env TEMPORAL_TLS_INTERNODE_SERVER_NAME=aiops-temporal-frontend.dev \
  "$TEMPORAL_IMAGE" >/dev/null

TP_ADDR=$("$RUNTIME" list | awk -v n="$TP_NAME" \
  '$1==n {for(i=1;i<=NF;i++) if ($i ~ /^[0-9.]+\//) {split($i,a,"/"); print a[1]}}')
[ -n "$TP_ADDR" ] || { echo "temporal address not found" >&2; exit 1; }

echo "temporal booting at $TP_ADDR:7233 (mTLS)"
TEMPORAL_SMOKE_ADDRESS="$TP_ADDR:7233" \
  TEMPORAL_SMOKE_CERT_DIR="$DIR/certs/out" \
  node "$DIR/smoke-client.mjs"
echo "SMOKE PASS: $TEMPORAL_IMAGE (mTLS connectivity + denial matrix)"
