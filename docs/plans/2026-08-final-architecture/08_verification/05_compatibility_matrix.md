# Compatibility Matrix

## Runtime environments

| Environment | Supported role | Required constraints | Not supported as |
|---|---|---|---|
| Windows 16GB, no GPU | Teams/Outlook/Plane/GitHub/Wispr client; light Claude/Droid; remote gateways | remote MCP/LLM; avoid many local containers | production server/control plane |
| macOS M5 Pro/Max 64GB | integrated local development, containers, E2E clients, Wispr meeting tests | development secrets only; disposable local DB | production shared server |
| Azure Container Apps | server/web/control workers/gateways where compatible | private networking, managed identity, immutable digest | stateful Temporal OSS server unless validated |
| AKS | optional Temporal OSS/gateway profile | Owner-approved operational burden | default without ENV decision |
| GitHub-hosted runner | isolated coding tasks | no provider master key; scoped virtual keys | persistent state/production credentials |

## Protocol/provider matrix

| Client | LiteLLM | agentgateway | Work IQ | Graph | Notes |
|---|---:|---:|---:|---:|---|
| server/control worker | yes | yes | REST/A2A/MCP delegated | yes | primary integration |
| Web browser | no direct | no direct | no direct | no direct | BFF/Control API only |
| Teams adapter | no direct | no direct | through Control API | limited adapter needs | presentation only |
| Claude Code runner | yes | yes | MCP only if delegated user case approved | no app secret | task profile |
| Droid runner | yes | yes | same restriction | no app secret | task profile |
| local developer CLI | scoped dev key | approved dev profile | Work IQ CLI delegated | dev app only | no production secret |

## Required compatibility tests

- Node 22/pnpm 11/mise exact environment
- TypeScript SDK and server versions
- Anthropic Messages semantics through LiteLLM/Bedrock/direct
- streaming/tool use/structured output/thinking header
- MCP 2026 protocol and supported server versions
- Work IQ GA CLI/API/OBO for tenant
- Graph permissions and change notifications
- Teams desktop/browser/mobile/Japanese
- Confluence Cloud API version/macros
- Plane API/webhook/rate limit/negative workspace scope
- Wispr macOS/Windows and meeting modes actually used
