# ADR-0023: agentgatewayとOPAを統制付きMCP/A2A Access Planeに採用する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

## Decision

agentgatewayはMCP/A2Aのauth、routing、rate limit、OTel、tool federationを担当し、LLM routingは使わない。OPAはactor/project/classification/tool/operation/environmentを評価し、allow/deny/approval/redaction/provider制約を返す。default denyとする。

## Security boundary

MCPにはread/explore/draft/low-risk operationだけを公開し、merge/deploy/delete/permission/retention/prod DBを公開しない。token passthroughを禁止する。
