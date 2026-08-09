# ADR-0023: agentgatewayとOPAを統制付きMCP/A2A Access Planeに採用する

## Status
Proposed（2026-08-10 取込。Owner 承認後に Accepted 化。取込元: docs/plans/2026-08-final-architecture/10_adrs/）

## Decision
agentgatewayはMCP/A2Aのauth、routing、rate limit、OTel、tool federationを担当し、LLM routingは使わない。OPAはactor/project/classification/tool/operation/environmentを評価し、allow/deny/approval/redaction/provider制約を返す。default denyとする。

## Security boundary
MCPにはread/explore/draft/low-risk operationだけを公開し、merge/deploy/delete/permission/retention/prod DBを公開しない。token passthroughを禁止する。
