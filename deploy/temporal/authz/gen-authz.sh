#!/usr/bin/env bash
# @file gen-authz.sh
# @brief Generate the per-environment Temporal authorization signing key and JWKS.
# @description
#   ENV-DEC-001 + Owner ruling 2026-08-13: worker authorization is enforced
#   server-side by Temporal's built-in JWT claim mapper/authorizer using
#   platform-issued tokens (no Entra / external IdP involvement — Entra stays
#   M365-only). This script creates the RS256 signing keypair and the JWKS
#   document the Temporal frontend consumes via TEMPORAL_JWT_KEY_SOURCE1.
#   Private key and JWKS land in ./out/<env>/ (gitignored). In staging/prod the
#   signing key lives in AWS Secrets Manager and only the JWKS is exposed to
#   the server (sidecar/local file).
# @arg $1 Environment: dev | staging | prod
# @example
#   ./deploy/temporal/authz/gen-authz.sh dev
set -euo pipefail

ENVIRONMENT="${1:?usage: gen-authz.sh <dev|staging|prod>}"
case "$ENVIRONMENT" in dev | staging | prod) ;; *)
  echo "environment must be dev|staging|prod" >&2
  exit 1
  ;;
esac
DIR="$(cd "$(dirname "$0")" && pwd)/out/$ENVIRONMENT"
mkdir -p "$DIR"

openssl genrsa -out "$DIR/jwt-signing.key" 2048 2>/dev/null
chmod 600 "$DIR/jwt-signing.key"

node - "$DIR" "$ENVIRONMENT" <<'EOF'
const { createPublicKey } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const [dir, environment] = process.argv.slice(2);
const publicKey = createPublicKey(readFileSync(join(dir, "jwt-signing.key")));
const jwk = publicKey.export({ format: "jwk" });
const jwks = {
  keys: [{ ...jwk, kid: `aiops-temporal-authz.${environment}`, alg: "RS256", use: "sig" }],
};
const { mkdirSync } = require("node:fs");
mkdirSync(join(dir, "public"), { recursive: true });
// 配信対象は public/ のみ（署名鍵を HTTP 配信面に同居させない）
writeFileSync(join(dir, "public", "jwks.json"), JSON.stringify(jwks, null, 2) + "\n");
console.log(`wrote ${join(dir, "public", "jwks.json")}`);
EOF
echo "issued Temporal authorization signing key + JWKS for $ENVIRONMENT in $DIR"
