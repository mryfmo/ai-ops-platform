# ADR-0020: 最終構成を責務分離されたControl/Inference/Access/Intelligence/User Surfaceとして固定する

## Status
Accepted proposal for Owner approval before implementation.

## Context
既存14エージェントは有用な決定的ロジックと業務要件を持つが、provider直接接続、常駐loop、Teams/Web/LLM接続が同一runtimeへ集中している。最終構成では製品の機能重複を避ける必要がある。

## Decision
- Temporal + thin Control API = Control Plane
- LiteLLM = LLM inference only
- agentgateway = MCP/A2A only
- OPA = cross-system policy
- Work IQ = delegated M365 intelligence; Graph = system integration
- OpenTag-derived Teams + existing Next.js Workbench = user surfaces
- Plane/GitHub/Confluence/SharePoint = separated authorities
- OpenTelemetry = correlation/observability

## Consequences
既存agent能力はWorkflow/Activityへ移行し、各productを万能orchestratorにしない。契約、feature flag、migrationが追加されるが、交換性と監査性が上がる。
