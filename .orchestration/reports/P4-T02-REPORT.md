# P4-T02 Report

## Outcome

Implemented the governed MCP registry, normalized schema-hash gate, risk ledger,
and deterministic Agentgateway generator on `agent/P4-T02-registry-generator`.
The canonical registry keeps all five initial integrations disabled and contains
no runtime endpoints.

## Contract

- Option (a) is enforced: `endpoint` is required for enabled entries and is
  optional but validated for disabled entries.
- Enabled endpoints map 1:1 to `mcp.targets[].mcp`; the generator does not infer
  or default host, port, or path.
- Only `protocol: mcp` and `transport: streamable-http` are accepted.
- L4-L6 and merge/deploy/delete/permission operations fail closed.
- Generated authorization binds caller, MCP target, and tool name.

## Implementation

- Added the canonical registry schema, pinned normalized SHA-256, registry, and
  L0-L6 operation-risk ledger under `contracts/tools/`.
- Added a pure generator core under `packages/integrations/src/mcp/` and a small
  contracts CLI for `--check`, `--write`, and section rendering.
- Added marker-delimited generated sections to the existing governed config.
  With all entries disabled, the rendered config remains byte-identical to the
  P4-T01 deny-all sentinel and empty target list.
- Added unit, golden, drift, hand-edit, missing-endpoint, invalid-disabled-
  endpoint, and high-risk negative coverage to the existing contracts/CI paths.

## Safety

No dependency was added, `contracts/mcp-gateway/**` was not changed, no
production endpoint or credential was introduced, and no write-capable MCP
operation is registered.

## Validation

Fresh-DB `mise run ci` completed with exit 0. Detailed evidence is in
`.orchestration/validation/P4-T02-VALIDATION.md`.
