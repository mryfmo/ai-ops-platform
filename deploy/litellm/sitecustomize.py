# 根拠: FinalArch:LLM-001 / FinalArch:LLM-003 / ADR-0022
# Runtime route boundary for the OSS-only derived LiteLLM image (P2-T02-001).
#
# Installed into the venv's site-packages, so every interpreter in the image
# (including uvicorn worker processes) loads it. It hooks the import of
# litellm.proxy.proxy_server and wraps the FastAPI app in a pure-ASGI
# default-deny middleware: only the route prefixes listed in the
# aiops-route-allowlist.json shipped with the image are served. MCP, A2A,
# provider passthrough and their management routes are therefore denied
# before LiteLLM authentication or any provider credential resolution,
# regardless of ambient credentials such as an ECS task role.
#
# Fail-closed: if the allowlist cannot be loaded, importing the proxy app
# raises and the server does not start.
import importlib.abc
import importlib.util
import json
import os
import sys

_TARGET = "litellm.proxy.proxy_server"
_MARKER = b'{"error":{"message":"aiops-route-boundary: route disabled (inference-only proxy)","type":"aiops_route_boundary","code":"403"}}'


def _load_allowlist():
    path = os.environ.get("AIOPS_ROUTE_ALLOWLIST", "/app/aiops-route-allowlist.json")
    with open(path, "rb") as handle:
        document = json.load(handle)
    prefixes = tuple(document["allowed_route_prefixes"])
    if not prefixes or not all(p.startswith("/") for p in prefixes):
        raise ValueError("aiops route allowlist is empty or malformed")
    return prefixes


class _RouteBoundary:
    def __init__(self, app, *args, **kwargs):
        self.app = app
        self.prefixes = _load_allowlist()

    def _allowed(self, path):
        for prefix in self.prefixes:
            if path == prefix or path.startswith(
                prefix if prefix.endswith("/") else prefix + "/"
            ):
                return True
        return False

    async def __call__(self, scope, receive, send):
        scope_type = scope["type"]
        if scope_type == "http" and not self._allowed(scope.get("path", "")):
            await send(
                {
                    "type": "http.response.start",
                    "status": 403,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"x-aiops-route-boundary", b"deny"),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": _MARKER})
            return
        if scope_type == "websocket":
            # The inference-only surface has no WebSocket endpoint; deny every
            # WebSocket scope (v1.96.2 mounts provider passthroughs such as
            # /vertex_ai/live) by rejecting the handshake with a policy close.
            await receive()  # websocket.connect
            await send(
                {
                    "type": "websocket.close",
                    "code": 1008,
                    "reason": "aiops-route-boundary",
                }
            )
            return
        await self.app(scope, receive, send)


class _BoundaryLoader(importlib.abc.Loader):
    def __init__(self, original):
        self.original = original

    def create_module(self, spec):
        create = getattr(self.original, "create_module", None)
        return create(spec) if create is not None else None

    def exec_module(self, module):
        self.original.exec_module(module)
        # Outermost middleware: added last, runs before every LiteLLM
        # middleware, router, and auth dependency.
        module.app.add_middleware(_RouteBoundary)


class _BoundaryFinder(importlib.abc.MetaPathFinder):
    _busy = False

    def find_spec(self, fullname, path=None, target=None):
        if fullname != _TARGET or _BoundaryFinder._busy:
            return None
        _BoundaryFinder._busy = True
        try:
            spec = importlib.util.find_spec(fullname)
        finally:
            _BoundaryFinder._busy = False
        if spec is not None and spec.loader is not None:
            spec.loader = _BoundaryLoader(spec.loader)
        return spec


sys.meta_path.insert(0, _BoundaryFinder())
