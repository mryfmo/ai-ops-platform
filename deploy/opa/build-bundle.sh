#!/usr/bin/env bash
# 根拠: FinalArch:MCP-002 / FinalArch:CON-004 / ADR-0023 / WBS P4-T03
# @file build-bundle.sh
# @brief Build and verify the versioned aiops OPA policy bundle.
# @description
#   Builds only production Rego/data files (never policy_test.rego), stamps the
#   manifest revision from data.aiops.policy.bundle_version, and fails unless
#   the manifest carries that exact revision and Rego v1 metadata.
# @arg $1 output Optional bundle path (default: deploy/opa/dist/aiops-policy.tar.gz).
# @example
#   ./deploy/opa/build-bundle.sh /private/tmp/aiops-policy.tar.gz
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
POLICY_DIR="$REPO_ROOT/packages/policy/policies"
OUTPUT="${1:-$DIR/dist/aiops-policy.tar.gz}"

command -v opa >/dev/null 2>&1 || { echo "OPA is required on PATH" >&2; exit 1; }
BUNDLE_VERSION="$(opa eval --format raw --data "$POLICY_DIR/policy.rego" 'data.aiops.policy.bundle_version')"
[ -n "$BUNDLE_VERSION" ] || { echo "bundle_version not found" >&2; exit 1; }

mkdir -p "$(dirname "$OUTPUT")"
OUTPUT="$(cd "$(dirname "$OUTPUT")" && pwd)/$(basename "$OUTPUT")"
(
  cd "$REPO_ROOT"
  opa build --revision "$BUNDLE_VERSION" --output "$OUTPUT" \
    packages/policy/policies/policy.rego \
    packages/policy/policies/log_mask.rego \
    packages/policy/policies/risk_catalog.yaml
)

opa inspect --format json "$OUTPUT" | node -e '
  const fs = require("node:fs");
  const expected = process.argv[1];
  const inspected = JSON.parse(fs.readFileSync(0, "utf8"));
  if (inspected.manifest?.revision !== expected || inspected.manifest?.rego_version !== 1) process.exit(1);
' "$BUNDLE_VERSION"

echo "BUNDLE PASS: $OUTPUT revision=$BUNDLE_VERSION"
