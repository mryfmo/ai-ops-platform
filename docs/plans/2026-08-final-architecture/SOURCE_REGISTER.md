# Source Register

## 1. 利用方針

本パックは、対象リポジトリの基準commitにある一次成果物と、2026-08-09時点で確認した各製品の公式ドキュメント／公式GitHubを根拠としている。実装時は、この一覧を「記憶による実装を禁止するための入口」として使う。

- 依存追加・設定値・API形状は、必ず実装日の公式一次情報で再確認する。
- 本パックに記載した製品名や役割はArchitecture Decisionであり、実装者が独自に置換しない。
- バージョン番号はP0/P1の依存固定タスクで、公式release、互換性試験、SBOM、脆弱性情報を確認してexact pinする。
- 公式ドキュメントと現行コードが矛盾する場合は、変更を止め、`baseline-delta.md`または新ADRへ記録してOwner判断を得る。

## 2. 対象リポジトリ一次情報

| Source | Purpose |
|---|---|
| https://github.com/mryfmo/ai-ops-platform/tree/49e2e3c0a3a9d30be46b2a3ae0727009d9eec324 | 基準commit |
| `README.md` | 現行製品像、14エージェント、検証境界 |
| `AGENTS.md` / `CLAUDE.md` | AI実装規約の現行正本 |
| `docs/adr/0001..0019` | 既存Architecture Decisionと優先順位 |
| `docs/spec/` / `packages/traceability/` | 要件・仕様・受入基準・機械的追跡 |
| `packages/shared/src/clients/*` | 現行Anthropic/Graph/GitHub接続境界 |
| `packages/server/src/config.ts` | 現行環境契約とfail-fast規則 |
| `packages/devops/src/db/schema.sql` | 現行DB正本、追記専用監査 |
| `.github/workflows/coding-task.yml` | 現行AI PR実行経路 |
| `.github/actions/run-coding-agent/action.yml` | Claude Code実行、Droid未有効の現状 |
| `.mise.toml` | 現行Definition of Done |
| GitHub branch API for `main` | 基準時点でbranch protection無効。P0 STOP gate |

## 3. 外部一次情報

### Durable Control Plane

- Temporal repository: https://github.com/temporalio/temporal
- Temporal documentation: https://docs.temporal.io/
- Temporal TypeScript SDK: https://docs.temporal.io/develop/typescript

### LLM Inference Plane

- LiteLLM repository: https://github.com/BerriAI/litellm
- LiteLLM proxy/gateway: https://docs.litellm.ai/docs/simple_proxy
- Amazon Bedrock provider: https://docs.litellm.ai/docs/providers/bedrock
- Anthropic provider: https://docs.litellm.ai/docs/providers/anthropic
- Claude Code through LiteLLM: https://github.com/BerriAI/litellm/tree/main/cookbook/ai_coding_tool_guides/claude_code_quickstart
- Anthropic LLM gateway guidance: https://docs.anthropic.com/en/docs/claude-code/llm-gateway
- Amazon Bedrock Anthropic models: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude.html

### MCP/A2A Access Plane and Policy

- agentgateway repository: https://github.com/agentgateway/agentgateway
- agentgateway documentation: https://agentgateway.dev/docs/
- MCP specification: https://modelcontextprotocol.io/specification/
- MCP security best practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- OPA repository: https://github.com/open-policy-agent/opa
- OPA documentation: https://www.openpolicyagent.org/docs/latest/

### Microsoft 365

- Work IQ overview: https://learn.microsoft.com/ja-jp/microsoft-365/copilot/extensibility/work-iq/
- Work IQ API overview: https://learn.microsoft.com/ja-jp/microsoft-365/copilot/extensibility/work-iq/api-overview
- Work IQ MCP: https://learn.microsoft.com/ja-jp/microsoft-365/copilot/extensibility/work-iq/mcp/overview
- Work IQ A2A: https://learn.microsoft.com/ja-jp/microsoft-365/copilot/extensibility/work-iq/a2a/overview
- Work IQ CLI: https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/cli
- Microsoft Graph change notifications: https://learn.microsoft.com/graph/change-notifications-overview
- Selected permissions: https://learn.microsoft.com/graph/permissions-selected-overview
- Teams transcript/recording notifications: https://learn.microsoft.com/graph/teams-changenotifications-callrecording-and-calltranscript

### User Surfaces

- OpenTag: https://github.com/CopilotKit/OpenTag
- CopilotKit Channels: https://github.com/CopilotKit/channels-sdk
- AG-UI: https://docs.ag-ui.com/introduction
- Cloudflare OS (design study only): https://github.com/cloudflare/cloudflare-os

### Operational Systems and Knowledge

- Plane API: https://developers.plane.so/api-reference/introduction
- Plane webhooks: https://developers.plane.so/dev-tools/intro-webhooks
- GitHub MCP server: https://github.com/github/github-mcp-server
- GitHub protected branches: https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- GitHub deployment environments: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment
- Confluence REST API: https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
- Atlassian Rovo MCP: https://www.atlassian.com/platform/rovo-mcp
- Wispr Flow documentation: https://docs.wisprflow.ai/
- OpenTelemetry: https://opentelemetry.io/docs/

### AI Coding Workers

- Claude Code: https://docs.anthropic.com/en/docs/claude-code/overview
- Claude Code GitHub Actions: https://docs.anthropic.com/en/docs/claude-code/github-actions
- Factory Droid: https://docs.factory.ai/

## 4. 再確認が必要なENV／契約項目

以下はコードだけでは確定できない。P0のOwner/Legal/Security gateで証跡を取得する。

1. Temporal Cloudを使うか、AKS上でTemporal OSSをself-hostするか。
2. Work IQのテナント利用可否、Copilot Credits、OBO、データ境界、利用規約。
3. Wispr Enterpriseのデータ所在地、保存期間、SSO/SCIM、MCP接続、会議同意ポリシー。
4. Confluence Cloud採用とRovo MCP利用可否。
5. Bedrockの利用リージョン、Claude model availability、quota、cross-region inference可否。
6. Anthropic APIを許可する分類と契約条件。
7. CopilotKit Intelligenceを使用するか、Teams adapterを自己管理するか。
8. Plane CEのAGPL運用境界と専用integration userのworkspace scope negative probe。
