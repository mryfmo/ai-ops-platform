# 根拠: FinalArch:LLM-001 / FinalArch:LLM-003 / ADR-0022 / ADR-0029
# OSS-only derived image (Owner ruling 2026-08-12, option B): the official
# v1.96.2 image bundles and unconditionally imports the proprietary
# litellm-enterprise package (LicenseRef-Proprietary). Upstream guards those
# imports with try/except ImportError, so removing the package and the
# /app/enterprise source tree fail-closes enterprise cleanly. The base is the
# immutable digest pinned in docs/security/2026-08-10-license-service-review-register.md.
FROM ghcr.io/berriai/litellm:v1.96.2@sha256:154e23bb5f31b1f10e16392a8ef299bd2cde08de3a64a6849002cfcc25ce3c63

RUN rm -rf /app/enterprise \
      /app/.venv/lib/python3.13/site-packages/litellm_enterprise \
      /app/.venv/lib/python3.13/site-packages/litellm_enterprise-*.dist-info \
 && python - <<'EOF'
import importlib.util
assert importlib.util.find_spec("litellm_enterprise") is None, "litellm_enterprise still importable"
import os
assert not os.path.exists("/app/enterprise"), "/app/enterprise still present"
EOF

# Runtime route boundary (P2-T02-001): default-deny ASGI middleware installed
# via site-packages sitecustomize so every interpreter (including uvicorn
# workers) enforces the inference-only allowlist before LiteLLM auth or
# provider credential resolution.
COPY route-allowlist.json /app/aiops-route-allowlist.json
COPY sitecustomize.py /app/.venv/lib/python3.13/site-packages/sitecustomize.py
RUN python - <<'EOF'
import json, sys
assert "sitecustomize" in sys.modules, "sitecustomize not auto-imported"
finder = type(sys.meta_path[0]).__name__
assert finder == "_BoundaryFinder", f"boundary finder not first on meta_path: {finder}"
prefixes = json.load(open("/app/aiops-route-allowlist.json"))["allowed_route_prefixes"]
assert "/health" in prefixes and all(p.startswith("/") for p in prefixes)
EOF
