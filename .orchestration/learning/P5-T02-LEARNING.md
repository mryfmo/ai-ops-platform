# P5-T02 Learning

## Reusable Findings

1. Work IQ's published read surface is an MCP Streamable HTTP endpoint at `/mcp`; `fetch`, `ask`, and `get_schema` are JSON-RPC `tools/call` tools, not project-specific REST resource paths.
2. The published `fetch` payload is `{ results: [{ data, statusCode }] }`; `ask` and `get_schema` return their payload through MCP text content, while structured content remains a valid MCP response carrier.
3. The Work IQ server does not retry tool failures. Client retry policy must distinguish idempotent reads from `ask`, which cannot be replayed safely.
4. Microsoft currently documents the core tool payloads but not the project-required `sourceReferences` / `permissionContext` extension shape. A client must retain supplied values and represent absence explicitly; live-tenant WIQ-002 must confirm the real shape.
5. A multi-entity fetch must validate both result cardinality and every inner `statusCode`; outer HTTP 200 alone is not proof of a complete result.

## Apply To

- P5-T03 Control API delegated M365 endpoint, later OPA egress/provenance gates, and WIQ-002 live-tenant conformance.
- Any MCP client that normalizes Streamable HTTP JSON/SSE responses and separates retryable reads from non-idempotent natural-language calls.
