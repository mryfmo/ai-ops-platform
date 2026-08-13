#!/usr/bin/env bash
# @file gen-certs.sh
# @brief Generate per-environment Temporal mTLS certificates (CA / server / worker / operator).
# @description
#   ENV-DEC-001 (案 B'): mTLS is the identity control; network isolation is an
#   additional control. Each environment has its own CA
#   (CN=aiops-temporal-ca.<env>), so a certificate from another environment is
#   rejected at the TLS handshake — this is the server-enforced environment
#   scope. Worker identities are CN=aiops-temporal-worker.<env> (non-admin by
#   convention; server-side claim enforcement is a P3 follow-up), and operator
#   identity CN=aiops-temporal-operator.<env> is issued separately for admin
#   operations only.
#   Outputs land in ./out/<env>/ and are gitignored. In staging/prod the same
#   material lives in AWS Secrets Manager (see deploy/aws/temporal), never in git.
# @arg $1 Environment: dev | staging | prod
# @option CERT_DAYS Validity days (default 90; rotate before expiry — see RUNBOOK.md).
# @example
#   ./deploy/temporal/certs/gen-certs.sh dev
set -euo pipefail

ENVIRONMENT="${1:?usage: gen-certs.sh <dev|staging|prod>}"
case "$ENVIRONMENT" in dev | staging | prod) ;; *)
  echo "environment must be dev|staging|prod" >&2
  exit 1
  ;;
esac
DAYS="${CERT_DAYS:-90}"
DIR="$(cd "$(dirname "$0")" && pwd)/out/$ENVIRONMENT"
mkdir -p "$DIR"

issue() { # name cn [san]
  local name="$1" cn="$2" san="${3:-}"
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
    -keyout "$DIR/$name.key" -out "$DIR/$name.csr" -subj "/CN=$cn"
  local extra=()
  if [ -n "$san" ]; then
    extra=(-extfile <(printf 'subjectAltName=%s\n' "$san"))
  fi
  # bash 3.2 (macOS) は set -u で空配列展開に失敗するため保護付きで展開する
  openssl x509 -req -in "$DIR/$name.csr" -CA "$DIR/ca.crt" -CAkey "$DIR/ca.key" \
    -CAcreateserial -days "$DAYS" -out "$DIR/$name.crt" ${extra[@]+"${extra[@]}"}
  rm -f "$DIR/$name.csr"
}

# Per-environment CA（環境スコープの server 側強制点）
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout "$DIR/ca.key" -out "$DIR/ca.crt" -days "$((DAYS * 2))" \
  -subj "/CN=aiops-temporal-ca.$ENVIRONMENT"

# Temporal frontend server 証明書（SAN はデプロイ先ホスト名に合わせて上書き可）
issue server "aiops-temporal-frontend.$ENVIRONMENT" \
  "${SERVER_SAN:-DNS:aiops-temporal-frontend.$ENVIRONMENT,DNS:temporal,DNS:localhost,IP:127.0.0.1}"

# worker（非 admin）と operator（admin 専用・別 identity）
issue worker "aiops-temporal-worker.$ENVIRONMENT"
issue operator "aiops-temporal-operator.$ENVIRONMENT"

chmod 600 "$DIR"/*.key
echo "issued CA/server/worker/operator certificates for $ENVIRONMENT in $DIR (valid ${DAYS}d)"
