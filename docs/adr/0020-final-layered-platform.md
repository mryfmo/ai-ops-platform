# ADR-0020: 最終構成を責務分離されたControl/Inference/Access/Intelligence/User Surfaceとして固定する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

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
